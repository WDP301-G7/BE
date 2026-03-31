# Hướng dẫn tích hợp Thông báo (Notification Flow)

Hệ thống thông báo sử dụng kết hợp giữa **REST API** (để quản lý dữ liệu) và **Socket.IO** (để nhận thông báo thời gian thực).

## 1. Kết nối Real-time (Socket.IO)

FE/MO cần kết nối với Server Socket.IO để nhận thông báo ngay lập tức mà không cần reload trang.

- **URL**: `BASE_URL` của Backend (ví dụ: `http://localhost:3000` hoặc domain server).
- **Cơ chế xác thực**: Sau khi kết nối thành công, Client **BẮT BUỘC** gửi event `authenticate` kèm theo Token.

### Các bước thực hiện:
1. **Connect**: Kết nối đến server socket.
2. **Authenticate**: Gửi event `authenticate`.
   ```javascript
   socket.emit('authenticate', { token: 'YOUR_ACCESS_TOKEN' });
   ```
3. **Listen events**:
   - `authenticated`: Nhận phản hồi khi xác thực thành công.
   - `notification`: Nhận đối tượng thông báo mới.
   - `unread_count`: Nhận số lượng thông báo chưa đọc (được gửi ngay khi connect và khi có thay đổi).
   - `auth_error`: Nhận lỗi nếu token không hợp lệ hoặc hết hạn.

### Room Strategy (Server-side handled):
- Mỗi User sẽ được join vào room: `user:{userId}`.
- Mỗi Role sẽ được join vào room: `role:{ROLE}` (ví dụ: `role:CUSTOMER`, `role:STAFF`).

---

## 2. Danh sách REST APIs

Dùng để hiển thị danh sách thông báo và tương tác (đánh dấu đã đọc).

### 2.1 Lấy danh sách thông báo
- **Endpoint**: `GET /notifications`
- **Query params**:
  - `page` (default: 1)
  - `limit` (default: 20)
  - `unreadOnly` (true/false)
- **Response**: Trả về danh sách thông báo phân trang.

### 2.2 Lấy số lượng chưa đọc
- **Endpoint**: `GET /notifications/unread-count`
- **Response**: `{ success: true, data: { count: 5 } }`

### 2.3 Đánh dấu đã đọc (Từng cái)
- **Endpoint**: `PATCH /notifications/:id/read`
- **Description**: Gọi khi user click vào thông báo cụ thể.

### 2.4 Đánh dấu đã đọc tất cả
- **Endpoint**: `PATCH /notifications/read-all`
- **Description**: Gọi khi user chọn "Mark all as read".

---

## 3. Cấu trúc đối tượng Notification
Khi nhận qua Socket hoặc API, một thông báo sẽ có dạng:
```json
{
  "id": "uuid",
  "type": "ORDER_NEW | PAYMENT_SUCCESS | ...",
  "title": "Tiêu đề thông báo",
  "message": "Nội dung chi tiết",
  "data": { "orderId": "..." }, // Dữ liệu đính kèm để điều hướng (deep link)
  "isRead": false,
  "createdAt": "2026-03-31T..."
}
```

---

## 4. Các loại Notification Type (Dùng để điều hướng)
Dựa vào `type` để FE/MO biết nên chuyển hướng user đi đâu:
- `ORDER_...`: Điều hướng đến chi tiết đơn hàng.
- `PAYMENT_...`: Điều hướng đến lịch sử giao dịch/đơn hàng.
- `PRESCRIPTION_...`: Điều hướng đến yêu cầu đo mắt.
- `RETURN_...`: Điều hướng đến yêu cầu đổi trả.
