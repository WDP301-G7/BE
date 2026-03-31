# Hướng dẫn: Tính năng Xác nhận đã nhận hàng (Confirm Receipt)

Tài liệu này hướng dẫn cách tích hợp tính năng xác nhận đã nhận hàng cho phía **Front-end (FE)** và **Mobile (MO)**. Tính năng này cho phép khách hàng chủ động kết thúc đơn hàng khi nhận được hàng tận nơi.

---

### 1. Thông tin API
*   **Endpoint:** `POST /api/orders/{orderId}/confirm-receipt`
*   **Method:** `POST`
*   **Authentication:** Yêu cầu Bearer Token của Khách hàng (`CUSTOMER`).
*   **Mô tả:** Khi khách hàng bấm xác nhận, đơn hàng sẽ chuyển sang `COMPLETED`, kho hàng sẽ được tự động trừ tương ứng.

---

### 2. Điều kiện hiển thị Nút trên UI
Để đảm bảo logic hoạt động đúng, nút **"Đã nhận hàng"** chỉ nên hiển thị khi thỏa mãn tất cả các điều kiện sau từ Backend:

1.  `deliveryMethod === 'HOME_DELIVERY'` (Chỉ đơn ship tận nhà mới có nút).
2.  `status === 'READY'` (Nhân viên đã đóng gói xong và báo Shipper).
3.  `paymentStatus === 'PAID'` (Đã thanh toán 100%).

---

### 3. Quy trình thực hiện (Workflow Demo)

1.  **Staff (Bạn)**: Bấm "Sẵn sàng" trên Dashboard. 
    *   Hệ thống gọi GHN lấy mã vận đơn. 
    *   Trạng thái đơn nhảy sang `READY`.
2.  **Customer (Bạn)**: Mở App/Web của Khách hàng -> Thấy nút "Đã nhận hàng".
3.  **Customer (Bạn)**: Bấm xác nhận.
4.  **Hệ Thống**:
    *   Đổi trạng thái đơn sang `COMPLETED`.
    *   Tự động trừ số lượng sản phẩm trong kho.
    *   Gửi thông báo "Khách đã nhận hàng" cho Nhân viên.

---

### 4. Xử lý lỗi (Error Handling)
FE cần xử lý các mã lỗi nếu khách gọi API sai:

- **400 Bad Request**: "Chỉ đơn hàng giao tận nơi mới có thể chủ động xác nhận nhận hàng."
- **403 Forbidden**: Không phải chính chủ đơn hàng.
- **404 Not Found**: Đơn hàng không tồn tại.

---

> [!TIP]
> **Demo:** Khi demo, bạn không cần dùng script terminal nữa. Bạn chỉ cần click nút "Sẵn sàng" bên Staff rồi sang màn hình Khách hàng bấm "Đã nhận hàng" là xong luồng SHIP.
