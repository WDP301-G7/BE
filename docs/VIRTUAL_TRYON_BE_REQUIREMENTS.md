# Virtual Try-On (Thử Kính Ảo) — Yêu Cầu Backend

> **Dự án:** WDP301 — Ứng dụng mắt kính  
> **Tính năng:** Thử kính ảo với mô hình 3D  
> **Ngày tạo:** 23/03/2026  
> **Phiên bản tài liệu:** 1.0

---

## 1. Tổng quan tính năng

Tính năng **Thử kính ảo** cho phép khách hàng xem thử kính trực tiếp qua camera điện thoại và xoay tương tác với mô hình 3D của sản phẩm.

**Logic hiển thị:**
- ✅ Sản phẩm có `model3dUrl` → Hiển thị nút **"Thử kính ảo"** trên trang chi tiết sản phẩm
- ❌ Sản phẩm **không có** `model3dUrl` (null/empty) → **Ẩn** nút thử kính ảo hoàn toàn

---

## 2. Thay đổi Database

### 2.1 Bảng `products` — Thêm cột mới

```sql
ALTER TABLE products
  ADD COLUMN model3d_url VARCHAR(2048) NULL DEFAULT NULL,
  ADD COLUMN model3d_format VARCHAR(20) NULL DEFAULT NULL,
  ADD COLUMN model3d_size_bytes INTEGER NULL DEFAULT NULL,
  ADD COLUMN model3d_updated_at TIMESTAMP NULL DEFAULT NULL;
```

| Cột | Kiểu | Nullable | Mô tả |
|-----|------|----------|-------|
| `model3d_url` | `VARCHAR(2048)` | ✅ YES | URL tới file 3D model (.glb hoặc .gltf) trên cloud storage (S3/Cloudinary/...) |
| `model3d_format` | `VARCHAR(20)` | ✅ YES | Định dạng file: `GLB` hoặc `GLTF` |
| `model3d_size_bytes` | `INTEGER` | ✅ YES | Kích thước file (bytes) — dùng để hiển thị cảnh báo nếu file lớn |
| `model3d_updated_at` | `TIMESTAMP` | ✅ YES | Thời gian cập nhật model 3D gần nhất |

> **Lưu ý:** Chỉ sản phẩm loại `FRAME` (gọng kính) mới cần có model 3D. Sản phẩm loại `LENS` và `SERVICE` không cần trường này.

---

## 3. Thay đổi API

### 3.1 `GET /products/:id` — Thêm trường `model3dUrl` vào response

**Hiện tại**, response trả về:
```json
{
  "statusCode": 200,
  "message": "Product retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "Gọng kính Rayban RB5154",
    "type": "FRAME",
    "price": "3500000",
    "brand": "Rayban",
    "description": "...",
    "isPreorder": false,
    "leadTimeDays": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "error": null
}
```

**Sau khi cập nhật**, thêm trường:
```json
{
  "statusCode": 200,
  "message": "Product retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "Gọng kính Rayban RB5154",
    "type": "FRAME",
    "price": "3500000",
    "brand": "Rayban",
    "description": "...",
    "isPreorder": false,
    "leadTimeDays": null,
    "model3dUrl": "https://storage.googleapis.com/your-bucket/models/rayban-rb5154.glb",
    "model3dFormat": "GLB",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "error": null
}
```

> **Quan trọng:** `model3dUrl` = `null` nếu sản phẩm chưa có model 3D. FE sẽ dựa vào giá trị này để quyết định có hiển thị nút "Thử kính ảo" hay không.

---

### 3.2 `GET /products` (List) — Thêm `model3dUrl` (tuỳ chọn)

Để FE có thể hiển thị badge "Hỗ trợ thử kính ảo" trong danh sách sản phẩm mà không cần gọi thêm API:

```json
{
  "statusCode": 200,
  "message": "Products retrieved successfully",
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "Gọng kính Rayban RB5154",
        "type": "FRAME",
        "price": "3500000",
        "model3dUrl": "https://...",
        ...
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 }
  }
}
```

---

### 3.3 `GET /products/:id/try-on` (**Endpoint mới**)

Endpoint riêng để FE kiểm tra thông tin virtual try-on của sản phẩm. Hữu ích khi FE chỉ cần kiểm tra nhanh mà không load toàn bộ product detail.

**Request:**
```
GET /products/:id/try-on
Authorization: Bearer <token>  (tùy chọn — có thể public)
```

**Response khi có model 3D:**
```json
{
  "statusCode": 200,
  "message": "Try-on info retrieved successfully",
  "data": {
    "productId": "uuid",
    "hasTryOn": true,
    "model3dUrl": "https://storage.googleapis.com/your-bucket/models/rayban-rb5154.glb",
    "model3dFormat": "GLB",
    "model3dSizeBytes": 2048000
  },
  "error": null
}
```

**Response khi không có model 3D:**
```json
{
  "statusCode": 200,
  "message": "Try-on info retrieved successfully",
  "data": {
    "productId": "uuid",
    "hasTryOn": false,
    "model3dUrl": null,
    "model3dFormat": null,
    "model3dSizeBytes": null
  },
  "error": null
}
```

**Response khi sản phẩm không tồn tại:**
```json
{
  "statusCode": 404,
  "message": "Product not found",
  "data": null,
  "error": "NOT_FOUND"
}
```

---

### 3.4 `POST /products/:id/try-on` (**Endpoint mới — Dành cho Admin/Staff**)

Upload và gắn file model 3D vào sản phẩm.

**Request (multipart/form-data):**
```
POST /products/:id/try-on
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data

Fields:
  - model3dFile: File (.glb hoặc .gltf, tối đa 50MB)
```

**Hoặc Request (JSON với URL):**
```json
{
  "model3dUrl": "https://your-cdn.com/models/product.glb",
  "model3dFormat": "GLB"
}
```

**Response thành công:**
```json
{
  "statusCode": 200,
  "message": "3D model uploaded successfully",
  "data": {
    "productId": "uuid",
    "model3dUrl": "https://storage.googleapis.com/your-bucket/models/product.glb",
    "model3dFormat": "GLB",
    "model3dSizeBytes": 2048000,
    "model3dUpdatedAt": "2026-03-23T10:00:00.000Z"
  },
  "error": null
}
```

**Validation:**
- Chỉ cho phép file `.glb` hoặc `.gltf`
- Kích thước file tối đa: **50 MB**
- Chỉ sản phẩm loại `FRAME` mới được upload model 3D (trả về 400 nếu type khác)
- Chỉ Admin/Staff mới có quyền gọi endpoint này

---

### 3.5 `DELETE /products/:id/try-on` (**Endpoint mới — Dành cho Admin/Staff**)

Xóa model 3D khỏi sản phẩm.

**Request:**
```
DELETE /products/:id/try-on
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "3D model removed successfully",
  "data": { "productId": "uuid" },
  "error": null
}
```

---

## 4. File 3D Model — Yêu Cầu Kỹ Thuật

### 4.1 Định dạng hỗ trợ

| Định dạng | Ưu tiên | Mô tả |
|-----------|---------|-------|
| **GLB** | ✅ Khuyến nghị | Binary GLTF — 1 file duy nhất, dễ upload và serve |
| GLTF + files | ⚠️ Hạn chế | Gồm nhiều file, phức tạp hơn |

> **FE sử dụng thư viện [model-viewer](https://modelviewer.dev/) của Google** — hỗ trợ cả GLB và GLTF. **Khuyến nghị dùng GLB**.

### 4.2 Giới hạn kỹ thuật

| Thông số | Giới hạn | Lý do |
|----------|---------|-------|
| Kích thước file | **≤ 20 MB** (khuyến nghị ≤ 10 MB) | Tránh tải chậm trên mobile |
| Số lượng polygon | ≤ 100,000 | Đảm bảo hiệu năng render |
| Số texture | ≤ 4 textures | Giảm bộ nhớ GPU |
| Độ phân giải texture | ≤ 2048×2048 px | |
| Kích thước thực tế | Đúng tỷ lệ thực (đơn vị: mét) | Hiển thị đúng trên AR |

### 4.3 Hướng dẫn tạo file GLB cho kính mắt

1. **Thiết kế 3D:** Dùng Blender (miễn phí) hoặc 3ds Max
2. **Tối ưu hoá model:** Dùng plugin [GLTF-Transform](https://gltf-transform.dev/) để giảm kích thước
3. **Kiểm tra:** Xem trước tại [https://modelviewer.dev/editor/](https://modelviewer.dev/editor/)
4. **Upload:** Dùng S3/Cloudinary/Firebase Storage, đảm bảo URL **có thể truy cập công khai (public read)**

### 4.4 Yêu cầu CORS cho file storage

File GLB phải được serve với CORS header cho phép truy cập từ WebView của app:
```
Access-Control-Allow-Origin: *
Content-Type: model/gltf-binary
```

---

## 5. Sơ đồ luồng hoạt động

```
┌─────────────────────────────────────────────────┐
│              Màn hình Chi tiết sản phẩm          │
│                                                  │
│  GET /products/:id                               │
│  ┌─────────────────────────────────────┐         │
│  │ product.model3dUrl !== null ?        │         │
│  └─────────────┬───────────────────────┘         │
│                │                                 │
│        YES     │          NO                     │
│         ┌──────┘          └──────┐               │
│         ▼                        ▼               │
│  ┌─────────────┐         ┌─────────────┐         │
│  │ Hiện nút    │         │ Ẩn nút      │         │
│  │"Thử kính ảo"│         │"Thử kính ảo"│         │
│  └──────┬──────┘         └─────────────┘         │
│         │                                        │
│         ▼                                        │
│  Điều hướng sang VirtualTryOnScreen              │
│  Truyền: { product, model3dUrl }                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              VirtualTryOnScreen                  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  expo-camera CameraView (live camera)    │    │
│  │  + Overlay hình kính lên vùng mặt        │    │
│  │  + Nút chụp ảnh / chia sẻ               │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Nút "Xem mô hình 3D tương tác"                  │
│         │                                        │
│         ▼                                        │
│  ┌──────────────────────────────────────────┐    │
│  │  Modal WebView                            │    │
│  │  HTML: Google model-viewer               │    │
│  │  src="{model3dUrl}"                      │    │
│  │  Xoay 3D / Zoom / AR mode               │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 6. Thư viện FE đã sử dụng

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `expo-camera` | ~15.0.x (SDK 54) | Live camera feed, chụp ảnh |
| `expo-media-library` | ~18.0.x | Lưu ảnh vào thư viện điện thoại |
| `expo-sharing` | ~13.0.x | Chia sẻ ảnh lên app khác |
| `react-native-webview` | 13.15.0 | Render HTML + model-viewer |
| `model-viewer` | 3.4.0 (CDN) | Render GLB 3D model, hỗ trợ AR |

> **model-viewer** được load qua CDN trong HTML string của WebView, không cần cài npm package.

---

## 7. Permissions cần khai báo trên BE / CMS

Khi upload model 3D từ Dashboard Admin, cần thêm permission:

| Permission | Mô tả |
|-----------|-------|
| `product:upload_3d_model` | Upload file GLB/GLTF cho sản phẩm |
| `product:delete_3d_model` | Xóa model 3D của sản phẩm |

---

## 8. Checklist cho Team Backend

- [ ] Thêm cột `model3d_url`, `model3d_format`, `model3d_size_bytes`, `model3d_updated_at` vào bảng `products`
- [ ] Chạy migration database
- [ ] Cập nhật `ProductService.getById()` — thêm `model3dUrl` vào response
- [ ] Cập nhật `ProductService.getAll()` — thêm `model3dUrl` vào response list
- [ ] Tạo endpoint `GET /products/:id/try-on`
- [ ] Tạo endpoint `POST /products/:id/try-on` (Admin)
- [ ] Tạo endpoint `DELETE /products/:id/try-on` (Admin)
- [ ] Tích hợp cloud storage (S3 / Cloudinary / Firebase) để lưu file GLB
- [ ] Cấu hình CORS cho bucket storage (`Access-Control-Allow-Origin: *`)
- [ ] Thêm validation: chỉ file `.glb`/`.gltf`, tối đa 50MB
- [ ] Thêm validation: chỉ sản phẩm type `FRAME` mới được upload model 3D
- [ ] Cập nhật Swagger/API docs
- [ ] Test upload và serve file GLB qua URL public

---

## 9. Ví dụ test URL model 3D

Team BE có thể dùng các URL mẫu sau để test trước khi có model thật:

```
# Kính mắt mẫu (file GLB public)
https://modelviewer.dev/shared-assets/models/Astronaut.glb

# Test nhanh model-viewer với URL trên:
# Mở https://modelviewer.dev/editor/ → dán URL vào ô "src"
```

---

## 10. Liên hệ

Nếu team BE có thắc mắc về format dữ liệu hoặc cách FE sử dụng, vui lòng liên hệ team FE để phối hợp thêm.
