# 🧪 TEST HỆ THỐNG ĐỔI TRẢ

## 🚀 Quick Start

### 1. Import Postman Collection
```
File: Returns_System_Flow.postman_collection.json
```

### 2. Chạy Server
```bash
npm run dev
```

### 3. Test Flow

**Bước 1: Setup (Chạy folder "0. Setup")** ⚠️ **BẮT BUỘC**
- Login tất cả roles → Lưu tokens
- Tạo order test → Lưu `test_order_id`, `order_item_id`, `product_id`
- Complete order → Để có thể tạo return request

**Bước 2: Test RETURN (Folder "1. RETURN Flow")**
- Customer tạo yêu cầu trả hàng
- Operation phê duyệt
- Staff hoàn tiền

**Bước 3: Test EXCHANGE (Folder "2. EXCHANGE Flow")**
- Customer đổi Rayban → Gucci
- Operation tính chênh lệch (+500k)
- Staff thu tiền và giao hàng mới

**Bước 4: Test WARRANTY (Folder "3. WARRANTY Flow")**
- Customer báo lỗi
- Operation phê duyệt
- Staff sửa chữa

---

## 📋 Seed Data Có Sẵn

### Users (password: Admin@123)
- `customer@example.com` - CUSTOMER
- `operation@wdp.com` - OPERATION  
- `staff1@wdp.com` - STAFF
- `admin@wdp.com` - ADMIN

### Products
- `00000000-0000-0000-0000-000000000021` - Rayban Classic (300k) - FRAME
- `00000000-0000-0000-0000-000000000022` - Gucci Luxury (800k) - FRAME
- `00000000-0000-0000-0000-000000000023` - Essilor (200k) - LENS

### Stores
- `00000000-0000-0000-0000-000000000011` - Chi nhánh Quận 1

---

## ⚠️ Lưu Ý

### Upload Images:
- Khi test, chọn ảnh từ máy tính trong Postman
- Customer: 1-5 ảnh
- Staff: 0-10 ảnh

### Variables tự động:
- `customer_token`, `operation_token`, `staff_token`, `admin_token`
- `test_order_id`, `order_item_id`, `product_id` ← **Quan trọng!**
- `return_request_id`, `exchange_request_id`, `warranty_request_id`

---

## 🐛 Lỗi Thường Gặp

### ❌ "Sản phẩm không khớp với đơn hàng"
**Nguyên nhân**: `productId` trong field `items` không khớp với `productId` thực tế trong order.

**Cách fix**:
1. ✅ **Chạy folder "0. Setup" ĐẦY ĐỦ** để lưu `{{product_id}}`
2. ✅ Dùng `{{product_id}}` trong field `items`, KHÔNG dùng UUID cố định
3. ✅ Hoặc lấy `productId` từ response của "Create Order"

**Ví dụ đúng**:
```json
[{"orderItemId":"{{order_item_id}}","productId":"{{product_id}}","quantity":1,"condition":"NEW"}]
```

### ❌ "Expected array, received string"
**Nguyên nhân**: Field `items` không đúng format JSON string.

**Cách fix**: Dùng JSON string (không xuống dòng, không khoảng trắng thừa):
```
[{"orderItemId":"uuid","productId":"uuid","quantity":1,"condition":"NEW"}]
```

---

## ✅ Expected Results

| Flow | Status Flow | Inventory | Refund |
|------|------------|-----------|--------|
| RETURN | PENDING → APPROVED → COMPLETED | +1 (nhập lại) | ✅ |
| EXCHANGE | PENDING → APPROVED → COMPLETED | +1 cũ, -1 mới | Chênh lệch |
| WARRANTY | PENDING → APPROVED → COMPLETED | Không đổi | ❌ |

---

🎉 **Ready to test!**
