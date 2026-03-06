"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

export default function CameraCapture({
  onCapture,
}: {
  onCapture: (imageStr: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageBase64 = canvasRef.current.toDataURL("image/jpeg");
        onCapture(imageBase64);

        // Stop the stream after capture
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {!stream && (
        <button
          onClick={startCamera}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          <Camera size={20} />
          Enable Camera & Mic
        </button>
      )}

      <div
        className={`relative rounded-xl overflow-hidden bg-black ${!stream ? "hidden" : "block"}`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-[400px] h-[300px] object-cover"
        />
        <button
          onClick={capturePhoto}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-2 rounded-full font-bold shadow-lg hover:bg-gray-200"
        >
          Take Avatar Photo
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
