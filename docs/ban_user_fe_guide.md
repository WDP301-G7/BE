# Hướng dẫn: Tính năng Khóa / Mở khóa User

> **Dành cho:** Frontend Team & Mobile (MO)

---

## Tổng quan

Khi Admin khóa tài khoản (`BANNED`):
- User **bị chặn ngay lập tức** ở mọi API call tiếp theo
- BE trả về `401` kèm message rõ ràng
- FE/MO cần bắt lỗi này và **tự động logout user**

---

## Phần 1 — ADMIN (Web Dashboard)

### 1.1 Khóa tài khoản

Thay nút **"Xóa"** bằng nút **"Khóa"**:

```
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "status": "BANNED" }
```

**Response 200** — thành công:
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "fullName": "Nguyen Van A",
    "status": "BANNED"
  }
}
```

### 1.2 Mở khóa tài khoản

```
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "status": "ACTIVE" }
```

### 1.3 Gợi ý hiển thị nút theo trạng thái

```javascript
// Hiển thị nút tùy theo status hiện tại của user
if (user.status === 'ACTIVE') {
  // Hiện nút "Khóa" màu đỏ
  // onClick → PUT { status: "BANNED" }
} else if (user.status === 'BANNED') {
  // Hiện nút "Mở khóa" màu xanh
  // onClick → PUT { status: "ACTIVE" }
}
```

---

## Phần 2 — FE / MO (App của User)

### 2.1 Thêm interceptor bắt lỗi 401

Khi user bị ban, **mọi API call** đều trả về `401`. FE/MO phải bắt và tự logout.

**React Native (axios):**
```javascript
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const message = error.response?.data?.message ?? '';

      // Hiển thị thông báo nếu bị khóa
      if (message.includes('bị khóa')) {
        Alert.alert(
          'Tài khoản bị khóa',
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.',
        );
      }

      // Xóa token và về màn hình login
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    return Promise.reject(error);
  }
);
```

**Web (axios):**
```javascript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const message = error.response?.data?.message ?? '';

      if (message.includes('bị khóa')) {
        toast.error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.');
      }

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2.2 Các message 401 từ BE

| Message | Nguyên nhân | Hành động FE/MO |
|---------|-------------|-----------------|
| `"Tài khoản của bạn đã bị khóa..."` | Admin đã ban | Hiện alert + logout |
| `"Tài khoản chưa được kích hoạt"` | Status INACTIVE | Hiện thông báo + logout |
| `"No token provided"` | Không có token | Redirect login (không cần toast) |
| `"User not found"` | Token cũ, user bị xóa | Xóa token + redirect login |

---

## Phần 3 — Luồng hoàn chỉnh

```
Admin bấm "Khóa" trên dashboard
        │
        ▼
PUT /api/users/:id { status: "BANNED" }
        │
        ▼
BE đổi status → BANNED trong DB
BE gửi notification đến user: "Tài khoản bị khóa"
        │
        ▼
User gọi bất kỳ API nào tiếp theo
        │
        ▼
authMiddleware kiểm tra DB → status = BANNED
→ Trả về 401: "Tài khoản của bạn đã bị khóa"
        │
        ▼
FE/MO bắt 401 → hiện alert → xóa token → về màn login
```

---

## Phần 4 — Test nhanh

1. Đăng nhập bằng tài khoản customer → giữ token
2. Admin vào dashboard → khóa tài khoản đó
3. Dùng token cũ gọi `GET /api/auth/profile`
4. Kết quả phải là `401` với message "Tài khoản của bạn đã bị khóa"
5. Mở khóa lại → gọi lại API → phải trả về `200` bình thường
