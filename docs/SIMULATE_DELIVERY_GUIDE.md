# Hướng dẫn FE: Giả lập giao hàng (Demo Mode)

## Vấn đề

Trong môi trường demo, không có shipper thật quét mã GHN nên order mãi kẹt ở trạng thái `READY` và không thể chuyển sang `COMPLETED`.

## Giải pháp

Backend đã thêm endpoint mới cho phép STAFF/OPERATION/ADMIN **bấm nút từ trong app** để tiến từng bước giao hàng, thay thế cho việc chờ GHN gửi webhook thật.

---

## Endpoint mới

```
POST /api/logistics/simulate/:orderId
Authorization: Bearer <token>   (STAFF / OPERATION / ADMIN)
Content-Type: application/json
```

### Body (tuỳ chọn)

```json
{
  "step": "picking" | "delivering" | "delivered"
}
```

> Nếu **không truyền body**, backend tự động chọn bước tiếp theo dựa vào `shippingStatus` hiện tại của order.

---

## Luồng trạng thái

```
order.status = READY
        │
        ▼  Gọi lần 1 (hoặc step: "picking")
shippingStatus = PICKING
        │
        ▼  Gọi lần 2 (hoặc step: "delivering")
shippingStatus = DELIVERING  ──► Notification KH: "Đơn đang được giao"
        │
        ▼  Gọi lần 3 (hoặc step: "delivered")
shippingStatus = DELIVERED
order.status   = COMPLETED   ──► Notification KH: "Giao thành công!"
```

---

## Cách FE tích hợp

### Cách 1 — Tự động (đơn giản nhất)

Gọi endpoint **không cần truyền body**, backend tự tiến bước tiếp theo. FE chỉ cần 1 nút duy nhất:

```typescript
// Ví dụ với axios
const advanceDelivery = async (orderId: string) => {
  const response = await axios.post(
    `/api/logistics/simulate/${orderId}`,
    {},   // body rỗng — backend tự chọn bước
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
```

**Response:**
```json
{
  "success": true,
  "message": "[DEMO] Đang giao hàng (DELIVERING)",
  "data": {
    "orderId": "uuid-abc-123",
    "step": "delivering"
  }
}
```

Sau khi gọi, FE **reload lại order** để cập nhật UI.

---

### Cách 2 — Chọn bước cụ thể (cho UI có dropdown)

```typescript
const simulateStep = async (orderId: string, step: 'picking' | 'delivering' | 'delivered') => {
  const response = await axios.post(
    `/api/logistics/simulate/${orderId}`,
    { step },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
```

---

## Gợi ý UI cho màn hình quản lý đơn (STAFF/OPERATION)

### Khi `order.status === "READY"` và `order.deliveryMethod === "HOME_DELIVERY"`

Hiển thị nút tiến bước giao hàng dựa vào `shippingStatus` hiện tại:

| `shippingStatus` | Label nút | `step` gửi đi |
|-----------------|-----------|--------------|
| `READY_TO_SHIP` hoặc `null` | "Bắt đầu lấy hàng" | *(để trống)* |
| `PICKING` | "Xác nhận đang giao" | *(để trống)* |
| `DELIVERING` | "Xác nhận đã giao" | *(để trống)* |
| `DELIVERED` | — (ẩn nút) | — |

```typescript
// Ví dụ logic render nút
const getNextStepLabel = (shippingStatus: string | null): string | null => {
  switch (shippingStatus) {
    case null:
    case 'READY_TO_SHIP': return 'Bắt đầu lấy hàng';
    case 'PICKING':       return 'Xác nhận đang giao';
    case 'DELIVERING':    return 'Xác nhận đã giao';
    default:              return null; // ẩn nút
  }
};

// Trong component
{order.status === 'READY' &&
 order.deliveryMethod === 'HOME_DELIVERY' &&
 getNextStepLabel(order.shippingStatus) && (
  <Button onPress={() => advanceDelivery(order.id)}>
    {getNextStepLabel(order.shippingStatus)}
  </Button>
)}
```

---

## Xử lý lỗi

| HTTP Status | Nguyên nhân | Xử lý |
|-------------|------------|-------|
| `400` | Order không ở trạng thái `READY` | Toast "Đơn hàng chưa sẵn sàng để giao" |
| `400` | Order không phải `HOME_DELIVERY` | Ẩn nút (không nên xảy ra nếu check điều kiện trước) |
| `400` | Đã hoàn tất shipping | Ẩn nút, reload order |
| `401` | Thiếu hoặc sai token | Redirect về login |
| `403` | Role không đủ quyền | Ẩn nút với CUSTOMER |
| `404` | Không tìm thấy order | Toast "Không tìm thấy đơn hàng" |

```typescript
try {
  await advanceDelivery(order.id);
  await refetchOrder();  // reload lại order sau khi update
  showToast('Cập nhật trạng thái giao hàng thành công');
} catch (error) {
  if (error.response?.status === 400) {
    showToast(error.response.data.message);
  }
}
```

---

## Điều kiện hiển thị nút (checklist)

- [ ] `order.status === "READY"`
- [ ] `order.deliveryMethod === "HOME_DELIVERY"`
- [ ] `order.shippingStatus !== "DELIVERED"`
- [ ] Người dùng có role `STAFF`, `OPERATION`, hoặc `ADMIN`

---

## Lưu ý

- Endpoint này **chỉ dùng cho demo/dev** — production sẽ dùng webhook GHN thật tự động
- Mỗi lần gọi chỉ tiến **1 bước** — phải gọi 3 lần để hoàn tất toàn bộ flow
- Khi gọi bước `delivered`, order **tự động chuyển sang `COMPLETED`** và KH nhận notification
- Không cần truyền body — chỉ truyền `step` khi muốn nhảy đến bước cụ thể
