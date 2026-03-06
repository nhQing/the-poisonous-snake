"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { Users, AlertTriangle } from "lucide-react";

interface Player {
  id: string;
  name: string;
  avatarStr: string;
}

export default function RoomPage() {
  const { id: roomId } = useParams() as { id: string };
  const router = useRouter();

  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [myInfo, setMyInfo] = useState<{ name: string; avatar: string } | null>(
    null,
  );
  const [personCount, setPersonCount] = useState<number>(1);
  const [visionWarning, setVisionWarning] = useState("");

  const [messages, setMessages] = useState<
    { id: string; role: string; content: string }[]
  >([
    {
      id: "1",
      role: "assistant",
      content:
        'Chào mừng các bạn đến với ngôi làng sương mù. Trò chơi Ma Sói chuẩn bị bắt đầu. Vui lòng nói "Bắt đầu" khi mọi người đã sẵn sàng.',
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/game-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      // Add a placeholder assistant message
      setMessages((prev) => [
        ...prev,
        { id: "ast" + Date.now(), role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMsg += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const m = [...prev];
          m[m.length - 1].content = assistantMsg;
          return m;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    // Load local info
    const name = localStorage.getItem("playerName");
    const avatar = localStorage.getItem("playerAvatar");
    if (!name || !avatar) {
      router.push("/");
      return;
    }
    setMyInfo({ name, avatar });

    // Init Camera
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Cant access camera in room", e);
      }
    };
    initCamera();

    // Start Real-time connection
    const pusher = getPusherClient();
    if (!pusher) return;

    // We use a presence channel for players.
    const channel = pusher.subscribe(`presence-room-${roomId}`);

    channel.bind("pusher:subscription_succeeded", (members: any) => {
      console.log("Joined room, existing members:", members.count);
      // Let's broadcast our real ID out.
      // In a real app the auth route server would inject user_info into presence.
      // For MVP we just use client events to share the avatar and name.
      channel.trigger("client-player-joined", {
        name,
        avatarStr: avatar,
        id: members.myID,
      });
    });

    channel.bind("client-player-joined", (data: Player) => {
      setPlayers((prev) => ({ ...prev, [data.id]: data }));
    });

    return () => {
      pusher.unsubscribe(`presence-room-${roomId}`);
    };
  }, [roomId, router]);

  // Periodic check for human count
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth || 640;
      canvasRef.current.height = videoRef.current.videoHeight || 480;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageBase64 = canvasRef.current.toDataURL("image/jpeg", 0.5);

      try {
        const res = await fetch("/api/ai/detect-humans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        const data = await res.json();
        if (data.count !== undefined) {
          setPersonCount(data.count);
          if (data.count > 1) {
            setVisionWarning(
              `Cảnh báo: Phát hiện ${data.count} người trên camera của bạn!`,
            );
          } else if (data.count === 0) {
            setVisionWarning("Cảnh báo: Không phát hiện người trên camera!");
          } else {
            setVisionWarning("");
          }
        }
      } catch (err) {
        console.error("Vision check failed", err);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-slate-100 overflow-hidden font-sans">
      {/* LEFT PANEL: Players and Video */}
      <div className="w-1/3 flex flex-col border-r border-zinc-800 bg-zinc-900 p-4 gap-4">
        <h2 className="text-xl font-bold flex items-center justify-between">
          <span className="text-red-500">Phòng {roomId}</span>
          <span className="text-xs bg-zinc-800 px-2 py-1 rounded-lg flex items-center gap-2">
            <Users size={14} /> {Object.keys(players).length + 1}
          </span>
        </h2>

        {visionWarning && (
          <div className="bg-red-900/40 border border-red-500/50 text-red-200 text-xs px-3 py-2 rounded flex gap-2 items-center">
            <AlertTriangle size={14} />
            {visionWarning}
          </div>
        )}

        {/* My Video Feed */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-slate-700">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 text-xs rounded">
            Bạn ({myInfo?.name})
          </div>
        </div>

        {/* Other Players (Anonymous Mode toggleable logic goes here) */}
        <div className="flex-1 overflow-y-auto mt-4 px-1">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
            Người chơi (#Ẩn danh)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(players).map((p) => (
              <div
                key={p.id}
                className="bg-zinc-800 rounded-lg p-2 flex flex-col items-center gap-2 border border-zinc-700"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatarStr}
                    alt="Avatar"
                    className="w-full h-full object-cover grayscale opacity-50 blur-[2px]"
                  />
                </div>
                <span className="text-xs text-zinc-300">Người chơi ???</span>
              </div>
            ))}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* RIGHT PANEL: Game Master Chat */}
      <div className="flex-1 flex flex-col bg-zinc-950">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900 shadow-sm">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            Quản Trò AI{" "}
            <span className="text-xs bg-red-600 px-2 py-0.5 rounded-full">
              Claude
            </span>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-zinc-800 border border-zinc-700 text-slate-200 rounded-bl-none shadow-md"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="text-red-400 text-xs font-bold mb-1 uppercase">
                    Quản Trò
                  </div>
                )}
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="px-5 py-3 bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-none text-zinc-500 flex gap-2 items-center text-sm">
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse delay-75"></span>
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse delay-150"></span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 bg-zinc-900 border-t border-zinc-800"
        >
          <div className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Nhắn với quản trò (Vd: Tôi muốn soi người số 2)..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-4 pr-12 text-slate-200 focus:outline-none focus:border-red-500 transition-colors placeholder-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 bottom-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg px-4 font-semibold transition-colors"
            >
              Gửi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
