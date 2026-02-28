"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

interface AadhaarData {
  aadhaarNumber?: string | null;
  fullName?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  pincode?: string | null;
}

interface AadhaarCaptureProps {
  onCapture: (data: {
    fullName?: string;
    dob?: string;
    gender?: string;
    address?: string;
    pincode?: string;
    aadharNumber?: string;
  }) => void;
  onSkip: () => void;
}

type CaptureState = "initial" | "camera" | "processing" | "result" | "error";

export default function AadhaarCapture({ onCapture, onSkip }: AadhaarCaptureProps) {
  const [state, setState] = useState<CaptureState>("initial");
  const [extractedData, setExtractedData] = useState<AadhaarData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setState("camera");
    try {
      // Try rear camera first (mobile), fallback to any camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 960 } },
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setErrorMessage("Could not access camera. Please check permissions and try again.");
      setState("error");
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Stop camera after capturing
    stopCamera();

    // Convert to base64 JPEG
    const base64 = canvas.toDataURL("image/jpeg", 0.8);

    setState("processing");

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setExtractedData(result.data);
        setState("result");
      } else {
        setErrorMessage(result.error || "Could not read the Aadhaar card. Please try again with a clearer image.");
        setState("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setState("error");
    }
  }, [stopCamera]);

  const handleRetake = useCallback(() => {
    setExtractedData(null);
    setErrorMessage("");
    startCamera();
  }, [startCamera]);

  const handleUseDetails = useCallback(() => {
    if (!extractedData) return;

    const formData: Record<string, string> = {};
    if (extractedData.fullName) formData.fullName = extractedData.fullName;
    if (extractedData.dob) formData.dob = extractedData.dob;
    if (extractedData.gender) formData.gender = extractedData.gender;
    if (extractedData.address) formData.address = extractedData.address;
    if (extractedData.pincode) formData.pincode = extractedData.pincode;
    if (extractedData.aadhaarNumber) formData.aadharNumber = extractedData.aadhaarNumber;

    onCapture(formData);
  }, [extractedData, onCapture]);

  const fieldLabels: Record<string, string> = {
    fullName: "Full Name",
    dob: "Date of Birth",
    gender: "Gender",
    address: "Address",
    pincode: "Pincode",
    aadhaarNumber: "Aadhaar Number",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-green-900">
          Scan Your Aadhaar Card
        </h1>
        <p className="text-gray-500">
          Speed up your application by scanning your Aadhaar card.
          {" "}We&apos;ll extract your details automatically.
        </p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        {/* Initial state */}
        {state === "initial" && (
          <div className="flex flex-col items-center space-y-6 py-8">
            <div className="w-64 h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p className="text-sm">Aadhaar Card</p>
              </div>
            </div>

            <button
              onClick={startCamera}
              className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Open Camera
            </button>

            <button
              onClick={onSkip}
              className="text-green-700 hover:text-green-800 text-sm font-medium underline underline-offset-2 transition-colors"
            >
              Skip, fill manually &rarr;
            </button>
          </div>
        )}

        {/* Camera active */}
        {state === "camera" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-full max-w-lg rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
              />
              {/* Guide overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-white/50 rounded-lg" />
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
                    Position Aadhaar card within the frame
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={capturePhoto}
                className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Capture
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  setState("initial");
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {state === "processing" && (
          <div className="flex flex-col items-center space-y-4 py-12">
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-700">
              Extracting details...
            </p>
            <p className="text-sm text-gray-500">
              This may take a few seconds
            </p>
          </div>
        )}

        {/* Result */}
        {state === "result" && extractedData && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-3xl text-green-600 mb-2">&#10003;</div>
              <p className="text-lg font-medium text-gray-700">
                Details extracted successfully
              </p>
              <p className="text-sm text-gray-500">
                Please review the information below
              </p>
            </div>

            <div className="space-y-3">
              {Object.entries(extractedData).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-600">
                    {fieldLabels[key] || key}
                  </span>
                  <span className="text-sm text-gray-900 font-medium">
                    {value || (
                      <span className="text-gray-400 italic">Not detected</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-4 justify-center pt-2">
              <button
                onClick={handleUseDetails}
                className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Use These Details
              </button>
              <button
                onClick={handleRetake}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Retake
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex flex-col items-center space-y-4 py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-700">
              Could not read card
            </p>
            <p className="text-sm text-gray-500 text-center max-w-md">
              {errorMessage}
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleRetake}
                className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onSkip}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
