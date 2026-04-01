# Changelog: Thêm trạng thái `PENDING_PAYMENT`

> **Ngày:** 2026-04-01  
> **Loại thay đổi:** Breaking Change  
> **Ảnh hưởng:** Frontend / Mobile cần cập nhật logic xử lý trạng thái đơn hàng

---

## Vấn đề trước đây

`WAITING_CUSTOMER` bị dùng cho **2 ý nghĩa hoàn toàn khác nhau**:

```
WAITING_CUSTOMER + UNPAID  →  Báo giá prescription, chờ KH thanh toán
WAITING_CUSTOMER + PAID    →  Đã xác nhận + hẹn lịch, chờ STAFF làm
```

FE phải kết hợp thêm `paymentStatus` mới phân biệt được → dễ nhầm lẫn.

---

## Thay đổi

### Trạng thái mới: `PENDING_PAYMENT`

Thay thế `WAITING_CUSTOMER + UNPAID` trong luồng prescription bằng một trạng thái riêng biệt:

| Trước | Sau |
|-------|-----|
| `WAITING_CUSTOMER` + `UNPAID` | ✅ **`PENDING_PAYMENT`** + `UNPAID` |
| `WAITING_CUSTOMER` + `PAID` | `WAITING_CUSTOMER` + `PAID` *(giữ nguyên)* |

---

## Luồng trạng thái Order sau khi cập nhật

```
[Prescription flow]
PENDING_PAYMENT → CONFIRMED → WAITING_CUSTOMER → PROCESSING → READY → COMPLETED
      ↓
   EXPIRED / CANCELLED

[Regular order flow - không thay đổi]
NEW → CONFIRMED → WAITING_CUSTOMER → PROCESSING → READY → COMPLETED
```

---

## FE cần sửa những gì

### 1. Hiển thị label trạng thái

```diff
- WAITING_CUSTOMER  →  "Chờ xử lý" (hoặc "Chờ thanh toán")
+ PENDING_PAYMENT   →  "Chờ thanh toán"   ← THÊM MỚI
+ WAITING_CUSTOMER  →  "Đang chuẩn bị"    ← ĐỔI label
```

### 2. Nút **Thanh toán**

```diff
- const showPayButton = order.status === 'WAITING_CUSTOMER' && order.paymentStatus === 'UNPAID';
+ const showPayButton = order.status === 'PENDING_PAYMENT';
```

### 3. Đếm ngược hết hạn (`expiresAt`)

```diff
- const showCountdown = order.status === 'WAITING_CUSTOMER' && !!order.expiresAt;
+ const showCountdown = order.status === 'PENDING_PAYMENT' && !!order.expiresAt;
```

### 4. Nút **Huỷ đơn**

```diff
- const canCancel = ['NEW', 'CONFIRMED', 'WAITING_CUSTOMER'].includes(order.status);
+ const canCancel = ['NEW', 'PENDING_PAYMENT', 'CONFIRMED', 'WAITING_CUSTOMER'].includes(order.status);
```

### 5. Dropdown filter trạng thái

```diff
  const STATUS_OPTIONS = [
    { value: 'NEW',              label: 'Mới' },
+   { value: 'PENDING_PAYMENT',  label: 'Chờ thanh toán' },   // ← THÊM
    { value: 'CONFIRMED',        label: 'Đã xác nhận' },
    { value: 'WAITING_CUSTOMER', label: 'Đang chuẩn bị' },    // ← ĐỔI label
    { value: 'PROCESSING',       label: 'Đang sản xuất' },
    { value: 'READY',            label: 'Sẵn sàng nhận' },
    { value: 'COMPLETED',        label: 'Hoàn tất' },
    { value: 'EXPIRED',          label: 'Hết hạn' },
    { value: 'CANCELLED',        label: 'Đã huỷ' },
  ];
```

### 6. Response từ API tạo báo giá

Sau khi OPERATION gọi `POST /api/prescription-requests/:id/create-order`, order trả về:

```diff
- order.status = "WAITING_CUSTOMER"
+ order.status = "PENDING_PAYMENT"
```

---

## Những gì KHÔNG thay đổi

- Luồng đơn thường (`IN_STOCK` / `PRE_ORDER`): **không bị ảnh hưởng** — vẫn bắt đầu từ `NEW`
- Endpoint thanh toán: `POST /api/payments/:orderId/create` — giữ nguyên
- Các trạng thái còn lại: `CONFIRMED`, `WAITING_CUSTOMER`, `PROCESSING`, `READY`, `COMPLETED`, `EXPIRED`, `CANCELLED` — **không đổi ý nghĩa**
- Socket notification types — **không đổi**

---

## API liên quan cần test lại

| Endpoint | Thay đổi |
|----------|---------|
| `POST /api/prescription-requests/:id/create-order` | Response `order.status` = `PENDING_PAYMENT` (cũ: `WAITING_CUSTOMER`) |
| `POST /api/payments/:orderId/create` | Chấp nhận `PENDING_PAYMENT` (cũ: `WAITING_CUSTOMER`) |
| `POST /api/orders/:id/cancel` | Cho phép huỷ khi `PENDING_PAYMENT` |
| `GET /api/orders?status=PENDING_PAYMENT` | Query filter mới hoạt động |

---

## Checklist FE trước khi release

- [ ] Label `PENDING_PAYMENT` → "Chờ thanh toán" đã có
- [ ] Label `WAITING_CUSTOMER` → "Đang chuẩn bị" (không còn liên quan đến thanh toán)
- [ ] Nút **Thanh toán** chỉ hiện khi `status === "PENDING_PAYMENT"`
- [ ] Countdown `expiresAt` chỉ hiện khi `status === "PENDING_PAYMENT"`
- [ ] Nút **Huỷ** hiện thêm ở `PENDING_PAYMENT`
- [ ] Filter đơn hàng có option `PENDING_PAYMENT`
- [ ] Test lại toàn bộ luồng prescription end-to-end
