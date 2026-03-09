"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [name, setName] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Simple state passing via localStorage for MVP.
    localStorage.setItem("playerName", name.trim());
    localStorage.setItem("playerAvatar", "default"); // No longer capturing photo

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
          Nhập tên để tham gia trò chơi. Trình duyệt sẽ yêu cầu quyền mở Camera
          ở bước sau.
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

          <button
            type="submit"
            disabled={!name.trim()}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] disabled:shadow-none cursor-pointer"
          >
            VÀO PHÒNG CHƠI
          </button>
        </form>
      </main>
    </div>
  );
}
