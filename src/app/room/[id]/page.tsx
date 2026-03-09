"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { Users, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";

interface Player {
  id: string;
  name: string;
  avatarStr: string;
  isEliminated?: boolean;
  isReady?: boolean;
  role?: string;
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
  const [isReady, setIsReady] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);

  const [personCount, setPersonCount] = useState<number>(1);
  const [visionWarning, setVisionWarning] = useState("");

  const [messages, setMessages] = useState<
    { id: string; role: string; content: string }[]
  >([
    {
      id: "1",
      role: "assistant",
      content:
        'Chào mừng các bạn đến với ngôi làng sương mù. Trò chơi Ma Sói chuẩn bị bắt đầu. Nhấn "Sẵn sàng" để điểm danh.',
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current!));
      } else {
        // If local user has no camera (permission denied/locked), force WebRTC to still RECEIVE remote videos
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
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

      pc.ontrack = (event) =>
        setRemoteStreams((prev) => ({ ...prev, [targetId]: event.streams[0] }));

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            channelRef.current.trigger("client-webrtc-offer", {
              target: targetId,
              offer: pc.localDescription,
              sender: myIdStr,
              senderProfile: myInfo,
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
    const avatar = localStorage.getItem("playerAvatar") || "default";
    if (!name) {
      router.push("/");
      return;
    }
    const info = { name, avatar };
    setMyInfo(info);

    const checkAndInit = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            "Trình duyệt không hỗ trợ Camera (hoặc không ở môi trường HTTPS bảo mật).",
          );
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (e: any) {
          console.warn("Lỗi khi lấy cả hình+tiếng, thử chỉ lấy hình...", e);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        localStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err: any) {
        console.error("Cant access camera", err);
        let errorReason = err.message || err.name;
        if (err.name === "NotReadableError")
          errorReason = "Camera đang bị ứng dụng hoặc tab khác chiếm dụng.";
        else if (err.name === "NotAllowedError")
          errorReason = "Bạn đã từ chối quyền truy cập Camera.";
        else if (err.name === "NotFoundError")
          errorReason = "Không tìm thấy thiết bị Camera nào trên máy.";
        alert(
          `Cảnh báo: Không thể bật Camera của bạn!\nLý do: ${errorReason}\n(Bạn vẫn có thể nhìn thấy người khác)`,
        );
      }

      const pusher = getPusherClient();
      if (!pusher) return;

      const channel = pusher.subscribe(`presence-room-${roomId}`);
      channelRef.current = channel;

      channel.bind("pusher:subscription_succeeded", (members: any) => {
        const id = members.myID;
        setMyId(id);
        channel.trigger("client-player-joined", {
          name: info.name,
          avatarStr: info.avatar,
          id: id,
          isReady: false,
        });
      });

      channel.bind("client-player-joined", (data: Player) => {
        setPlayers((prev) => ({ ...prev, [data.id]: data }));
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
              ...prev[data.sender],
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
        if (pc && pc.signalingState !== "stable")
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      });

      channel.bind("client-webrtc-candidate", async (data: any) => {
        if (data.target !== (channel as any).members.myID) return;
        const pc = peersRef.current[data.sender];
        // @ts-ignore
        if (pc && pc.remoteDescription)
          await pc
            .addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch((e) => console.warn(e));
      });

      channel.bind("client-player-eliminated", (data: any) => {
        if (data.target === (channel as any).members.myID)
          setIsMeEliminated(data.isEliminated);
        else
          setPlayers((prev) => ({
            ...prev,
            [data.target]: {
              ...prev[data.target],
              isEliminated: data.isEliminated,
            },
          }));
      });

      channel.bind("client-player-ready", (data: any) => {
        setPlayers((prev) => ({
          ...prev,
          [data.target]: { ...prev[data.target], isReady: data.isReady },
        }));
      });

      channel.bind("game-started", (data: any) => {
        setGameStarted(true);
        if (data.roles && data.roles[(channel as any).members.myID]) {
          setMyRole(data.roles[(channel as any).members.myID]);
        }
        if (data.message) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: data.message,
            },
          ]);
        }
      });

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
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      if (localStreamRef.current)
        localStreamRef.current.getTracks().forEach((track) => track.stop());
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
          if (data.count > 1)
            setVisionWarning(`Phát hiện ${data.count} người trên camera!`);
          else if (data.count === 0)
            setVisionWarning("Không phát hiện người trên camera!");
          else setVisionWarning("");
        }
      } catch (err) {
        console.error("Vision check failed", err);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleReady = () => {
    const newVal = !isReady;
    setIsReady(newVal);
    channelRef.current?.trigger("client-player-ready", {
      target: myId,
      isReady: newVal,
    });
  };

  const startGameHelper = async () => {
    if (!gameStarted) {
      // Everyone is ready! Just trigger the init endpoint (only one client should do this ideally, e.g. the first one)
      const allIds = [myId, ...Object.keys(players)].sort();
      if (allIds[0] === myId) {
        // I am the host
        try {
          const res = await fetch("/api/ai/init-game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ players: allIds, roomId }),
          });
          // We rely on the endpoint to broadcast client-game-started via server Pusher, or client does it.
          // Actually, server Pusher is better to avoid trusting the client.
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Check if all players are ready
  useEffect(() => {
    const allPlayersList = Object.values(players);
    const othersReadyCount = allPlayersList.filter((p) => p.isReady).length;
    const totalPlayers = allPlayersList.length + 1;

    if (
      totalPlayers >= 3 &&
      isReady &&
      othersReadyCount === allPlayersList.length
    ) {
      startGameHelper();
    }
  }, [isReady, players, gameStarted, myId, roomId]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-slate-100 overflow-hidden font-sans">
      {/* ---------------- LEFT PANEL: Scrollable Video Grid ---------------- */}
      <div className="w-1/3 flex-shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900 p-4 gap-4 overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900/90 backdrop-blur-sm z-30 pb-2 mb-2 flex flex-col gap-2">
          <h2 className="text-xl font-bold flex items-center justify-between">
            <span className="text-red-500">Phòng {roomId}</span>
            <span className="text-xs bg-zinc-800 px-2 py-1 rounded-lg flex items-center gap-2">
              <Users size={14} /> {Object.keys(players).length + 1}
            </span>
          </h2>
          {visionWarning && (
            <div className="bg-red-900/40 border border-red-500/50 text-red-200 text-xs px-3 py-2 rounded flex gap-2 items-center">
              <AlertTriangle size={14} /> {visionWarning}
            </div>
          )}
        </div>

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
            {isReady && (
              <div className="absolute top-2 left-2 text-green-500 bg-black/50 rounded-full p-1 z-10">
                <CheckCircle2 size={16} />
              </div>
            )}
            {isMeEliminated && (
              <div className="absolute inset-0 bg-red-900/20 pointer-events-none z-20"></div>
            )}
          </div>
        </div>

        {/* Remote Players */}
        {Object.values(players).map((p) => (
          <div key={p.id} className="relative">
            <VideoPlayer
              stream={remoteStreams[p.id]}
              name={`Người chơi ??? / ${p.name}`}
              isEliminated={p.isEliminated}
            />
            {p.isReady && (
              <div className="absolute top-2 left-2 text-green-500 bg-black/50 rounded-full p-1 z-10">
                <CheckCircle2 size={16} />
              </div>
            )}
          </div>
        ))}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* ---------------- RIGHT PANEL: Actions + Chat ---------------- */}
      <div className="w-2/3 flex flex-col bg-zinc-950">
        {/* TOP RIGHT: Action Buttons (RA) */}
        <div className="h-1/3 min-h-[250px] border-b border-zinc-800 bg-zinc-900 p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-300 mb-4 border-b border-zinc-700 pb-2">
            Bảng điều khiển (Actions)
          </h3>

          <div className="flex-1 flex flex-col justify-center items-center gap-4">
            {!gameStarted ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-zinc-400 text-sm mb-2 text-center">
                  Chờ mọi người nhấn Sẵn Sàng để Quản Trò AI bắt đầu phân tích
                  và chia vai.
                  <br />
                  (Yêu cầu tối thiểu 3 người)
                </p>
                <button
                  onClick={toggleReady}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center gap-2 ${isReady ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {isReady ? (
                    <>
                      <CheckCircle2 /> Đã Sẵn Sàng
                    </>
                  ) : (
                    "Nhấn Sẵn Sàng"
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col w-full px-8">
                {myRole ? (
                  <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex justify-between items-center mb-6">
                    <div>
                      <span className="text-zinc-400 text-xs uppercase tracking-wider">
                        Vai trò của bạn
                      </span>
                      <div className="text-2xl font-bold text-red-500 mt-1">
                        {myRole}
                      </div>
                    </div>
                    <ShieldAlert className="text-red-500 w-10 h-10 opacity-50" />
                  </div>
                ) : (
                  <div className="text-zinc-400 text-center animate-pulse">
                    Đang phân vai...
                  </div>
                )}

                {/* Future role-specific buttons go here */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button className="bg-zinc-800 hover:bg-zinc-700 py-3 rounded-lg border border-zinc-700 text-sm font-semibold opacity-50 cursor-not-allowed">
                    Hành động của Sói (Sắp có)
                  </button>
                  <button className="bg-zinc-800 hover:bg-zinc-700 py-3 rounded-lg border border-zinc-700 text-sm font-semibold opacity-50 cursor-not-allowed">
                    Bỏ phiếu (Sắp có)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM RIGHT: AI Chat (RB) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 bg-zinc-900 shadow-sm border-b border-zinc-800">
            <h2 className="text-md font-bold text-slate-100 flex items-center gap-2">
              Kênh Chat Quản Trò{" "}
              <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Claude AI
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-zinc-800 border border-zinc-700 text-slate-200 rounded-bl-none shadow-md"}`}
                >
                  {m.role === "assistant" && (
                    <div className="text-red-400 text-[10px] font-bold mb-1 uppercase tracking-wider">
                      Quản Trò AI
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-5 py-3 bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-none text-zinc-500 flex gap-2 items-center text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse delay-75"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse delay-150"></span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0"
          >
            <div className="relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Nhắn với quản trò (Vd: Tôi muốn soi người số 2)..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 pr-16 text-sm text-slate-200 focus:outline-none focus:border-red-500 transition-colors placeholder-zinc-600"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1.5 bottom-1.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg px-3 text-sm font-semibold transition-colors"
              >
                Gửi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
