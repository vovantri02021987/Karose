# Danh Mục Sản Phẩm Mỹ Phẩm Thiên Nhiên Karose

Tài liệu cơ sở dữ liệu sản phẩm chuẩn hóa phục vụ xây dựng website bán hàng (Next.js / React) và quản lý nội dung.

## 1. Bảng tổng hợp danh mục sản phẩm

| Mã SKU | Tên sản phẩm | Danh mục | Dung tích / Quy cách | Thành phần chính | Công dụng nổi bật | Giá bán tham khảo (VNĐ) | Ghi chú hình ảnh & Đường dẫn chuẩn |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KR-TN-01** | Nước hoa hồng Karose (Karose Toner) | Chăm sóc da mặt | Chai thủy tinh 100ml | Nước cất hoa hồng nhung cổ hữu cơ 100% | Cân bằng độ pH, cấp ẩm dịu nhẹ, làm dịu da, se khít lỗ chân lông | 250.000 | Chai thủy tinh tối màu, vòi xịt phun sương, nhãn trắng/hồng nhạt (`/images/products/KR-TN-01.jpg`) |
| **KR-SR-01** | Dầu dưỡng da Karose (Karose Face Oil / Serum) | Chăm sóc da mặt | Chai thủy tinh 30ml | Dầu hạt nho, dầu tầm xuân, tinh dầu hoa hồng | Dưỡng ẩm sâu, chống lão hóa, phục hồi hàng rào bảo vệ da | 380.000 | Chai thủy tinh nhỏ giọt (pipette), dung dịch màu vàng nhạt (`/images/products/KR-SR-01.jpg`) |
| **KR-CL-01** | Sữa rửa mặt thảo mộc Karose | Làm sạch da | Chai 100ml | Chiết xuất bồ hòn, nước hoa hồng, tinh dầu thiên nhiên | Làm sạch dịu nhẹ, không chứa sulfate, không gây khô căng | 220.000 | Chai vòi nhấn (pump), kết cấu dạng gel/lỏng nhẹ (`/images/products/KR-CL-01.jpg`) |
| **KR-LP-01** | Son dưỡng môi hoa hồng Karose | Chăm sóc môi | Thỏi 5g | Sáp ong, bơ hạt mỡ, dầu dừa, chiết xuất cánh hoa hồng | Dưỡng ẩm môi, giảm thâm, làm mềm môi nứt nẻ | 120.000 | Thỏi son vỏ giấy kraft hoặc vỏ nhựa tối giản, chất son hồng nhạt tự nhiên (`/images/products/KR-LP-01.jpg`) |
| **KR-HC-01** | Dầu gội thảo dược Karose | Chăm sóc tóc | Chai 250ml / 500ml | Bồ kết, hương nhu, vỏ bưởi, sả chanh, cỏ mần trầu | Làm sạch gàu, giảm rụng tóc, kích thích mọc tóc tự nhiên | 240.000 | Chai dung tích lớn, màu nâu cánh gián đặc trưng của thảo dược nấu (`/images/products/KR-HC-01.jpg`) |
| **KR-HC-02** | Xịt dưỡng tóc tinh dầu bưởi & hoa hồng | Chăm sóc tóc | Chai xịt 100ml | Nước cất hoa hồng, tinh dầu vỏ bưởi | Giảm xơ rối, nuôi dưỡng nang tóc, tạo hương thơm tự nhiên | 180.000 | Chai xịt phun sương, dung dịch trong suốt hoặc hơi đục nhẹ (`/images/products/KR-HC-02.jpg`) |
| **KR-BD-01** | Xà phòng tắm thủ công Karose (Handmade Soap) | Chăm sóc cơ thể | Bánh 100g | Dầu oliu, dầu dừa, nước cốt hoa hồng, cánh hoa hồng khô | Làm sạch da cơ thể, dưỡng ẩm, giữ mùi hương thư giãn | 110.000 | Bánh xà phòng vuông/chữ nhật bọc giấy nến, có lẫn cánh hoa khô (`/images/products/KR-BD-01.jpg`) |
| **KR-TR-01** | Trà hoa hồng hữu cơ Karose | Thực phẩm / Trà | Hộp / Lọ 30g - 50g | Nụ hoa hồng nhung cổ sấy lạnh hữu cơ 100% | Thanh nhiệt, đẹp da, giảm căng thẳng, hỗ trợ tiêu hóa | 190.000 | Lọ thủy tinh hoặc túi zip giấy kraft thấy rõ nụ hoa hồng khô nguyên bông (`/images/products/KR-TR-01.jpg`) |

---

## 2. Quy chuẩn tài nguyên hình ảnh cho Website

* **Thư mục lưu trữ trong Next.js:** `public/images/products/`
* **Quy tắc đặt tên file:** Đặt trùng khớp với mã SKU (ví dụ: `KR-TN-01.jpg`, `KR-TN-01-2.jpg` cho ảnh phụ).
* **Tỷ lệ & Kích thước:** Khung vuông `1:1` (`1000x1000px`), dung lượng tối ưu `< 200KB` (định dạng `.webp` hoặc `.jpg`).
* **Bộ ảnh tiêu chuẩn mỗi sản phẩm:**
  1. Ảnh chính diện sản phẩm trên nền sáng/tối giản.
  2. Ảnh cận cảnh bảng thành phần / nhãn mác.
  3. Ảnh chất sản phẩm (texture / giọt nước / cánh hoa).
  4. Ảnh thực tế khi sử dụng (lifestyle).