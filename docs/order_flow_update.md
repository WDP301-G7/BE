# Hướng dẫn Luồng Đơn hàng mới (Order Flow Update)

Sau khi điều chỉnh luồng để hỗ trợ thanh toán 100% trước và tích hợp Giao Hàng Nhanh (GHN), FE/MO cần thực hiện theo đúng các bước sau để đảm bảo hệ thống vận hành chính xác.

## 1. Thay đổi cốt lõi (Core Changes)

1. **Thanh toán 100% trước**: Tất cả đơn hàng trực tuyến đều yêu cầu thanh toán đầy đủ 100% trước khi được xác nhận (`CONFIRMED`). Hệ thống không còn hỗ trợ COD tại nhà (trừ đơn Pickup tại tiệm thanh toán tiền mặt).
2. **Giao tận nhà (HOME_DELIVERY)**: Chỉ áp dụng cho đơn hàng mua **Gọng kính lẻ**. Đơn hàng có Tròng kính bắt buộc phải chọn **Nhận tại tiệm (PICKUP_AT_STORE)** để đo khám và mài lắp.
3. **Tích hợp GHN**: Hệ thống tự động tính phí ship và đẩy đơn sang GHN khi xử lý xong (Trạng thái `READY`).

---

## 2. Các quy tắc quan trọng FE/MO cần tuân thủ

### 2.1 Khi tạo đơn hàng (`POST /orders`)
- **Delivery Method**: Gửi `HOME_DELIVERY` hoặc `PICKUP_AT_STORE`.
- **Thông tin giao hàng**: Nếu chọn `HOME_DELIVERY`, FE/MO **BẮT BUỘC** gửi thêm các trường sau để tính phí ship:
  - `shippingProvinceId` (ID tỉnh/thành)
  - `shippingDistrictId` (ID quận/huyện)
  - `shippingWardCode` (Mã phường/xã)
  - `shippingAddress` (Địa chỉ chi tiết)
- **Validation**: FE nên chặn việc chọn `HOME_DELIVERY` nếu trong giỏ hàng có sản phẩm loại `LENS`.

### 2.2 Quy trình thanh toán (`POST /api/payments/:orderId/create`)
1. User nhấn "Đặt hàng" -> Gọi `POST /orders` -> Nhận `orderId`.
2. Chuyển hướng user đến trang thanh toán:
   - Gọi `POST /api/payments/:orderId/create` -> Nhận `paymentUrl`.
   - Mở trình duyệt/webview để user thanh toán qua VNPay.
3. **Handle Return**: Sau khi user thanh toán xong, phía Backend sẽ tự động cập nhật trạng thái đơn hàng sang `CONFIRMED` thông qua Webhook (IPN). FE chỉ cần lắng nghe socket (event `notification`) hoặc poll status đơn hàng để thông báo thành công cho user.

### 2.3 Quản lý trạng thái (Order Status)
Luồng trạng thái mới cho đơn hàng Online:
- `NEW`: Chờ thanh toán.
- `CONFIRMED`: Đã thanh toán, hệ thống đang giữ chỗ sản phẩm.
- `WAITING_CUSTOMER`: Đã đặt lịch hẹn (cho đơn Lens) hoặc đang chờ gom hàng.
- `PROCESSING`: Nhân viên đang đóng gói/mài lắp.
- `READY`: Đã xong.
  - Nếu là `HOME_DELIVERY`: Đã giao cho GHN, kèm theo `trackingNumber`.
  - Nếu là `PICKUP_AT_STORE`: Chờ khách đến lấy.
- `COMPLETED`: Khách đã nhận hàng thành công.

---

## 3. Cách lấy dữ liệu Hành chính (Province/District/Ward)

Để đảm bảo ID đồng nhất với hệ thống GHN, FE/MO nên gọi các API sau để hiển thị dropdown địa chỉ:
- `GET /api/logistics/provinces`: Lấy danh sách Tỉnh/Thành.
- `GET /api/logistics/districts?provinceId=...`: Lấy Quận/Huyện.
- `GET /api/logistics/wards?districtId=...`: Lấy Phường/Xã.

---

## 4. Xác nhận nhận hàng tại tiệm (Dành cho MO - App Nhân viên)
Khi khách đến lấy hàng (`PICKUP_AT_STORE`), nhân viên cần:
1. Scan QR hoặc nhập `orderId`.
2. Gọi `GET /orders/:id/verify-pickup?phone=...` (Nhập số điện thoại khách).
3. Nếu `verified: true`, thực hiện nhấn "Hoàn thành đơn hàng" để cập nhật kho.
