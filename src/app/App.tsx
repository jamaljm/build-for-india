"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

function App() {
  const searchParams = useSearchParams();

  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    AgentConfig[] | null
  >(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
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

  // Enhanced server event handler with navigation detection
  const handleServerEvent = (eventData: any) => {
    // Call the original handler
    handleServerEventRef.current(eventData);

    // Detect when agent wants to navigate to apply page
    if (
      eventData.type === "response.audio_transcript.done" &&
      eventData.transcript
    ) {
      const transcript = eventData.transcript.toLowerCase();
      
      // Check for navigation trigger phrases
      if (
        transcript.includes("let me take you to the application") ||
        transcript.includes("redirecting you to the application") ||
        transcript.includes("navigate to the application") ||
        transcript.includes("taking you to the application form") ||
        transcript.includes("go to the application page")
      ) {
        console.log("Navigation trigger detected in transcript:", transcript);
        setTimeout(() => {
          window.location.href = "/apply";
        }, 1000); // Small delay so user hears the message
      }
    }

    // Also check text content from assistant
    if (
      eventData.type === "response.content_part.added" &&
      eventData.part?.type === "text" &&
      eventData.part?.text
    ) {
      const text = eventData.part.text.toLowerCase();
      
      if (
        text.includes("let me take you to the application") ||
        text.includes("redirecting you to the application") ||
        text.includes("navigate to the application") ||
        text.includes("taking you to the application form") ||
        text.includes("go to the application page")
      ) {
        console.log("Navigation trigger detected in text:", text);
        setTimeout(() => {
          window.location.href = "/apply";
        }, 1000);
      }
    }
  };

  // Handle button clicks - conversation or navigation
  const handleStartConversation = (topic?: string) => {
    if (sessionStatus !== "CONNECTED") {
      console.log("Not connected - connecting first");
      connectToRealtime();
      return;
    }
    
    try {
      if (topic) {
        sendSimulatedUserMessage(
          `I want to know about ${topic}`
        );
      } else {
        sendSimulatedUserMessage("Hello, I need help");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Handle Apply form navigation
  const handleGoToApply = () => {
    window.location.href = "/apply";
  };

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName) {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(true);
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

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

  useEffect(() => {
    if (dcRef.current) {
      dcRef.current.addEventListener("message", (e: MessageEvent) => {
        handleServerEvent(JSON.parse(e.data));
      });
    }
  }, [dcRef.current]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h1 className="text-2xl font-bold">Multi-Agent AI System</h1>
              <p className="text-sm text-blue-100">Build for India Hackathon</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-sm">
              <span className="font-semibold">Status: </span>
              <span className={sessionStatus === "CONNECTED" ? "text-green-300" : "text-red-300"}>
                {sessionStatus === "CONNECTED" ? "● Connected" : "○ Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto py-20 px-4 text-center">
          <div className="mb-8">
            <h2 className="text-5xl md:text-6xl font-bold mb-4">
              Voice-Enabled AI Assistant
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              Experience the power of multi-agent collaboration through natural voice interaction
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-8">
            <button
              className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg ${
                sessionStatus === "CONNECTED"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
              onClick={
                sessionStatus === "CONNECTED"
                  ? disconnectFromRealtime
                  : connectToRealtime
              }
            >
              {sessionStatus === "CONNECTED"
                ? "🔌 Disconnect Assistant"
                : "🎤 Connect & Start Speaking"}
            </button>
            
            <button
              className="px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg bg-blue-600 hover:bg-blue-700"
              onClick={handleGoToApply}
            >
              📝 Apply for Certificate
            </button>
          </div>

          <div className="inline-block bg-white/10 backdrop-blur-sm rounded-lg px-6 py-3 text-sm md:text-base">
            <span className="font-semibold">Connection Status: </span>
            <span className={sessionStatus === "CONNECTED" ? "text-green-300" : sessionStatus === "CONNECTING" ? "text-yellow-300" : "text-red-300"}>
              {sessionStatus === "CONNECTED" ? "✓ Connected" : sessionStatus === "CONNECTING" ? "⟳ Connecting..." : "✗ Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">
          Multi-Agent Capabilities
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Voice Interaction",
              description: "Natural language conversation powered by OpenAI Realtime API",
              icon: "🎙️",
              color: "from-blue-500 to-blue-600",
            },
            {
              title: "Agent Collaboration",
              description: "Specialized agents working together to solve complex tasks",
              icon: "🤝",
              color: "from-purple-500 to-purple-600",
            },
            {
              title: "Real-time Processing",
              description: "Instant responses with streaming audio and text transcription",
              icon: "⚡",
              color: "from-pink-500 to-pink-600",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              <div className={`text-6xl mb-4 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Demo prompt suggestions */}
        <div className="mt-16 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8">
          <h3 className="text-2xl font-bold text-center mb-6 text-gray-800">
            Try These Prompts
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Hello, can you help me?",
              "Tell me about your capabilities",
              "How does multi-agent collaboration work?",
              "What can you assist me with?",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleStartConversation(prompt)}
                disabled={sessionStatus !== "CONNECTED"}
                className={`p-4 rounded-lg text-left transition-all ${
                  sessionStatus === "CONNECTED"
                    ? "bg-white hover:bg-blue-50 hover:shadow-md cursor-pointer"
                    : "bg-gray-100 cursor-not-allowed opacity-50"
                }`}
              >
                <span className="text-blue-600 mr-2">💬</span>
                <span className="text-gray-700">{prompt}</span>
              </button>
            ))}
          </div>
          {sessionStatus !== "CONNECTED" && (
            <p className="text-center mt-4 text-sm text-gray-500">
              Connect to the assistant to try these prompts
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Build for India Hackathon 2026</h3>
            <p className="text-gray-400">Multi-Agent Systems and Collaboration Track</p>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400">
              Powered by OpenAI Realtime API • Next.js 15 • React 19
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
