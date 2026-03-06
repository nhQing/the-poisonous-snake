"use client";

import { useState } from "react";
import CameraCapture from "@/components/CameraCapture";
import { useRouter } from "next/navigation";

export default function Home() {
  const [name, setName] = useState("");
  const [avatarStr, setAvatarStr] = useState<string | null>(null);
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !avatarStr) return;

    // Simple state passing via localStorage for MVP.
    // In a real app with next-auth, this would use a session.
    localStorage.setItem("playerName", name);
    localStorage.setItem("playerAvatar", avatarStr);

    // Redirect to a placeholder room
    router.push("/room/main");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white font-sans">
      <main className="flex flex-col items-center max-w-xl w-full p-8 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800">
        <h1 className="text-4xl font-bold text-red-600 mb-2 tracking-widest uppercase">
          Ma Sói
        </h1>
        <p className="text-slate-400 mb-8 text-center">
          Nhập tên và chụp ảnh để tham gia trò chơi. (Enter name and take a
          photo to join)
        </p>

        <form onSubmit={handleJoin} className="w-full flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Tên / Biệt danh (Name)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên của bạn..."
              className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div className="flex flex-col gap-2 relative">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Ảnh đại diện (Avatar)
            </label>
            {avatarStr ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarStr}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAvatarStr(null)}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-full shadow"
                >
                  Chụp lại
                </button>
              </div>
            ) : (
              <CameraCapture onCapture={(img) => setAvatarStr(img)} />
            )}
          </div>

          <button
            type="submit"
            disabled={!name || !avatarStr}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] disabled:shadow-none"
          >
            VÀO PHÒNG CHƠI
          </button>
        </form>
      </main>
    </div>
  );
}
