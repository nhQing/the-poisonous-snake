import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  stream?: MediaStream | null;
  name: string;
  isEliminated?: boolean;
}

export default function VideoPlayer({
  stream,
  name,
  isEliminated,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-black aspect-video transition-all duration-300 ${
        isEliminated
          ? "border-4 border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.8)]"
          : "border-2 border-slate-700"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Do not mute remote players!
        className={`w-full h-full object-cover ${
          isEliminated ? "grayscale opacity-50" : ""
        }`}
      />

      {/* Name / Anonymous tag */}
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 text-xs rounded text-white z-10 flex gap-2 items-center">
        {name}
        {isEliminated && (
          <span className="text-[10px] text-red-500 font-bold uppercase">
            Bị loại
          </span>
        )}
      </div>

      {isEliminated && (
        <div className="absolute inset-0 bg-red-900/20 pointer-events-none z-20"></div>
      )}
    </div>
  );
}
