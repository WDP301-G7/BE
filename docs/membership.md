# Membership Feature — Tài liệu tích hợp Frontend

> Base URL: `https://<domain>/api`  
> Tất cả request cần auth phải có header: `Authorization: Bearer <access_token>`

---

## Mục lục

1. [Tổng quan luồng nghiệp vụ](#1-tổng-quan-luồng-nghiệp-vụ)
2. [Cấu trúc Tier](#2-cấu-trúc-tier)
3. [API — Khách hàng (Customer)](#3-api--khách-hàng-customer)
4. [API — Admin quản lý Tier](#4-api--admin-quản-lý-tier)
5. [API — Admin / Operation xem Audit Log](#5-api--admin--operation-xem-audit-log)
6. [Tích hợp vào luồng đặt hàng (Order)](#6-tích-hợp-vào-luồng-đặt-hàng-order)
7. [Tích hợp vào luồng đổi / trả / bảo hành (Returns)](#7-tích-hợp-vào-luồng-đổi--trả--bảo-hành-returns)
8. [Gợi ý hiển thị UI](#8-gợi-ý-hiển-thị-ui)
9. [Error codes](#9-error-codes)

---

## 1. Tổng quan luồng nghiệp vụ

```
Khách đặt hàng
     │
     ▼
createOrder  ──► BE tự động lấy tier hiện tại của khách
                 → tính discountAmount = totalAmount × discountPercent/100
                 → lưu discountAmount + membershipTierId vào order
     │
     ▼
Order hoàn thành (COMPLETED)
     │
     ▼
recordSpend  ──► Cộng totalAmount vào spendInPeriod
                 → Kiểm tra có hết kỳ không?
                    - Hết kỳ  → reset spendInPeriod = amount, periodStartDate = now
                    - Còn kỳ  → spendInPeriod += amount
                 → So sánh spendInPeriod với các mức minSpend của tier
                 → Cập nhật hạng (upgrade / downgrade)
                 → Nếu hạng thay đổi → ghi MembershipHistory
```

### Quy tắc tính hạng

| Hạng | minSpend (ví dụ) | Discount | Bảo hành | Trả hàng | Đổi hàng |
|------|-----------------|----------|----------|----------|----------|
| Bronze | 0 | 0% | 6 tháng | 7 ngày | 15 ngày |
| Silver | 2,000,000 | 5% | 9 tháng | 10 ngày | 22 ngày |
| Gold | 10,000,000 | 10% | 12 tháng | 14 ngày | 30 ngày |

> Ngưỡng và quyền lợi do **Admin cấu hình**, không hardcode — xem [Phần 4](#4-api--admin-quản-lý-tier).

### Downgrade

- Hạng được **đánh giá lại mỗi khi có đơn COMPLETED**.
- Mỗi tier có `periodDays` (mặc định 365 ngày). Khi kỳ hết, `spendInPeriod` reset về 0.
- Nếu chi tiêu kỳ mới thấp hơn ngưỡng tier hiện tại → **tự động xuống hạng**.
- Không cần cron job — hệ thống tự xử lý.

---

## 2. Cấu trúc Tier

### Object `MembershipTier`

```typescript
interface MembershipTier {
  id: string;              // UUID
  name: string;            // "Bronze" | "Silver" | "Gold" | ...
  minSpend: number;        // Ngưỡng chi tiêu trong kỳ (VND)
  discountPercent: number; // % giảm giá tự động khi đặt đơn
  warrantyMonths: number;  // Thời hạn bảo hành (tháng)
  returnDays: number;      // Thời hạn trả hàng (ngày)
  exchangeDays: number;    // Thời hạn đổi hàng (ngày)
  periodDays: number;      // Số ngày của 1 kỳ đánh giá
  sortOrder: number;       // Thứ tự xếp hạng (0 = thấp nhất)
  createdAt: string;
  updatedAt: string;
  _count: { users: number }; // Số lượng user đang ở hạng này
}
```

---

## 3. API — Khách hàng (Customer)

### 3.1 Xem trạng thái membership

```
GET /api/membership/me
Authorization: Bearer <token>
Role: CUSTOMER
```

**Response 200:**
```json
{
  "statusCode": 200,
  "message": "Membership status retrieved",
  "data": {
    "tier": "Silver",
    "tierId": "uuid-of-silver-tier",
    "discountPercent": 5,
    "warrantyMonths": 9,
    "returnDays": 10,
    "exchangeDays": 22,
    "totalSpent": 8500000,
    "spendInPeriod": 3500000,
    "periodStartDate": "2026-01-01T00:00:00.000Z",
    "periodEndDate": "2026-12-31T23:59:59.000Z",
    "nextTier": "Gold",
    "nextTierId": "uuid-of-gold-tier",
    "amountToNextTier": 6500000
  }
}
```

**Các trường hợp đặc biệt:**

| Trường hợp | `tier` | `nextTier` | `amountToNextTier` |
|---|---|---|---|
| Chưa có hạng | `null` | `"Bronze"` | `0` (nếu Bronze.minSpend = 0) |
| Đang ở hạng cao nhất (Gold) | `"Gold"` | `null` | `null` |

**Gợi ý render UI Progress Bar:**
```typescript
// Ví dụ với React
const progressPercent = status.amountToNextTier !== null
  ? Math.min(100, (status.spendInPeriod / (status.spendInPeriod + status.amountToNextTier)) * 100)
  : 100;

// Label: "Spend 6.5M more to reach GOLD"
const label = status.amountToNextTier !== null
  ? `Spend ${formatCurrency(status.amountToNextTier)} more to reach ${status.nextTier}`
  : `You've reached the highest tier!`;
```

---

### 3.2 Xem lịch sử thay đổi hạng

```
GET /api/membership/me/history?page=1&limit=20
Authorization: Bearer <token>
Role: CUSTOMER
```

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang hiện tại |
| `limit` | number | 20 | Số item / trang (max 100) |

**Response 200:**
```json
{
  "statusCode": 200,
  "message": "History retrieved successfully",
  "data": {
    "data": [
      {
        "id": "uuid",
        "userId": "uuid",
        "oldTierId": "uuid-bronze",
        "newTierId": "uuid-silver",
        "reason": "ORDER_COMPLETED",
        "changedAt": "2026-03-15T10:30:00.000Z",
        "oldTier": { "id": "uuid-bronze", "name": "Bronze" },
        "newTier": { "id": "uuid-silver", "name": "Silver" },
        "user": { "id": "uuid", "fullName": "Nguyen Van A", "email": "a@example.com" }
      }
    ],
    "meta": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

**Giá trị `reason`:**

| Giá trị | Ý nghĩa |
|---------|---------|
| `ORDER_COMPLETED` | Hạng thay đổi sau khi đơn hàng hoàn thành |
| `PERIOD_RESET` | Kỳ đánh giá mới bắt đầu, hạng được tính lại |
| `ADMIN_MANUAL` | Admin điều chỉnh thủ công (dự phòng) |

---

### 3.3 Xem danh sách tất cả tiers (public)

```
GET /api/membership/tiers
```

> Không cần auth — dùng để hiển thị bảng so sánh quyền lợi các hạng cho khách chưa đăng nhập.

**Response 200:**
```json
{
  "statusCode": 200,
  "message": "Tiers retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "Bronze",
      "minSpend": 0,
      "discountPercent": 0,
      "warrantyMonths": 6,
      "returnDays": 7,
      "exchangeDays": 15,
      "periodDays": 365,
      "sortOrder": 0,
      "_count": { "users": 120 }
    },
    {
      "id": "uuid",
      "name": "Silver",
      "minSpend": 2000000,
      "discountPercent": 5,
      "warrantyMonths": 9,
      "returnDays": 10,
      "exchangeDays": 22,
      "periodDays": 365,
      "sortOrder": 1,
      "_count": { "users": 45 }
    }
  ]
}
```

---

## 4. API — Admin quản lý Tier

> Tất cả endpoint này yêu cầu `Role: ADMIN`.

### 4.1 Tạo tier mới

```
POST /api/membership/tiers
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "name": "Gold",
  "minSpend": 10000000,
  "discountPercent": 10,
  "warrantyMonths": 12,
  "returnDays": 14,
  "exchangeDays": 30,
  "periodDays": 365,
  "sortOrder": 2
}
```

| Field | Bắt buộc | Mặc định | Mô tả |
|-------|----------|----------|-------|
| `name` | ✅ | — | Tên hạng |
| `minSpend` | ✅ | — | Ngưỡng chi tiêu trong kỳ (VND) |
| `discountPercent` | | `0` | % giảm giá đơn hàng (0–100) |
| `warrantyMonths` | | `6` | Thời hạn bảo hành |
| `returnDays` | | `7` | Thời hạn trả hàng |
| `exchangeDays` | | `15` | Thời hạn đổi hàng |
| `periodDays` | | `365` | Số ngày 1 kỳ đánh giá |
| `sortOrder` | | `0` | Thứ tự hiển thị (Bronze=0, Silver=1, Gold=2) |

**Response 201:** Trả về object `MembershipTier` vừa tạo.

---

### 4.2 Cập nhật tier

```
PUT /api/membership/tiers/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body:** Tất cả fields là optional (chỉ truyền field cần sửa).

```json
{
  "discountPercent": 12,
  "warrantyMonths": 15
}
```

**Response 200:** Trả về object `MembershipTier` đã cập nhật.

---

### 4.3 Xóa tier

```
DELETE /api/membership/tiers/:id
Authorization: Bearer <admin_token>
```

> **Lưu ý:** Không thể xóa tier nếu có user đang ở hạng đó. BE trả lỗi 400 kèm số lượng user.

**Response 200:**
```json
{ "statusCode": 200, "message": "Tier deleted successfully", "data": null }
```

**Response 400 (nếu có user):**
```json
{
  "statusCode": 400,
  "message": "Cannot delete tier: 45 user(s) currently hold this tier"
}
```

---

## 5. API — Admin / Operation xem Audit Log

```
GET /api/membership/history
Authorization: Bearer <token>
Role: ADMIN | OPERATION | MANAGER
```

**Query params:**

| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang (mặc định 1) |
| `limit` | number | Số item/trang (mặc định 20, max 100) |
| `userId` | UUID | Lọc theo user cụ thể |
| `reason` | string | `ORDER_COMPLETED` \| `PERIOD_RESET` \| `ADMIN_MANUAL` |
| `startDate` | date | Lọc từ ngày (ISO 8601) |
| `endDate` | date | Lọc đến ngày (ISO 8601) |

**Ví dụ request:**
```
GET /api/membership/history?reason=PERIOD_RESET&startDate=2026-01-01&endDate=2026-03-31&page=1&limit=50
```

**Response 200:** Cấu trúc giống [3.2](#32-xem-lịch-sử-thay-đổi-hạng) nhưng không filter theo userId.

---

## 6. Tích hợp vào luồng đặt hàng (Order)

### Discount tự động

Khi khách tạo đơn hàng (`POST /api/orders`), BE **tự động** áp dụng discount từ hạng membership. FE **không cần** gửi thêm tham số nào.

Response của `createOrder` sẽ có 2 field mới:

```json
{
  "id": "order-uuid",
  "totalAmount": 4500000,
  "discountAmount": 225000,
  "membershipTierId": "uuid-silver-tier",
  ...
}
```

> `totalAmount` đã là giá **sau khi trừ discount**. `discountAmount` là số tiền được giảm.

**Gợi ý hiển thị trên trang checkout:**

```
Tổng tiền hàng:    4,725,000 đ
Ưu đãi thành viên (Silver -5%):  -225,000 đ
────────────────────────────────
Thanh toán:         4,500,000 đ
```

---

## 7. Tích hợp vào luồng đổi / trả / bảo hành (Returns)

Thời hạn đổi/trả/bảo hành **tự động thay đổi theo hạng** của khách. FE không cần xử lý thêm — BE tự kiểm tra.

### Thời hạn theo hạng (ví dụ cấu hình)

| Hạng | Trả hàng (RETURN) | Đổi hàng (EXCHANGE) | Bảo hành (WARRANTY) |
|------|-------------------|---------------------|---------------------|
| Không có / Bronze | 7 ngày | 15 ngày | 6 tháng |
| Silver | 10 ngày | 22 ngày | 9 tháng |
| Gold | 14 ngày | 30 ngày | 12 tháng |

### Gợi ý hiển thị cho khách

Khi khách xem chi tiết đơn hàng đã COMPLETED, FE nên call `GET /api/membership/me` để hiển thị quyền lợi hiện tại:

```
Đơn hàng #ORD-001 (hoàn thành ngày 01/03/2026)
┌─────────────────────────────────────────────┐
│ Quyền lợi của bạn (Hạng Silver)             │
│  • Trả hàng: còn 4 ngày (hết 05/03/2026)   │
│  • Đổi hàng: còn 11 ngày (hết 12/03/2026)  │
│  • Bảo hành: đến 01/12/2026 (9 tháng)      │
└─────────────────────────────────────────────┘
```

> **Tính ngày hết hạn phía FE:**
> ```typescript
> const completedDate = new Date(order.updatedAt);
> const returnDeadline = addDays(completedDate, membership.returnDays);
> const exchangeDeadline = addDays(completedDate, membership.exchangeDays);
> const warrantyExpiry = addMonths(completedDate, membership.warrantyMonths);
> ```

---

## 8. Gợi ý hiển thị UI

### Trang Profile / Dashboard khách hàng

```
┌──────────────────────────────────────────────────────┐
│  🥈 SILVER MEMBER                                    │
│                                                      │
│  Chi tiêu kỳ này:  3,500,000 đ                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ ████████████░░░░░░░░░░░░░░░░░░░  35%         │    │
│  └──────────────────────────────────────────────┘    │
│  Spend 6,500,000đ more to reach 🥇 GOLD             │
│                                                      │
│  Kỳ hiện tại: 01/01/2026 – 31/12/2026               │
│                                                      │
│  Quyền lợi của bạn:                                 │
│   • Giảm 5% mỗi đơn hàng                           │
│   • Bảo hành 9 tháng                               │
│   • Đổi hàng trong 22 ngày                         │
│   • Trả hàng trong 10 ngày                         │
└──────────────────────────────────────────────────────┘
```

### Trang so sánh hạng (public)

Dùng `GET /api/membership/tiers` để render bảng so sánh, highlight hạng hiện tại của user.

### Trang Checkout

Nếu `discountAmount > 0` trên response của `createOrder`, hiển thị dòng giảm giá thành viên.

---

## 9. Error codes

| HTTP | Message | Nguyên nhân |
|------|---------|-------------|
| `400` | `Cannot delete tier: N user(s) currently hold this tier` | Xóa tier đang có user |
| `400` | `Đã quá thời hạn trả hàng (N ngày)` | Quá hạn RETURN theo tier |
| `400` | `Đã quá thời hạn đổi hàng (N ngày)` | Quá hạn EXCHANGE theo tier |
| `400` | `Đã hết hạn bảo hành (N tháng)` | Quá hạn WARRANTY theo tier |
| `401` | Unauthorized | Thiếu hoặc sai token |
| `403` | Forbidden | Không đủ quyền (sai role) |
| `404` | `Membership tier not found` | ID tier không tồn tại |
| `404` | `User not found` | User không tồn tại |
