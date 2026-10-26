# 🎼 A Thousand Years (Pt. 2) - Sheet Nhạc 3 Bè SAT & Web Đồng Bộ Karaoke

Dự án phối khí và ký âm sheet nhạc hợp xướng 3 bè (SAT: Soprano, Alto, Tenor) cho ca khúc **A Thousand Years (Pt. 2)** (Christina Perri ft. Steve Kazee), kèm trang web máy phát nhạc đồng bộ lyric theo chuẩn karaoke và bản in Sheet nhạc khổ A4 tiết kiệm giấy.

---

## 🌟 Tính Năng Nổi Bật

1. **Phân chia 3 Bè Hát Rõ Ràng (SAT):**
   - 🔴 **Nữ 1 (Soprano cao - Christina Perri):** Đảm nhiệm giọng hát chính, các đoạn solo mộc mạc và câu bè cao vút.
   - 🟣 **Nữ 2 (Alto trầm):** Đi bè trầm, nâng đỡ giai điệu, hòa âm ấm áp cùng Nữ 1 trong toàn bộ Verse 1, Pre-Chorus và Điệp khúc.
   - 🔵 **Nam (Tenor cao - Steve Kazee):** Bắt đầu xuất hiện từ Verse 2 (*"Time stands still"* - `t=104.12s`), nghỉ hoàn toàn ở phần đầu bài theo đúng cấu trúc.
   - 🟡 **Tam ca 3 Bè (SAT Polyphony & Climax):** Bùng nổ ở Bridge và Outro với lối hòa âm nhiều lớp (polyphony).

2. **Máy Phát Nhạc Đồng Bộ Thời Gian Thực (Karaoke Style):**
   - Highlight / glow trực tiếp từng nốt nhạc, dấu lặng và lời hát trên khuông nhạc theo 4 màu sắc riêng biệt cho từng giọng.
   - Không dùng khung che hay thanh quét đỏ, mang lại trải nghiệm xem sheet tự nhiên như ứng dụng karaoke chuyên nghiệp.
   - Màn hình HUD lyric hiển thị câu hiện tại, câu trước và câu tiếp theo, đồng bộ mili-giây với bản thu gốc.
   - Hỗ trợ 3 chế độ nguồn phát:
     - 🎤 **Có Lời (Vocal - 300s)**
     - 🎵 **Không Lời (Instrumental Beat - 300s)**
     - 🎬 **Video Gốc (300s)**

3. **Bản In Sheet Nhạc A4 Chuẩn Xác (`download_sheet.html` & PDF):**
   - Thiết kế tinh gọn, vừa khít 7 trang A4 portrait (chiều cao từng trang trong ngưỡng an toàn, không bị tràn hay mất dòng).
   - Đã gỡ bỏ toàn bộ dòng tiêu đề thừa, tối ưu khoảng cách giữa các khuông nhạc để tiết kiệm giấy in.
   - Có sẵn file PDF chất lượng cao để in hoặc tải về: `A_Thousand_Years_Pt2_Sheet_Music_3Be_SAT.pdf`.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Động

### Cách 1: Chạy nhanh bằng file Batch (Windows)
- Bấm đúp vào file `chay_online.bat` (trên Desktop hoặc trong thư mục dự án).
- Trình duyệt sẽ tự động mở trang web local tại: `http://localhost:8765/index.html`.
- Nếu có sẵn `cloudflared.exe`, hệ thống sẽ tự động mở đường hầm Cloudflare Tunnel online để truy cập từ điện thoại.

### Cách 2: Chạy thủ công bằng Python
```bash
python server.py 8765
```
Sau đó truy cập:
- Máy phát nhạc: `http://localhost:8765/index.html`
- Xem & in bản A4: `http://localhost:8765/download_sheet.html`
- Tải file PDF: `http://localhost:8765/A_Thousand_Years_Pt2_Sheet_Music_3Be_SAT.pdf`

---

## 📁 Cấu Trúc Dự Án

```
├── index.html                               # Trang phát nhạc & đồng bộ sheet karaoke trực quan
├── download_sheet.html                      # Trang hiển thị và in Sheet nhạc 7 trang khổ A4
├── A_Thousand_Years_Pt2_Sheet_Music_3Be_SAT.pdf # File PDF sheet nhạc 3 bè chuẩn A4
├── a_thousand_years_pt2.abc                 # File ký âm mã nguồn ABC notation chuẩn
├── app.js                                   # Bộ máy điều khiển phát nhạc & highlight nốt nhạc
├── app.css                                  # Giao diện & hiệu ứng màu phát sáng (glow)
├── data.js                                  # Cơ sở dữ liệu đồng bộ 122 ô nhịp và lyric cards
├── abcjs-basic-min.js                       # Thư viện render ABC notation sang SVG
├── server.py                                # Máy chủ HTTP hỗ trợ Range Request cho audio
├── chay_online.py                           # Tự động hóa khởi động server & tạo tunnel online
├── chay_online.bat                          # File kích hoạt 1-click trên Windows
├── vocal.mp3                                # Bản nhạc có lời (300s)
├── instrumental.mp3                         # Bản nhạc không lời beat (300s)
└── lyrics_video.mp4                         # Bản video lyric gốc (300s)
```

---

## 📜 Giấy Phép (License)
Dự án được phát hành công khai cho mục đích học tập, biểu diễn văn nghệ và phi thương mại.
