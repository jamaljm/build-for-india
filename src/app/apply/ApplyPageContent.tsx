"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useHandleServerEvent } from "../hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "../lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

// Aadhaar capture
import AadhaarCapture from "@/app/components/AadhaarCapture";

interface FormData {
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  aadharNumber: string;
  certificateType: string;
}

const Button = ({
  children,
  className,
  asChild,
  type = "button",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
  type?: "button" | "submit" | "reset";
  [key: string]: any;
}) => {
  const Component = asChild ? "div" : "button";
  return (
    <Component type={type} className={className} {...props}>
      {children}
    </Component>
  );
};

const Footer = () => (
  <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <div className="mb-4">
        <h3 className="text-xl font-semibold mb-2">Kerala State Government</h3>
        <p className="text-gray-400">e-District Portal — Certificate Services</p>
      </div>
    </div>
  </footer>
);

const Navigation = () => (
  <header className="bg-gradient-to-r from-green-700 to-green-800 text-white p-6 shadow-lg">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="text-2xl font-bold tracking-wide">Kerala</div>
          <div>
            <h1 className="text-2xl font-bold">e-District Portal</h1>
            <p className="text-sm text-green-200">Certificate Application</p>
          </div>
        </Link>
      </div>
      <div className="flex space-x-4">
        <Link
          href="/"
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  </header>
);

export default function ApplyPageContent() {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    fatherName: "",
    motherName: "",
    dob: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    pincode: "",
    aadharNumber: "",
    certificateType: "",
  });

  const [step, setStep] = useState<"capture" | "form">("capture");

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [speechDetected, setSpeechDetected] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastFieldFilled, setLastFieldFilled] = useState<{
    fieldName: string;
    fieldValue: string;
  } | null>(null);

  // Agent connection state
  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    AgentConfig[] | null
  >(null);

  // Add a ref to keep track of the current form auto-fill request
  const formAutoFillRef = useRef<{
    fieldName: string;
    fieldValue: string;
  } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);

  // Add a ref to track if we've initialized the session
  const sessionInitializedRef = useRef(false);

  // Add new state for tracking form completion
  const [isFormComplete, setIsFormComplete] = useState(false);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      if (dcRef.current && dcRef.current.readyState === "open") {
        logClientEvent(eventObj, eventNameSuffix);
        dcRef.current.send(JSON.stringify(eventObj));
      } else {
        logClientEvent(
          { attemptedEvent: eventObj.type, status: "queued" },
          "event_queued_dc_not_ready"
        );
      }
    } catch (error) {
      console.warn("Error sending client event:", error);
      logClientEvent(
        { attemptedEvent: eventObj.type, error: String(error) },
        "error.send_event_failed"
      );
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
  });

  // Enhanced handler for speech transcription
  const handleSpeechTranscription = (transcript: string) => {
    setLastTranscript(transcript);

    // Show visual feedback that speech was detected
    setSpeechDetected(true);

    // Process transcript to extract form data
    const extractedData = extractFormDataFromTranscript(transcript);
    if (extractedData) {
      // Update all extracted fields
      Object.entries(extractedData).forEach(([fieldName, fieldValue]) => {
        if (fieldValue && fieldName in formData) {
          const valueStr =
            typeof fieldValue === "string" ? fieldValue : String(fieldValue);

          setFormData((prev) => ({
            ...prev,
            [fieldName]: valueStr,
          }));

          setLastFieldFilled({ fieldName, fieldValue: valueStr });

          setTimeout(() => {
            setLastFieldFilled(null);
          }, 5000);
        }
      });
    }

    // Hide the feedback after 3 seconds
    setTimeout(() => {
      setSpeechDetected(false);
    }, 3000);
  };

  // Function to extract form data from transcripts
  const extractFormDataFromTranscript = (
    transcript: string
  ): Partial<FormData> | null => {
    if (!transcript) return null;

    const extractedData: Partial<FormData> = {};
    const normalizedText = transcript.toLowerCase();

    // Name extraction
    const namePatterns = [
      /my name is ([A-Za-z\s]+)/i,
      /name is ([A-Za-z\s]+)/i,
      /i am ([A-Za-z\s]+)/i,
      /myself ([A-Za-z\s]+)/i,
      /call me ([A-Za-z\s]+)/i,
      /([A-Za-z\s]+) is my name/i,
    ];

    for (const pattern of namePatterns) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.split(" ").length <= 4 && name.length > 3) {
          extractedData.fullName = name;
          break;
        }
      }
    }

    // Date of birth extraction
    if (
      normalizedText.includes("date of birth") ||
      normalizedText.includes("dob") ||
      normalizedText.includes("born")
    ) {
      const dobPatterns = [
        /(\d{1,2})[-\/\.\s](\d{1,2})[-\/\.\s](\d{4})/,
        /(\d{4})[-\/\.\s](\d{1,2})[-\/\.\s](\d{1,2})/,
        /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/i,
        /born\s+(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/i,
      ];

      for (const pattern of dobPatterns) {
        const match = transcript.match(pattern);
        if (match) {
          try {
            let day, month, year;

            if (match.length >= 4) {
              if (match[1].length === 4) {
                year = match[1];
                month = parseInt(match[2]).toString().padStart(2, "0");
                day = parseInt(match[3]).toString().padStart(2, "0");
              } else if (match[3].length === 4) {
                day = parseInt(match[1]).toString().padStart(2, "0");
                if (isNaN(parseInt(match[2]))) {
                  const months: Record<string, string> = {
                    january: "01", february: "02", march: "03",
                    april: "04", may: "05", june: "06",
                    july: "07", august: "08", september: "09",
                    october: "10", november: "11", december: "12",
                  };
                  month = months[match[2].toLowerCase()];
                } else {
                  month = parseInt(match[2]).toString().padStart(2, "0");
                }
                year = match[3];
              }
            }

            if (day && month && year) {
              if (parseInt(day) <= 31 && parseInt(month) <= 12) {
                extractedData.dob = `${year}-${month}-${day}`;
              }
            }
          } catch {
            // Skip invalid date
          }

          if (extractedData.dob) break;
        }
      }
    }

    // Gender extraction
    if (normalizedText.includes("gender") || normalizedText.includes("sex")) {
      if (/\b(male|man|boy|gentleman|he|him|his)\b/i.test(transcript)) {
        extractedData.gender = "male";
      } else if (
        /\b(female|woman|girl|lady|she|her|hers)\b/i.test(transcript)
      ) {
        extractedData.gender = "female";
      } else if (
        /\b(other|non-binary|third gender|they|them|theirs)\b/i.test(transcript)
      ) {
        extractedData.gender = "other";
      }
    }

    // Email extraction
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    if (normalizedText.includes("email") || normalizedText.includes("mail")) {
      const emailMatch = transcript.match(emailPattern);
      if (emailMatch) {
        extractedData.email = emailMatch[0];
      } else {
        const atEmailMatch = transcript.match(
          /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+([a-zA-Z]{2,})/i
        );
        if (atEmailMatch) {
          extractedData.email = `${atEmailMatch[1]}@${atEmailMatch[2]}.${atEmailMatch[3]}`;
        }
      }
    } else {
      const emailMatch = transcript.match(emailPattern);
      if (emailMatch) {
        extractedData.email = emailMatch[0];
      }
    }

    // Phone number extraction
    if (
      normalizedText.includes("phone") ||
      normalizedText.includes("mobile") ||
      normalizedText.includes("contact")
    ) {
      const phonePatterns = [
        /\b(\d{10})\b/,
        /\b(\d{3})[\s.-](\d{3})[\s.-](\d{4})\b/,
        /\b(\d{5})[\s.-](\d{5})\b/,
        /\+91[\s.-]?(\d{10})\b/,
        /\+91[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{4})\b/,
      ];

      for (const pattern of phonePatterns) {
        const phoneMatch = transcript.match(pattern);
        if (phoneMatch) {
          if (phoneMatch.length === 2) {
            extractedData.phone = phoneMatch[1].replace(/\D/g, "");
          } else if (phoneMatch.length >= 4) {
            extractedData.phone = phoneMatch
              .slice(1)
              .join("")
              .replace(/\D/g, "");
          }

          if (extractedData.phone) {
            break;
          }
        }
      }
    }

    // Aadhar number extraction
    if (
      normalizedText.includes("aadhar") ||
      normalizedText.includes("aadhaar") ||
      normalizedText.includes("uid")
    ) {
      const aadharPatterns = [
        /\b(\d{12})\b/,
        /\b(\d{4})[\s.-](\d{4})[\s.-](\d{4})\b/,
        /aadhar(?:\s+number)?(?:\s+is)?\s+(\d[\d\s-]{10,14}\d)/i,
        /aadhaar(?:\s+number)?(?:\s+is)?\s+(\d[\d\s-]{10,14}\d)/i,
      ];

      for (const pattern of aadharPatterns) {
        const aadharMatch = transcript.match(pattern);
        if (aadharMatch) {
          if (aadharMatch.length === 2) {
            extractedData.aadharNumber = aadharMatch[1].replace(/\D/g, "");
          } else if (aadharMatch.length >= 4) {
            extractedData.aadharNumber = aadharMatch
              .slice(1)
              .join("")
              .replace(/\D/g, "");
          }

          if (
            extractedData.aadharNumber &&
            extractedData.aadharNumber.length === 12
          ) {
            break;
          }
        }
      }
    } else {
      const possibleAadhar = transcript.match(/\b(\d{12})\b/);
      if (possibleAadhar && !extractedData.aadharNumber) {
        extractedData.aadharNumber = possibleAadhar[1];
      }
    }

    // Pincode extraction
    if (
      normalizedText.includes("pin") ||
      normalizedText.includes("postal") ||
      normalizedText.includes("zip")
    ) {
      const pincodePatterns = [
        /\bpin(?:code)?\s*:?\s*(\d{6})\b/i,
        /\bpostal\s+code\s*:?\s*(\d{6})\b/i,
        /\bzip\s+code\s*:?\s*(\d{6})\b/i,
      ];

      for (const pattern of pincodePatterns) {
        const pincodeMatch = transcript.match(pattern);
        if (pincodeMatch && pincodeMatch[1]) {
          extractedData.pincode = pincodeMatch[1];
          break;
        }
      }
    } else {
      const possiblePincode = transcript.match(/\b(\d{6})\b/);
      if (
        possiblePincode &&
        !extractedData.pincode &&
        !normalizedText.includes("aadhar") &&
        !normalizedText.includes("aadhaar")
      ) {
        extractedData.pincode = possiblePincode[1];
      }
    }

    // Address extraction
    if (
      normalizedText.includes("address") ||
      normalizedText.includes("live at") ||
      normalizedText.includes("residing at") ||
      normalizedText.includes("stay at")
    ) {
      const addressPatterns = [
        /address\s+(?:is|:|->)?\s+([^.?!]+)/i,
        /my address\s+(?:is|:|->)?\s+([^.?!]+)/i,
        /i live at\s+([^.?!]+)/i,
        /residing at\s+([^.?!]+)/i,
        /staying at\s+([^.?!]+)/i,
        /location\s+(?:is|:|->)?\s+([^.?!]+)/i,
      ];

      for (const pattern of addressPatterns) {
        const match = transcript.match(pattern);
        if (match && match[1]) {
          extractedData.address = match[1].trim();
          break;
        }
      }
    }

    // Certificate type extraction
    const certificateTypes = [
      "Caste",
      "Income",
      "Domicile",
      "Birth",
      "Death",
      "Marriage",
    ];

    if (
      normalizedText.includes("certificate") ||
      normalizedText.includes("apply for")
    ) {
      for (const type of certificateTypes) {
        const lowerType = type.toLowerCase();
        if (
          normalizedText.includes(lowerType + " certificate") ||
          normalizedText.includes("certificate of " + lowerType) ||
          normalizedText.includes("apply for " + lowerType) ||
          normalizedText.includes(lowerType + " cert")
        ) {
          extractedData.certificateType = type;
          break;
        }
      }
    }

    // Capitalize names correctly
    if (extractedData.fullName) {
      extractedData.fullName = extractedData.fullName
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    }

    // Ensure phone number is exactly 10 digits
    if (extractedData.phone && extractedData.phone.length > 10) {
      extractedData.phone = extractedData.phone.slice(-10);
    }

    return Object.keys(extractedData).length > 0 ? extractedData : null;
  };

  // Handle input changes with form completion check
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    setFormData(updatedFormData);

    logClientEvent({
      type: "form_field_update",
      fieldName: name,
      fieldValue: value,
    });

    checkFormCompletion(updatedFormData);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    setFormData(updatedFormData);

    logClientEvent({
      type: "form_field_update",
      fieldName: name,
      fieldValue: value,
    });

    checkFormCompletion(updatedFormData);
  };

  const checkFormCompletion = (data: FormData) => {
    const isComplete = Object.entries(data).every(([, value]) => {
      return value !== null && value !== "";
    });
    setIsFormComplete(isComplete);
  };

  // Extract submission logic to a separate function
  const performSubmission = () => {
    logClientEvent({
      type: "form_submission",
      formData: formData,
      timestamp: new Date().toISOString(),
    });

    const refNumber = "KL-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    setReferenceNumber(refNumber);
    setIsSubmitted(true);
    setIsFormComplete(true);
  };

  const handleAadhaarCapture = (data: Partial<FormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
    setStep("form");
  };

  const handleSkipCapture = () => {
    setStep("form");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSubmission();
  };

  // Intercept autofillFormField calls from response.done events
  // The useHandleServerEvent hook processes tool calls and updates localStorage,
  // but we also need to update React form state directly.
  const interceptToolCalls = (eventData: any) => {
    if (eventData.type !== "response.done" || !eventData.response?.output) {
      return;
    }

    for (const outputItem of eventData.response.output) {
      if (outputItem.type !== "function_call" || !outputItem.arguments) {
        continue;
      }

      try {
        const args = JSON.parse(outputItem.arguments);

        if (outputItem.name === "autofillFormField" && args.fieldName && args.fieldValue) {
          const { fieldName, fieldValue } = args;

          formAutoFillRef.current = { fieldName, fieldValue };
          setLastFieldFilled({ fieldName, fieldValue });

          setTimeout(() => {
            setLastFieldFilled(null);
          }, 5000);

          setFormData((prevData) => ({
            ...prevData,
            [fieldName]: fieldValue,
          }));

          logClientEvent({
            type: "form_field_update",
            fieldName,
            fieldValue,
            source: "ai_assistant",
          });
        }
      } catch {
        // Skip malformed arguments
      }
    }
  };

  // Enhanced server event handler with speech transcription handling
  const handleServerEvent = (eventData: any) => {
    handleServerEventRef.current(eventData);

    // Intercept tool calls to update React form state
    interceptToolCalls(eventData);

    // Handle speech transcription events
    if (
      eventData.type ===
        "conversation.item.input_audio_transcription.completed" &&
      eventData.transcript
    ) {
      handleSpeechTranscription(eventData.transcript);
    }

    // Handle streaming transcription updates
    if (
      eventData.type === "response.audio_transcript.delta" &&
      eventData.delta
    ) {
      const updatedTranscript = lastTranscript + eventData.delta;
      setLastTranscript(updatedTranscript);
      setSpeechDetected(true);

      const extractedData = extractFormDataFromTranscript(updatedTranscript);
      if (extractedData) {
        Object.entries(extractedData).forEach(([fieldName, fieldValue]) => {
          if (fieldValue && fieldName in formData) {
            if (formData[fieldName as keyof FormData] !== fieldValue) {
              setFormData((prev) => ({
                ...prev,
                [fieldName]: fieldValue,
              }));

              setLastFieldFilled({ fieldName, fieldValue: String(fieldValue) });

              setTimeout(() => {
                setLastFieldFilled(null);
              }, 5000);
            }
          }
        });
      }

      setTimeout(() => {
        setSpeechDetected(false);
      }, 3000);
    }
  };

  useEffect(() => {
    const finalAgentConfig = defaultAgentSetKey;
    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = "formHelper";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, []);

  useEffect(() => {
    if (selectedAgentName && step === "form") {
      connectToRealtime();
    }
  }, [selectedAgentName, step]);

  useEffect(() => {
    if (
      !sessionInitializedRef.current &&
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName &&
      dcRef.current &&
      dcRef.current.readyState === "open"
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(true);

      sessionInitializedRef.current = true;
    }
  }, [
    selectedAgentConfigSet,
    selectedAgentName,
    sessionStatus,
    addTranscriptBreadcrumb,
  ]);

  useEffect(() => {
    if (sessionStatus === "DISCONNECTED") {
      sessionInitializedRef.current = false;
    }
  }, [sessionStatus]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEvent(JSON.parse(e.data));
      });

      setSessionStatus("CONNECTED");
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  const disconnectFromRealtime = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }
    dcRef.current = null;
    setSessionStatus("DISCONNECTED");

    logClientEvent({}, "disconnected");
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)"
    );
    sendClientEvent(
      { type: "response.create" },
      "(trigger response after simulated user text message)"
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    sendClientEvent(
      { type: "input_audio_buffer.clear" },
      "clear audio buffer on session update"
    );

    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: "coral",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.6,
          prefix_padding_ms: 400,
          silence_duration_ms: 1200,
        },
        tools,
      },
    };

    sendClientEvent(sessionUpdateEvent);

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi");
    }
  };

  useEffect(() => {
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  // Track whether initial load from localStorage is done
  const initialLoadDoneRef = useRef(false);

  // Load form data from localStorage on mount
  useEffect(() => {
    const storedFormData = localStorage.getItem("kerala_gov_cert_form_data");
    if (storedFormData) {
      try {
        const parsedData = JSON.parse(storedFormData);
        if (parsedData.formData) {
          const updatedFormData: FormData = {
            fullName: "",
            fatherName: "",
            motherName: "",
            dob: "",
            gender: "",
            email: "",
            phone: "",
            address: "",
            pincode: "",
            aadharNumber: "",
            certificateType: "",
          };

          Object.entries(parsedData.formData).forEach(([key, value]) => {
            if (value !== null && key in updatedFormData) {
              updatedFormData[key as keyof FormData] = value as string;
            }
          });

          setFormData(updatedFormData);
          setIsFormComplete(parsedData.isComplete || false);
        }
      } catch (error) {
        console.error("Error parsing stored form data:", error);
      }
    }
    initialLoadDoneRef.current = true;
  }, []);

  // Save form data to localStorage when it changes
  // Guard: skip the first render to avoid overwriting stored data with empty initial state
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;

    const formDataToStore = {
      formData: {
        fullName: formData.fullName || null,
        fatherName: formData.fatherName || null,
        motherName: formData.motherName || null,
        dob: formData.dob || null,
        gender: formData.gender || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        pincode: formData.pincode || null,
        aadharNumber: formData.aadharNumber || null,
        certificateType: formData.certificateType || null,
      },
      lastUpdated: new Date().toISOString(),
      isComplete: isFormComplete,
    };

    localStorage.setItem(
      "kerala_gov_cert_form_data",
      JSON.stringify(formDataToStore)
    );
  }, [formData, isFormComplete]);

  // Listen for formDataUpdated custom events dispatched by updateFormData (agent tool calls).
  // This is the primary mechanism for syncing agent-filled data into React state.
  useEffect(() => {
    const handleFormDataUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.fieldName && detail?.value !== undefined) {
        setFormData((prev) => ({
          ...prev,
          [detail.fieldName]: detail.value,
        }));

        setLastFieldFilled({
          fieldName: detail.fieldName,
          fieldValue: detail.value,
        });

        setTimeout(() => {
          setLastFieldFilled(null);
        }, 5000);
      }

      if (detail?.formData?.isComplete !== undefined) {
        setIsFormComplete(detail.formData.isComplete);
      }
    };

    window.addEventListener("formDataUpdated", handleFormDataUpdated);
    return () => {
      window.removeEventListener("formDataUpdated", handleFormDataUpdated);
    };
  }, []);

  // Enhanced VoiceAssistant component with connection status
  const EnhancedVoiceAssistant = () => (
    <div className="fixed bottom-8 right-8">
      <button
        className={`w-16 h-16 rounded-full ${
          sessionStatus === "CONNECTED" ? "bg-green-700" : "bg-gray-500"
        } text-white shadow-lg flex items-center justify-center hover:${
          sessionStatus === "CONNECTED" ? "bg-green-800" : "bg-gray-600"
        } transition-colors`}
        onClick={
          sessionStatus === "CONNECTED"
            ? disconnectFromRealtime
            : connectToRealtime
        }
      >
        <span className="sr-only">Voice Assistant</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
    </div>
  );

  // Speech Recognition Feedback component
  const SpeechFeedback = () => {
    if (!speechDetected && !lastFieldFilled) return null;

    return (
      <div className="fixed top-24 right-8 max-w-md z-50">
        {speechDetected && (
          <div className="bg-blue-100 border border-blue-300 text-blue-800 p-3 rounded-lg mb-2 shadow-md animate-pulse">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <p className="text-sm font-medium">Listening...</p>
            </div>
            {lastTranscript && (
              <p className="text-xs mt-1 italic truncate">{lastTranscript}</p>
            )}
          </div>
        )}

        {lastFieldFilled && (
          <div className="bg-green-100 border border-green-300 text-green-800 p-3 rounded-lg shadow-md transition-opacity">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-sm font-medium">
                Field Filled: {lastFieldFilled.fieldName}
              </p>
            </div>
            <p className="text-xs mt-1 truncate">
              Value: {lastFieldFilled.fieldValue}
            </p>
          </div>
        )}
      </div>
    );
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white">
        <Navigation />

        <main className="flex-grow max-w-3xl mx-auto py-12 px-4 flex flex-col items-center justify-center">
          <div className="text-center space-y-6 p-8 border-2 border-green-500 rounded-lg bg-green-50 w-full">
            <div className="text-5xl text-green-600 mb-4">&#10003;</div>
            <h1 className="text-3xl font-bold text-green-900">
              Application Submitted Successfully!
            </h1>
            <p className="text-lg">
              Your application for{" "}
              <strong>{formData.certificateType} Certificate</strong> has been
              received.
            </p>
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600">Reference Number</p>
              <p className="text-xl font-bold text-green-800">
                {referenceNumber}
              </p>
            </div>
            <p className="text-gray-600">
              Please save this reference number for tracking your application
              status.
            </p>
            <div className="flex gap-4 justify-center mt-6">
              <Button
                asChild
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded"
              >
                <Link href="/">Return to Home</Link>
              </Button>
            </div>
          </div>
        </main>

        <Footer />
        <EnhancedVoiceAssistant />
        <SpeechFeedback />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white">
      <Navigation />

      <main className="flex-grow max-w-3xl mx-auto py-12 px-4">
        {step === "capture" ? (
          <AadhaarCapture
            onCapture={handleAadhaarCapture}
            onSkip={handleSkipCapture}
          />
        ) : (
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-green-900">
              Certificate Application Form
            </h1>
            <p className="text-gray-500">
              Please fill in your personal details to apply for the certificate
            </p>
            {sessionStatus === "CONNECTED" && (
              <p className="text-sm text-green-600 mt-2">
                Voice assistant is active. Speak to fill the form automatically.
              </p>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "fullName"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="fullName"
                  className="text-sm font-medium text-gray-600"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  placeholder="Enter your full name"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "fatherName"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="fatherName"
                  className="text-sm font-medium text-gray-600"
                >
                  Father&apos;s Name
                </label>
                <input
                  id="fatherName"
                  name="fatherName"
                  placeholder="Enter father's name"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.fatherName}
                  onChange={handleInputChange}
                />
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "motherName"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="motherName"
                  className="text-sm font-medium text-gray-600"
                >
                  Mother&apos;s Name
                </label>
                <input
                  id="motherName"
                  name="motherName"
                  placeholder="Enter mother's name"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.motherName}
                  onChange={handleInputChange}
                />
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "dob"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="dob"
                  className="text-sm font-medium text-gray-600"
                >
                  Date of Birth
                </label>
                <div className="relative">
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                    value={formData.dob}
                    onChange={handleInputChange}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      ></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                </div>
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "gender"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="gender"
                  className="text-sm font-medium text-gray-600"
                >
                  Gender
                </label>
                <div className="relative">
                  <select
                    id="gender"
                    name="gender"
                    className="w-full p-3 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                    value={formData.gender}
                    onChange={handleSelectChange}
                    required
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "email"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-600"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "phone"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="phone"
                  className="text-sm font-medium text-gray-600"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "aadharNumber"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="aadharNumber"
                  className="text-sm font-medium text-gray-600"
                >
                  Aadhaar Number
                </label>
                <input
                  id="aadharNumber"
                  name="aadharNumber"
                  placeholder="Enter your Aadhaar number"
                  required
                  pattern="[0-9]{12}"
                  maxLength={12}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.aadharNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div
              className={`space-y-2 ${
                lastFieldFilled?.fieldName === "address"
                  ? "ring-2 ring-green-500 rounded-lg p-1"
                  : ""
              }`}
            >
              <label
                htmlFor="address"
                className="text-sm font-medium text-gray-600"
              >
                Full Address
              </label>
              <textarea
                id="address"
                name="address"
                placeholder="Enter your complete address"
                required
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                value={formData.address}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "pincode"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="pincode"
                  className="text-sm font-medium text-gray-600"
                >
                  Pincode
                </label>
                <input
                  id="pincode"
                  name="pincode"
                  placeholder="Enter pincode"
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                  value={formData.pincode}
                  onChange={handleInputChange}
                />
              </div>

              <div
                className={`space-y-2 ${
                  lastFieldFilled?.fieldName === "certificateType"
                    ? "ring-2 ring-green-500 rounded-lg p-1"
                    : ""
                }`}
              >
                <label
                  htmlFor="certificateType"
                  className="text-sm font-medium text-gray-600"
                >
                  Certificate Type
                </label>
                <div className="relative">
                  <select
                    id="certificateType"
                    name="certificateType"
                    className="w-full p-3 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                    value={formData.certificateType}
                    onChange={handleSelectChange}
                    required
                  >
                    <option value="" disabled>
                      Select certificate type
                    </option>
                    {[
                      "Caste",
                      "Income",
                      "Domicile",
                      "Birth",
                      "Death",
                      "Marriage",
                    ].map((type) => (
                      <option key={type} value={type}>
                        {type} Certificate
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full bg-green-700 text-white hover:bg-green-800 py-4 px-4 rounded-md text-lg font-semibold transition-colors"
              >
                Submit Application
              </Button>
            </div>
          </form>
        </div>
        )}
      </main>

      <Footer />
      <EnhancedVoiceAssistant />
      <SpeechFeedback />
    </div>
  );
}
