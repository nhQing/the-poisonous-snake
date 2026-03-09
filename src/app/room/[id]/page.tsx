"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { Users, AlertTriangle, ShieldAlert } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";

interface Player {
  id: string;
  name: string;
  avatarStr: string;
  isEliminated?: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export default function RoomPage() {
  const { id: roomId } = useParams() as { id: string };
  const router = useRouter();

  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const [myInfo, setMyInfo] = useState<{ name: string; avatar: string } | null>(
    null,
  );
  const [myId, setMyId] = useState<string>("");
  const [isMeEliminated, setIsMeEliminated] = useState(false);

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

  // WebRTC & Pusher refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<any>(null);

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

  const createPeerConnection = useCallback(
    (targetId: string, initiator: boolean, myIdStr: string) => {
      if (peersRef.current[targetId]) return peersRef.current[targetId];

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[targetId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.trigger("client-webrtc-candidate", {
            target: targetId,
            candidate: event.candidate,
            sender: myIdStr,
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetId]: event.streams[0],
        }));
      };

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            channelRef.current.trigger("client-webrtc-offer", {
              target: targetId,
              offer: pc.localDescription,
              sender: myIdStr,
              senderProfile: myInfo, // Pass profile with offer incase target joined later
            });
          })
          .catch((e) => console.error("Create offer error", e));
      }

      return pc;
    },
    [myInfo],
  );

  useEffect(() => {
    const name = localStorage.getItem("playerName");
    const avatar = localStorage.getItem("playerAvatar");
    if (!name || !avatar) {
      router.push("/");
      return;
    }
    const info = { name, avatar };
    setMyInfo(info);

    const checkAndInit = async () => {
      // 1. Initialise camera
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Cant access camera", err);
        alert("Cảnh báo: Không thể bật Camera trong phòng!");
      }

      // 2. Initialise Pusher
      const pusher = getPusherClient();
      if (!pusher) return;

      const channel = pusher.subscribe(`presence-room-${roomId}`);
      channelRef.current = channel;

      channel.bind("pusher:subscription_succeeded", (members: any) => {
        const id = members.myID;
        setMyId(id);

        // Broadcast my profile
        channel.trigger("client-player-joined", {
          name: info.name,
          avatarStr: info.avatar,
          id: id,
        });
      });

      channel.bind("client-player-joined", (data: Player) => {
        setPlayers((prev) => ({ ...prev, [data.id]: data }));
        // If I am already here and someone joins, I am the initiator
        if (
          (channel as any).members.myID &&
          data.id !== (channel as any).members.myID
        ) {
          createPeerConnection(data.id, true, (channel as any).members.myID);
        }
      });

      channel.bind("client-webrtc-offer", async (data: any) => {
        if (data.target !== (channel as any).members.myID) return;

        if (data.senderProfile) {
          setPlayers((prev) => ({
            ...prev,
            [data.sender]: {
              id: data.sender,
              name: data.senderProfile.name,
              avatarStr: data.senderProfile.avatar,
            },
          }));
        }

        const pc = createPeerConnection(
          data.sender,
          false,
          (channel as any).members.myID,
        );
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.trigger("client-webrtc-answer", {
          target: data.sender,
          answer: pc.localDescription,
          sender: (channel as any).members.myID,
        });
      });

      channel.bind("client-webrtc-answer", async (data: any) => {
        if (data.target !== (channel as any).members.myID) return;
        const pc = peersRef.current[data.sender];
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });

      channel.bind("client-webrtc-candidate", async (data: any) => {
        if (data.target !== (channel as any).members.myID) return;
        const pc = peersRef.current[data.sender];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });

      // Handle elimination sync
      channel.bind("client-player-eliminated", (data: any) => {
        if (data.target === (channel as any).members.myID) {
          setIsMeEliminated(data.isEliminated);
        } else {
          setPlayers((prev) => ({
            ...prev,
            [data.target]: {
              ...prev[data.target],
              isEliminated: data.isEliminated,
            },
          }));
        }
      });

      // Member leaving cleanup
      channel.bind("pusher:member_removed", (member: any) => {
        setPlayers((prev) => {
          const newPlayers = { ...prev };
          delete newPlayers[member.id];
          return newPlayers;
        });
        setRemoteStreams((prev) => {
          const newStreams = { ...prev };
          delete newStreams[member.id];
          return newStreams;
        });
        if (peersRef.current[member.id]) {
          peersRef.current[member.id].close();
          delete peersRef.current[member.id];
        }
      });
    };

    checkAndInit();

    return () => {
      const pusher = getPusherClient();
      if (pusher) pusher.unsubscribe(`presence-room-${roomId}`);

      // Cleanup WebRTC connections
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, router, createPeerConnection]);

  // Periodic Vision check
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
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const toggleMeEliminate = () => {
    const newVal = !isMeEliminated;
    setIsMeEliminated(newVal);
    channelRef.current?.trigger("client-player-eliminated", {
      target: myId,
      isEliminated: newVal,
    });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-slate-100 overflow-hidden font-sans">
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

        {/* Local Player */}
        <div className="flex flex-col gap-1">
          <div
            className={`relative rounded-xl overflow-hidden bg-black aspect-video transition-all duration-300 ${isMeEliminated ? "border-4 border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "border-2 border-slate-700"}`}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isMeEliminated ? "grayscale opacity-50" : ""}`}
            />
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 text-xs rounded z-10 text-white flex gap-2 items-center">
              Bạn ({myInfo?.name})
              {isMeEliminated && (
                <span className="text-[10px] text-red-500 font-bold uppercase">
                  Bị loại
                </span>
              )}
            </div>
            {isMeEliminated && (
              <div className="absolute inset-0 bg-red-900/20 pointer-events-none z-20"></div>
            )}

            {/* Dev toggle */}
            <button
              onClick={toggleMeEliminate}
              className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-[10px] px-2 py-1 rounded z-30"
            >
              {isMeEliminated ? "Đã loại" : "Loại Tôi"}
            </button>
          </div>
        </div>

        {/* Remote Players */}
        <div className="flex-1 overflow-y-auto mt-4 px-1">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
            Người chơi (#Ẩn danh)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(players).map((p) => (
              <VideoPlayer
                key={p.id}
                stream={remoteStreams[p.id]}
                name={`Người chơi ??? / ${p.name}`}
                isEliminated={p.isEliminated}
              />
            ))}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

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
