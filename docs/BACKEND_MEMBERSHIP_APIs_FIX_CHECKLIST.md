# 🔧 CHECKLIST FIX MEMBERSHIP APIs

> **Ngày:** March 26, 2026  
> **Status:** Backend đã có 1 số APIs nhưng cần fix và bổ sung

---

## ✅ APIs ĐÃ CÓ (nhưng cần fix)

### 1. `GET /membership/tiers` - ⚠️ CẦN FIX AUTH

**Vấn đề:** Đang yêu cầu authentication (icon 🔒 trong Swagger)

**Fix:**
```typescript
// TRƯỚC (SAI):
router.get('/membership/tiers', authenticate, getTiers);

// SAU (ĐÚNG):
router.get('/membership/tiers', getTiers); // Public API, không cần auth
```

**Test:**
```bash
# Phải work KHÔNG CẦN token
curl https://wdp.up.railway.app/api/membership/tiers

# Kết quả mong đợi:
{
  "statusCode": 200,
  "message": "Tiers retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "Đồng",
      "icon": "🥉",
      "minSpend": 0,
      "discountPercent": 0,
      ...
    }
  ]
}
```

---

### 2. `POST /membership/tiers` - ✅ OK
**Status:** Đã đúng (Admin only)

### 3. `GET /membership/tiers/{id}` - ✅ OK  
**Status:** Đã đúng

### 4. `PUT /membership/tiers/{id}` - ✅ OK
**Status:** Đã đúng (Admin only)

### 5. `DELETE /membership/tiers/{id}` - ✅ OK
**Status:** Đã đúng (Admin only)

### 6. `GET /membership/me` - ✅ OK
**Status:** Đã đúng (Customer xem membership của mình)

### 7. `GET /membership/me/history` - ✅ OK
**Status:** Đã đúng (Customer xem history của mình)

### 8. `GET /membership/history` - ✅ OK
**Status:** Đã đúng (Admin audit log)

---

## ❌ APIs CHƯA CÓ (cần implement ASAP)

### 9. `GET /users/:userId/membership` - ❌ CHƯA CÓ

**Priority:** 🔴 HIGH (blocking popup "Điều chỉnh điểm")

**Purpose:** Admin xem membership của 1 user cụ thể

**Route:**
```typescript
router.get('/users/:userId/membership', authenticate, requireAdmin, getUserMembership);
```

**Response format:**
```json
{
  "statusCode": 200,
  "message": "User membership retrieved successfully",
  "data": {
    "userId": "3428e70c-eb43-47ac-acf0-7ff85a69fe53",
    "currentTier": {
      "id": "uuid",
      "name": "Bạc",
      "icon": "🥈",
      "color": "#c0c0c0",
      "discountPercent": 5
    },
    "totalSpent": 8500000,
    "spendInPeriod": 7200000,
    "discountPercent": 5,
    "periodStartDate": "2026-01-01T00:00:00.000Z",
    "periodEndDate": "2026-12-31T23:59:59.000Z",
    "joinDate": "2025-06-15T10:00:00.000Z"
  }
}
```

**Logic:**
1. Kiểm tra user tồn tại
2. Lấy membership từ DB
3. Nếu chưa có → tạo mới với tier thấp nhất (Bronze)
4. Return đầy đủ thông tin

---

### 10. `POST /users/:userId/membership/adjust-points` - ❌ CHƯA CÓ

**Priority:** 🔴 HIGH (blocking popup "Điều chỉnh điểm")

**Purpose:** Admin cộng/trừ điểm thủ công

**Route:**
```typescript
router.post('/users/:userId/membership/adjust-points', authenticate, requireAdmin, adjustPoints);
```

**Request body:**
```json
{
  "amount": 1000000,
  "reason": "Bù điểm cho đơn hàng lỗi #ORD12345",
  "note": "Khách hàng VIP, bồi thường sự cố"
}
```

**Response format:**
```json
{
  "statusCode": 200,
  "message": "Points adjusted successfully",
  "data": {
    "userId": "3428e70c-eb43-47ac-acf0-7ff85a69fe53",
    "currentTier": {
      "id": "uuid",
      "name": "Vàng",
      "icon": "🥇",
      "discountPercent": 10
    },
    "totalSpent": 9500000,
    "spendInPeriod": 8200000,
    "tierChanged": true,
    "oldTierName": "Bạc",
    "newTierName": "Vàng"
  }
}
```

**Logic:**
1. Cập nhật `totalSpent` và `spendInPeriod`
2. Ghi lịch sử vào `membership_history`
3. Tính lại tier dựa trên `spendInPeriod`
4. Nếu tier thay đổi → ghi thêm 1 record history
5. Return membership mới

---

### 11. `GET /users?include=membership` - ❌ CHƯA CÓ

**Priority:** 🟡 MEDIUM (blocking tab "Thành viên theo hạng")

**Purpose:** Lấy danh sách customers kèm membership info

**Route:**
```typescript
router.get('/users', authenticate, requireAdmin, getUsers);
// Khi query param include=membership → join với user_memberships
```

**Query params:**
- `role=CUSTOMER` - Filter users by role
- `include=membership` - Include membership data
- `page=1` - Pagination
- `limit=100` - Số user per page
- `search` (optional) - Search by name/email

**Response format:**
```json
{
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": {
    "items": [
      {
        "id": "user-uuid",
        "fullName": "Tùng Dương Thanh",
        "email": "tungduong@example.com",
        "phone": "0987654321",
        "role": "CUSTOMER",
        "membership": {
          "currentTier": {
            "name": "Bạc",
            "icon": "🥈",
            "discountPercent": 5
          },
          "totalSpent": 8500000,
          "spendInPeriod": 7200000,
          "joinDate": "2025-08-10T00:00:00.000Z"
        }
      }
    ],
    "meta": {
      "total": 76,
      "page": 1,
      "limit": 100,
      "totalPages": 1
    }
  }
}
```

**Logic:**
1. Query users theo filter (role, search)
2. Nếu `include=membership` → LEFT JOIN với `user_memberships`
3. Nếu user chưa có membership → tự động tạo mới
4. Return list users kèm membership info

---

## 📋 SUMMARY

| API | Status | Priority | Sử dụng cho |
|-----|--------|----------|-------------|
| `GET /membership/tiers` | ⚠️ Cần fix auth | 🔴 HIGH | Public API |
| `POST /membership/tiers` | ✅ OK | - | Admin CRUD |
| `PUT /membership/tiers/{id}` | ✅ OK | - | Admin CRUD |
| `DELETE /membership/tiers/{id}` | ✅ OK | - | Admin CRUD |
| `GET /membership/me` | ✅ OK | - | Customer |
| `GET /membership/me/history` | ✅ OK | - | Customer |
| `GET /membership/history` | ✅ OK | - | Admin audit log |
| `GET /users/:userId/membership` | ❌ Chưa có | 🔴 HIGH | Popup điều chỉnh điểm |
| `POST /users/:userId/membership/adjust-points` | ❌ Chưa có | 🔴 HIGH | Popup điều chỉnh điểm |
| `GET /users?include=membership` | ❌ Chưa có | 🟡 MEDIUM | Tab thành viên |

---

## 🎯 ACTION ITEMS

### Priority 1 (Làm ngay - blocking Frontend):
- [ ] Fix authentication cho `GET /membership/tiers` (bỏ middleware authenticate)
- [ ] Implement `GET /users/:userId/membership`
- [ ] Implement `POST /users/:userId/membership/adjust-points`

### Priority 2 (Làm sau):
- [ ] Implement `GET /users?include=membership`
- [ ] Auto-calculate membership khi order COMPLETED
- [ ] Auto-upgrade/downgrade tier khi hết kỳ

---

## 🧪 TEST SCRIPTS

### Test 1: Verify `/membership/tiers` là public
```bash
# Không cần token, phải work
curl https://wdp.up.railway.app/api/membership/tiers
```

### Test 2: Test `/users/:userId/membership`
```bash
# Cần ADMIN token
curl -X GET https://wdp.up.railway.app/api/users/3428e70c-eb43-47ac-acf0-7ff85a69fe53/membership \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Test 3: Test `/users/:userId/membership/adjust-points`
```bash
# Cần ADMIN token
curl -X POST https://wdp.up.railway.app/api/users/3428e70c-eb43-47ac-acf0-7ff85a69fe53/membership/adjust-points \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000000,
    "reason": "Test bù điểm",
    "note": "Testing API"
  }'
```

---

**Updated:** March 26, 2026  
**Contact:** Frontend Team - Nếu cần thêm thông tin về format request/response
