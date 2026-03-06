# Dự án Ma Sói AI (Werewolf AI Game Master)

Dự án này là một ứng dụng Web chơi game Ma Sói trực tuyến, nơi quản trò là một Trí tuệ Nhân tạo (Claude AI) hoàn toàn tự động bằng Tiếng Việt. Ứng dụng tích hợp Camera, Microphone, trò chuyện thời gian thực và công nghệ nhận diện khuôn mặt để chống gian lận.

---

## 1. Hướng Dẫn Sử Dụng (Dành Cho Người Chơi & Cài Đặt)

### Cài đặt Biến Môi Trường (.env.local)

Hiện tại file `.env.local` của bạn chưa được điền đầy đủ các thông số của Pusher. Để tính năng Multiplayer hoạt động, bạn cần đăng ký [Pusher.com](https://pusher.com), tạo một kênh (Channels) và điền các thông tin sau:

```env
ANTHROPIC_API_KEY=sk-ant-api... (Đã điền đúng)
PUSHER_APP_ID=<ID_app_của_bạn>
PUSHER_KEY=<Key_của_bạn> (Bạn đã điền ở dòng 3 nhưng dòng 5 NEXT_PUBLIC_PUSHER_KEY chưa khớp)
PUSHER_SECRET=<Secret_của_bạn>
NEXT_PUBLIC_PUSHER_KEY=<Key_của_bạn_phải_giống_dòng_3>
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
```

_(Lưu ý: Bạn phải sửa `NEXT_PUBLIC_PUSHER_KEY` cho giống với `PUSHER_KEY` thì phía giao diện (Client) mới kết nối được)._

### Cách Chạy Project

1. Mở Terminal tại thư mục project và chạy lệnh cài đặt (nếu chưa): `pnpm install`
2. Khởi động server lập trình: `pnpm dev`
3. Mở trình duyệt và truy cập: `http://localhost:3000`

### Luồng Trải Nghiệm Người Chơi

1. **Màn hình Đăng Nhập (`/`)**:
   - Nhập tên của bạn.
   - Trình duyệt sẽ yêu cầu quyền truy cập Camera & Microphone.
   - Nhấn **chụp ảnh** để làm Avatar (Ảnh tĩnh).
   - Nhấn "VÀO PHÒNG CHƠI".
2. **Trong Phòng Chơi (`/room/[id]`)**:
   - **Giao diện bên trái**: Bạn sẽ thấy Camera trực tiếp của mình. Các người chơi khác khi tham gia sẽ hiện dưới dạng "Ẩn danh" (ảnh bị làm mờ xám) cho đến khi trò chơi có kết quả.
   - **Chống Gian Lận (AI Vision)**: Cứ mỗi 15 giây, hệ thống sẽ ngầm chụp 1 tấm ảnh từ Camera của bạn và gửi cho AI đếm số người. Nếu có nhiều hơn 1 khuôn mặt, một Thông Báo Đỏ cảnh báo gian lận sẽ xuất hiện.
   - **Khung Chat Quản Trò (Bên phải)**: Bạn dùng khung chat này để tương tác với AI Claude. Chỉ cần gõ tiếng Việt (VD: "Bắt đầu", "Tôi là Sói, tôi muốn giết người số 2"). AI sẽ phản hồi, điều hành cốt truyện và thực thi luật chơi.

---

## 2. Tổng Quát Luồng Hoạt Động (Architecture Flow)

Ứng dụng được xây dựng trên **Next.js 16 (App Router)**, kết hợp **TailwindCSS**, **Pusher (Realtime)** và **Anthropic Claude AI (AI SDK)**.

### A. Luồng Đăng nhập & Lưu dữ liệu (Client-side)

1. Tại `src/app/page.tsx`, component `CameraCapture` dùng `navigator.mediaDevices.getUserMedia()` để lấy luồng Video.
2. Khi người dùng bấm chụp, frame hiện tại được vẽ ra một thẻ `<canvas>` ẩn và chuyển thành chuỗi Base64 (`image/jpeg`).
3. Tên và Avatar (Base64) được lưu trữ vào `localStorage` của trình duyệt. Sau đó chuyển hướng người dùng sang `src/app/room/[id]/page.tsx`.

### B. Luồng Realtime Multiplayer (Pusher)

1. Khi vào phòng (`RoomPage`), hệ thống gọi API cấp quyền `/api/pusher/auth` để cho phép người dùng vào Kênh Hiện Diện (Presence Channel: `presence-room-[id]`).
2. Kênh Presence cho phép P2P nhận biết khi có ai ra/vào.
3. Khi bạn tham gia thành công, hệ thống sẽ trigger sự kiện Client `client-player-joined` và gửi Tên + Avatar (Base64) của bạn cho các thiết bị khác trong phòng.
4. Các thiết bị khác nhận được thông tin, lưu vào list `players` nhưng hiển thị giả danh trên màn hình để bảo vệ danh tính (luật Ma Sói).

### C. Luồng Quản Trò AI (AI Game Master)

1. Trong phòng có 1 giao diện Chat. Giao diện này dùng hooks `useChat` kết nối với API `/api/ai/game-master/route.ts`.
2. Dữ liệu tin nhắn được gửi lên Server theo mảng (Array).
3. Server ghép tin nhắn vào một **System Prompt** được thiết kế đặc biệt, ép buộc Claude phải hóa vai thành Quản Trò, quản lý ban ngày ban đêm, chỉ nói tiếng Việt.
4. Claude xử lý toàn bộ logic luật Ma Sói theo ngôn ngữ tự nhiên và Server trả về Text Stream (truyền phát chữ liên tục) xuống giao diện Chat.

### D. Luồng Chống Gian Lận Bằng AI Vision (Human Detection)

1. Trong `RoomPage`, có một `useEffect` chạy vòng lặp `setInterval` mỗi 15 giây.
2. Vòng lặp lấy khung hình từ thẻ `<video>`, vẽ lên `<canvas>` và tạo chuỗi hình Base64 độ phân giải nén.
3. Hình ảnh được gửi POST đến API `/api/ai/detect-humans/route.ts`.
4. API Server nhận hình, đóng gói theo format nhúng ảnh của Claude SDK, gửi đến `claude-3-5-sonnet` với câu lệnh: "Đếm số người trong hình".
5. Lấy số lượng người (`count`) từ định dạng văn bản sang số nguyên (Integer). Trả ngược về Client.
6. Client kiểm tra `count > 1` để thay đổi State UI và bật Cảnh báo Đỏ.

---

**Tóm lại:** Frontend làm nhiệm vụ trung tâm kết nối luồng Media của thiết bị. Pusher đồng bộ Avatar người chơi. Claude AI đảm nhiệm hai vai trò cực lớn: (1) Trái tim/Logic Quản Trò làm bằng NLP (Xử lý Ngôn ngữ), (2) Trọng tài chống gian lận dùng Vision.
