# Hướng dẫn FE: Quản lý User (Khóa / Mở khóa)

> **Lưu ý quan trọng:** Không dùng `DELETE /users/:id` để xóa user vì sẽ gây lỗi **Foreign key constraint** nếu user đó đã có đơn hàng, đánh giá, v.v. Thay vào đó dùng `PUT /users/:id` để đổi trạng thái.

---

## 1. Khóa tài khoản (thay cho "Xóa")

```
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body:**
```json
{ "status": "BANNED" }
```

**Response 200:**
```json
{
  "statusCode": 200,
  "message": "User updated successfully",
  "data": {
    "id": "uuid",
    "fullName": "Nguyen Van A",
    "email": "a@example.com",
    "status": "BANNED",
    ...
  }
}
```

**Sau khi gọi API:**
- Trạng thái user chuyển thành `BANNED`
- Hệ thống tự động gửi notification đến user: *"Tài khoản của bạn đã bị khóa"*
- User bị khóa **không thể đăng nhập**
- Toàn bộ lịch sử đơn hàng, đánh giá **được giữ nguyên**

---

## 2. Mở khóa tài khoản

```
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body:**
```json
{ "status": "ACTIVE" }
```

**Sau khi gọi API:**
- Trạng thái user chuyển thành `ACTIVE`
- Hệ thống tự động gửi notification đến user: *"Tài khoản của bạn đã được mở khóa"*
- User có thể đăng nhập lại bình thường

---

## 3. Bảng trạng thái

| Status | Ý nghĩa | Đăng nhập được? |
|--------|---------|-----------------|
| `ACTIVE` | Hoạt động bình thường | Có |
| `INACTIVE` | Chưa kích hoạt | Không |
| `BANNED` | Bị khóa bởi Admin | Không |

---

## 4. Gợi ý UI

Thay nút **"Xóa" (đỏ)** bằng 2 nút tùy theo trạng thái hiện tại:

```
Nếu user.status === "ACTIVE"  → hiện nút "Khóa"  → gọi PUT { status: "BANNED" }
Nếu user.status === "BANNED"  → hiện nút "Mở khóa" → gọi PUT { status: "ACTIVE" }
```

---

## 5. Phân quyền

| Role | Có thể khóa/mở khóa ai |
|------|------------------------|
| `ADMIN` | Tất cả role thấp hơn (MANAGER, OPERATION, STAFF, CUSTOMER) |
| `MANAGER` | OPERATION, STAFF, CUSTOMER |
| `OPERATION` | Không có quyền |
| `STAFF` | Không có quyền |

> Admin **không thể tự khóa chính mình**.
