#  BUSINESS PLAN  CHỨC NĂNG REVIEW & ĐÁNH GIÁ

**Hệ thống:** Bán kính mắt online (Eyewear E-commerce)  
**Tech stack:** Node.js + Express + TypeScript + MySQL + Prisma ORM  
**Phiên bản:** 1.1 | Ngày: 03/03/2026  
**Trạng thái:** `CONFIRMED  Sẵn sàng implement`

---

## 1. TỔNG QUAN MỤC TIÊU NGHIỆP VỤ

### 1.1 Vấn đề cần giải quyết

Hệ thống hiện tại chưa có cơ chế để:
- Khách hàng đánh giá sản phẩm (gọng kính, tròng kính) sau khi mua
- Quản lý phản hồi của shop với review khách hàng
- Báo cáo chất lượng sản phẩm cho MANAGER/ADMIN

### 1.2 Mục tiêu nghiệp vụ

| # | Mục tiêu | Ưu tiên |
|---|----------|---------|
| 1 | Cho phép customer review sản phẩm sau khi đơn hàng hoàn thành | P0 |
| 2 | Review gắn với OrderItem cụ thể (1 đơn nhiều sản phẩm  review từng cái riêng) | P0 |
| 3 | Không cho review trùng lặp (1 OrderItem = 1 Review duy nhất) | P0 |
| 4 | OPERATION/ADMIN có thể reply review | P1 |
| 5 | Thống kê rating trung bình theo sản phẩm | P1 |
| 6 | Ẩn/xóa review vi phạm (ADMIN/MANAGER) | P1 |

---

## 2. ACTORS & PHÂN QUYỀN

| Actor | Quyền hạn |
|-------|-----------|
| **CUSTOMER** | Tạo review (1 lần/OrderItem), sửa review của mình trong 7 ngày, xem tất cả review public |
| **STAFF** | Xem review, không được sửa/xóa/reply |
| **OPERATION** | Xem review, reply review, báo cáo review spam |
| **MANAGER** | Ẩn/hiện review, xem thống kê rating |
| **ADMIN** | Full quyền: xóa cứng, xem tất cả, reply, override mọi action |

---

## 3. ĐIỀU KIỆN NGHIỆP VỤ (Business Rules)

### 3.1 Điều kiện để được phép review

```
1. Order.status = COMPLETED                       <- bắt buộc
2. Chưa có Review cho OrderItem này               <- 1 OrderItem = 1 Review duy nhất
3. Customer phải là người đặt hàng                <- customerId phải khớp
4. Trong vòng 30 ngày kể từ ngày Order COMPLETED  <- quá hạn không review được
5. Order bị CANCELLED hoặc EXPIRED               <- KHÔNG được review
```

### 3.2 Điều kiện theo OrderType & ProductType

| OrderType | ProductType cho phép review | Ghi chú |
|-----------|----------------------------|---------|
| `IN_STOCK` | `FRAME`, `LENS` | Không review ProductType = SERVICE |
| `PRE_ORDER` | `FRAME`, `LENS` | Không review ProductType = SERVICE |
| `PRESCRIPTION` | `FRAME`, `LENS` | Không review ProductType = SERVICE |

> **Lý do:** ProductType = SERVICE (dịch vụ đo kính, tư vấn) không nằm trong phạm vi chức năng review này.

### 3.3 Quy tắc rating

```
- Rating: 1 -> 5 sao (integer, không thập phân)
- Bắt buộc có rating, không bắt buộc có comment
- Comment: tối đa 1000 ký tự
- Ảnh đính kèm: tối đa 3 ảnh/review (upload lên Supabase Storage)
```

### 3.4 Quy tắc chỉnh sửa / xóa

```
- Customer chỉ được sửa trong vòng 7 ngày kể từ ngày tạo review
- Customer KHÔNG được xóa review
- Sau 7 ngày: review bị lock, không thể sửa
- MANAGER có thể ẩn review vi phạm (soft delete)
- ADMIN có thể xóa cứng review vi phạm
```

---

## 4. CẤU TRÚC REVIEW (Standard  áp dụng cho mọi OrderType)

Tất cả các loại đơn hàng (IN_STOCK, PRE_ORDER, PRESCRIPTION) đều dùng chung cấu trúc review sau:

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `orderItemId` | UUID | YES | OrderItem được review |
| `rating` | Int (1-5) | YES | Số sao đánh giá |
| `comment` | String (max 1000) | NO | Nhận xét bằng chữ |
| `images` | Array (max 3 ảnh) | NO | Ảnh thực tế sản phẩm |

**Reply từ cửa hàng (do OPERATION/ADMIN thực hiện):**

| Field | Type | Mô tả |
|-------|------|-------|
| `replyContent` | String (max 500) | Nội dung phản hồi |
| `repliedBy` | UUID | userId của người reply |
| `repliedAt` | DateTime | Thời điểm reply |

---

## 5. DATABASE SCHEMA (Prisma)

```prisma
// ============================================
// REVIEWS
// ============================================

model Review {
  id          String       @id @default(uuid())
  orderItemId String       @unique @map("order_item_id")   // 1 OrderItem = 1 Review duy nhất
  orderId     String       @map("order_id")
  productId   String       @map("product_id")
  customerId  String       @map("customer_id")

  // Core review
  rating      Int                                           // 1-5
  comment     String?      @db.Text

  // Moderation
  status        ReviewStatus @default(PUBLISHED)
  editableUntil DateTime     @map("editable_until")        // createdAt + 7 ngày
  deletedAt     DateTime?    @map("deleted_at")            // soft delete bởi MANAGER/ADMIN

  // Reply từ shop
  replyContent  String?    @map("reply_content") @db.Text
  repliedBy     String?    @map("replied_by")
  repliedAt     DateTime?  @map("replied_at")

  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt      @map("updated_at")

  // Relations
  orderItem   OrderItem    @relation(fields: [orderItemId], references: [id])
  order       Order        @relation(fields: [orderId], references: [id])
  product     Product      @relation(fields: [productId], references: [id])
  customer    User         @relation("CustomerReviews", fields: [customerId], references: [id])
  replier     User?        @relation("ReviewReplier", fields: [repliedBy], references: [id])
  images      ReviewImage[]

  @@map("reviews")
  @@index([productId])
  @@index([customerId])
  @@index([orderId])
  @@index([status])
  @@index([rating])
  @@index([deletedAt])
}

model ReviewImage {
  id        String   @id @default(uuid())
  reviewId  String   @map("review_id")
  imageUrl  String   @map("image_url") @db.VarChar(255)
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  review Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)

  @@map("review_images")
  @@index([reviewId])
}

enum ReviewStatus {
  PUBLISHED   // Hiển thị công khai
  HIDDEN      // Bị ẩn bởi MANAGER/ADMIN
}
```

> **Cần thêm relations ngược vào các model hiện có trong `prisma/schema.prisma`:**
> - `OrderItem` -> thêm `review Review?`
> - `Order` -> thêm `reviews Review[]`
> - `Product` -> thêm `reviews Review[]`
> - `User` -> thêm `reviewsAsCustomer Review[] @relation("CustomerReviews")` và `reviewReplies Review[] @relation("ReviewReplier")`

---

## 6. API ENDPOINTS

### 6.1 Customer APIs (yêu cầu auth CUSTOMER)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/reviews` | Tạo review mới |
| `PUT` | `/api/reviews/:id` | Sửa review (trong 7 ngày) |
| `GET` | `/api/reviews/my-reviews` | Xem tất cả review của mình |
| `GET` | `/api/reviews/eligible` | Danh sách OrderItem chưa được review (nhắc review) |

### 6.2 Public APIs (không cần auth)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/products/:productId/reviews` | Lấy reviews của sản phẩm (phân trang, filter) |
| `GET` | `/api/products/:productId/reviews/summary` | Rating trung bình + phân bổ sao |

### 6.3 Operation/Admin APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/api/reviews/:id/reply` | Reply review | OPERATION, ADMIN |
| `PUT` | `/api/reviews/:id/reply` | Sửa reply | OPERATION, ADMIN |

### 6.4 Manager/Admin APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/reviews` | Lấy tất cả reviews (filter, sort, phân trang) | MANAGER, ADMIN |
| `PATCH` | `/api/reviews/:id/hide` | Ẩn review vi phạm | MANAGER, ADMIN |
| `PATCH` | `/api/reviews/:id/show` | Hiện lại review đã ẩn | MANAGER, ADMIN |
| `DELETE` | `/api/reviews/:id` | Xóa cứng review | ADMIN only |
| `GET` | `/api/reviews/stats` | Thống kê rating theo sản phẩm | MANAGER, ADMIN |

---

## 7. CHI TIẾT FLOW NGHIỆP VỤ

### 7.1 Flow: Tạo Review

```
Customer POST /api/reviews
    |
    v
[Validate input - Zod schema]
    |
    v
[Kiểm tra OrderItem tồn tại + thuộc về customer này]
    |   L- Fail -> 404 Not Found
    v
[Kiểm tra Product.type thuộc { FRAME, LENS }]
    |   L- Fail -> 400: "Loại sản phẩm này không hỗ trợ đánh giá"
    v
[Kiểm tra Order.status = COMPLETED]
    |   L- Fail -> 400: "Đơn hàng chưa hoàn thành, chưa thể đánh giá"
    v
[Kiểm tra thời gian (trong 30 ngày kể từ Order COMPLETED)]
    |   L- Fail -> 400: "Đã hết hạn đánh giá (quá 30 ngày)"
    v
[Kiểm tra chưa có review cho OrderItem này]
    |   L- Fail -> 409: "Bạn đã đánh giá sản phẩm này rồi"
    v
[Upload ảnh lên Supabase Storage nếu có (tối đa 3 ảnh)]
    |   L- Fail -> 500: Rollback, không tạo review
    v
[Tạo Review + ReviewImages trong DB transaction]
    |   editableUntil = now() + 7 ngày
    v
[201 Created - trả về review vừa tạo]
```

### 7.2 Flow: Sửa Review

```
Customer PUT /api/reviews/:id
    |
    v
[Kiểm tra review tồn tại + customer là owner]
    |   L- Fail -> 403 Forbidden
    v
[Kiểm tra review.editableUntil > now()]
    |   L- Fail -> 400: "Đã hết hạn chỉnh sửa (7 ngày sau khi tạo)"
    v
[Kiểm tra review.status = PUBLISHED]
    |   L- Fail -> 400: "Review đang bị ẩn, không thể chỉnh sửa"
    v
[Update nội dung + xử lý ảnh (xóa ảnh cũ, upload ảnh mới)]
    |
    v
[200 OK - trả về review đã cập nhật]
```

### 7.3 Flow: Reply Review (OPERATION / ADMIN)

```
POST /api/reviews/:id/reply
    |
    v
[Kiểm tra review tồn tại + status = PUBLISHED]
    |   L- Fail -> 400: "Không thể reply review đang bị ẩn"
    v
[Kiểm tra chưa có reply (1 reply duy nhất/review)]
    |   L- Fail -> 409: "Đã có phản hồi, dùng PUT /reply để cập nhật"
    v
[Lưu replyContent + repliedBy + repliedAt]
    |
    v
[200 OK]
```

### 7.4 Flow: Ẩn Review (MANAGER / ADMIN)

```
PATCH /api/reviews/:id/hide
    |
    v
[Kiểm tra review tồn tại]
    |   L- Fail -> 404 Not Found
    v
[Kiểm tra review.status = PUBLISHED]
    |   L- Fail -> 400: "Review đã bị ẩn rồi"
    v
[Update status = HIDDEN]
    |
    v
[200 OK]
```

---

## 8. QUERY APPROACH (Prisma vs Raw SQL)

| Query | Approach | Lý do |
|-------|----------|-------|
| Tạo review, sửa review | **Prisma ORM** | CRUD đơn giản |
| Lấy reviews theo productId (filter / pagination) | **Prisma ORM** | Prisma đủ mạnh |
| Rating summary (avg + phân bổ sao) | **Raw SQL** | Cần GROUP BY + COUNT aggregation |
| Thống kê rating theo nhiều sản phẩm | **Raw SQL** | Aggregation + ranking |
| Kiểm tra eligible OrderItems (chưa review) | **Prisma ORM** | Join đơn giản |

**Ví dụ Raw SQL - Rating Summary:**

```sql
SELECT
  p.id            AS product_id,
  p.name          AS product_name,
  ROUND(AVG(r.rating), 2)                            AS avg_rating,
  COUNT(r.id)                                        AS total_reviews,
  SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END)     AS star_5,
  SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END)     AS star_4,
  SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END)     AS star_3,
  SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END)     AS star_2,
  SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END)     AS star_1
FROM products p
LEFT JOIN reviews r
  ON r.product_id  = p.id
  AND r.status     = 'PUBLISHED'
  AND r.deleted_at IS NULL
WHERE p.id = :productId
GROUP BY p.id, p.name;
```

---

## 9. CẤU TRÚC FILE MODULE

Theo đúng cấu trúc chuẩn của project (MVC + Service + Repository):

```
src/
 modules/
    reviews/
        reviews.controller.ts    <- HTTP handler, không chứa logic
        reviews.service.ts       <- Business logic + validation nghiệp vụ
        reviews.repository.ts    <- DB access (Prisma ORM + Raw SQL)
        reviews.routes.ts        <- Route definitions + apply middleware

 validations/
     zod/
         reviews.schema.ts        <- Zod validation schemas
```

---

## 10. VALIDATION SCHEMA (Zod  tóm tắt)

File: `src/validations/zod/reviews.schema.ts`

```typescript
// POST /api/reviews - Tạo review
createReviewSchema = {
  body: {
    orderItemId : uuid (required)
    rating      : int 1-5 (required)
    comment     : string max 1000 (optional)
  }
}

// PUT /api/reviews/:id - Sửa review
updateReviewSchema = {
  params : { id: uuid }
  body   : {
    rating?  : int 1-5
    comment? : string max 1000 | null
  }
  // refine: ít nhất 1 trường phải có giá trị
}

// POST /api/reviews/:id/reply - Reply review
replyReviewSchema = {
  params : { id: uuid }
  body   : { replyContent: string max 500 (required) }
}

// GET /api/products/:productId/reviews - Filter + pagination
getReviewsQuerySchema = {
  query: {
    rating     : int 1-5 (optional)
    hasImages  : boolean (optional)
    page       : int default 1
    limit      : int default 10, max 50
    sortBy     : 'createdAt' | 'rating' (default: createdAt)
    sortOrder  : 'asc' | 'desc' (default: desc)
  }
}
```

---

## 11. RESPONSE FORMAT MẪU

### `GET /api/products/:productId/reviews/summary`

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "productId": "uuid",
    "productName": "Gọng kính Calvin Klein CK5461",
    "avgRating": 4.3,
    "totalReviews": 128,
    "distribution": {
      "5": 72,
      "4": 31,
      "3": 15,
      "2": 7,
      "1": 3
    }
  }
}
```

### `GET /api/products/:productId/reviews`

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "rating": 5,
        "comment": "Kính rất chất lượng, tròng rõ nét",
        "customer": {
          "id": "uuid",
          "fullName": "Nguyễn Văn A",
          "avatarUrl": "https://..."
        },
        "images": [
          "https://supabase.../review-1.jpg"
        ],
        "reply": {
          "content": "Cảm ơn bạn đã tin tưởng sử dụng dịch vụ!",
          "repliedAt": "2026-01-15T10:00:00Z"
        },
        "isEditable": false,
        "createdAt": "2026-01-10T08:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 128,
      "totalPages": 13
    }
  }
}
```

### `POST /api/reviews`  201 Created

```json
{
  "statusCode": 201,
  "message": "Đánh giá của bạn đã được ghi nhận",
  "data": {
    "id": "uuid",
    "orderItemId": "uuid",
    "productId": "uuid",
    "rating": 5,
    "comment": "Kính rất chất lượng",
    "images": [],
    "status": "PUBLISHED",
    "editableUntil": "2026-01-17T08:30:00Z",
    "createdAt": "2026-01-10T08:30:00Z"
  }
}
```

---

## 12. EDGE CASES CẦN XỬ LÝ

| # | Tình huống | Cách xử lý |
|---|-----------|-----------|
| 1 | Order CANCELLED sau khi đã review | Không xảy ra  check status = COMPLETED trước khi cho review |
| 2 | Customer đổi/trả hàng sau khi đã review | Review giữ nguyên, không tự động xóa |
| 3 | Product bị soft delete (`deletedAt != null`) | Review vẫn hiển thị với thông tin sản phẩm tại thời điểm review |
| 4 | OrderItem có productType = SERVICE | Service layer từ chối: 400 "Loại sản phẩm này không hỗ trợ đánh giá" |
| 5 | Upload ảnh thất bại (Supabase lỗi) | Rollback transaction, không tạo review, trả về 500 |
| 6 | 2 request tạo review cùng 1 OrderItem đồng thời | `@unique` trên `orderItemId` bắt lỗi ở DB, trả về 409 |
| 7 | Customer bị BANNED sau khi đã có review | Review vẫn hiển thị công khai (dữ liệu độc lập) |
| 8 | Review bị HIDDEN, customer cố sửa | Service trả về 400: "Review đang bị ẩn, không thể chỉnh sửa" |

---

## 13. PHẠM VI NGOÀI MVP (Mở rộng sau)

- **Helpfulness voting:** "Review này có hữu ích không?" (like/dislike)
- **Review reminder:** Email/notification nhắc review sau 3 ngày order COMPLETED
- **Verified purchase badge:** Hiển thị nhãn "Đã mua hàng xác thực"
- **Review analytics dashboard:** Biểu đồ rating theo thời gian
- **AI spam detection:** Phát hiện review fake/spam tự động

---

## 14. THỨ TỰ IMPLEMENT

```
1. Cập nhật prisma/schema.prisma  -> thêm Review, ReviewImage model + enum ReviewStatus + relations ngược
2. Chạy migration                 -> prisma migrate dev
3. reviews.schema.ts              -> src/validations/zod/reviews.schema.ts
4. reviews.repository.ts          -> Prisma queries + Raw SQL
5. reviews.service.ts             -> Business logic + validate nghiệp vụ
6. reviews.controller.ts          -> HTTP handlers
7. reviews.routes.ts              -> Routes + middleware
8. Đăng ký router vào app.ts
```
