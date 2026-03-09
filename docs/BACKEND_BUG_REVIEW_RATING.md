# BUG BACKEND: Review API Validation Error

## Vấn đề

**API**: `POST /reviews` và `PUT /reviews/:id` với `multipart/form-data`

**Lỗi**: 
```json
{
  "statusCode": 400,
  "message": "Validation error",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{
      "path": "body.rating",
      "message": "Expected number, received string"
    }]
  }
}
```

## Phân tích

### Khi KHÔNG có ảnh (application/json):
```javascript
POST /reviews
Content-Type: application/json

{
  "orderItemId": "...",
  "rating": 5,           // ← Number type
  "comment": "..."
}
```
✅ **Hoạt động bình thường**

### Khi CÓ ảnh (multipart/form-data):
```javascript
POST /reviews
Content-Type: multipart/form-data

------WebKitFormBoundary...
Content-Disposition: form-data; name="orderItemId"

65e006aa-fd6e-4d5e-8100-fd72f09e37de
------WebKitFormBoundary...
Content-Disposition: form-data; name="rating"

5                          // ← STRING "5", không phải number
------WebKitFormBoundary...
Content-Disposition: form-data; name="comment"

Sản phẩm tốt
------WebKitFormBoundary...
Content-Disposition: form-data; name="images"; filename="image.jpg"
Content-Type: image/jpeg

[binary data]
------WebKitFormBoundary...
```
❌ **Backend reject với lỗi "Expected number, received string"**

## Nguyên nhân

**HTTP multipart/form-data LUÔN gửi tất cả form fields dưới dạng TEXT STRINGS**.

Đây là chuẩn của HTTP protocol. Frontend **KHÔNG THỂ** gửi number type trong multipart/form-data.

Reference: https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4

## Giải pháp

### ✅ Backend cần update validation:

**Hiện tại (sai):**
```typescript
// Backend validation nghiêm ngặt yêu cầu type number
rating: z.number().min(1).max(5)
```

**Cần sửa thành:**
```typescript
// Chấp nhận string và tự động convert sang number
rating: z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? val : num;
    }
    return val;
  },
  z.number().min(1).max(5)
)
```

Hoặc nếu dùng class-validator:
```typescript
@Transform(({ value }) => parseInt(value, 10))
@IsInt()
@Min(1)
@Max(5)
rating: number;
```

## Tóm tắt

- ✅ Frontend đã implement đúng chuẩn
- ❌ Backend validation quá strict, không xử lý được string-to-number conversion
- 🔧 **Backend team cần fix validation** để parse string thành number cho multipart/form-data requests

## Impact

Hiện tại user **KHÔNG THỂ gửi review kèm ảnh**. Họ chỉ có thể gửi text-only review.

## Priority

**HIGH** - Chức năng review với ảnh hoàn toàn không hoạt động.
