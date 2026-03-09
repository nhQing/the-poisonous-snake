import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(req: Request) {
    try {
        const { players, roomId } = await req.json();

        if (!players || !Array.isArray(players) || players.length < 3) {
            return NextResponse.json({ error: "Cần tối thiểu 3 người chơi để bắt đầu" }, { status: 400 });
        }

        const systemPrompt = `
      Bạn là quản trò của trò chơi Ma Sói. Hiện tại có ${players.length} người chơi tham gia.
      Hãy phân bổ vai trò (Sói, Dân làng, Tiên tri, Bảo vệ, ...) sao cho cân bằng nhất với số lượng này. Các vai trò cơ bản cần có Sói và Dân Làng.
      
      Danh sách ID người chơi: ${players.join(", ")}.
      
      Nhiệm vụ: Trả về một đối tượng JSON thuần túy (KHÔNG CÓ MARKDOWN, KHÔNG CÓ BẤT KỲ ĐOẠN TEXT NÀO KHÁC).
      Ví dụ định dạng cần trả về chính xác như sau:
      {
        "roles": {
          "id_nguoi_choi_1": "Sói",
          "id_nguoi_choi_2": "Tiên tri",
          "id_nguoi_choi_3": "Dân làng"
        },
        "message": "Trời đã tối, ngôi làng sương mù chìm trong tĩnh lặng. Ma Sói đã xuất hiện giữa chúng ta... Trò chơi bắt đầu!"
      }
    `;

        const { text } = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            prompt: systemPrompt,
        });

        let parsedData;
        try {
            const jsonStr = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
            parsedData = JSON.parse(jsonStr);
        } catch (e) {
            console.error(e, text);
            return NextResponse.json({ error: "Lỗi tạo kịch bản từ AI" }, { status: 500 });
        }

        // Trigger the game started event with roles via Pusher Server
        await pusherServer.trigger(`presence-room-${roomId}`, "game-started", {
            roles: parsedData.roles,
            message: parsedData.message
        });

        return NextResponse.json({ success: true, count: players.length });
    } catch (error) {
        console.error("Init game error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
