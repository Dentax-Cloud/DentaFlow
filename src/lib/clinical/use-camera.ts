"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type CameraFacing = "user" | "environment";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof navigator !== "undefined" &&
        "mediaDevices" in navigator &&
        "getUserMedia" in navigator.mediaDevices,
    );
  }, []);

  const startCamera = useCallback(async (facingMode: CameraFacing = "environment") => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setFacing(facingMode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Camera access denied";
      setError(message);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  const flipCamera = useCallback(() => {
    stopCamera();
    startCamera(facing === "user" ? "environment" : "user");
  }, [facing, startCamera, stopCamera]);

  const capturePhoto = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return resolve(null);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);

      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isActive,
    isSupported,
    error,
    facing,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
  };
}
