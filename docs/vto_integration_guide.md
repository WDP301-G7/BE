# HƯỚNG DẪN TÍCH HỢP: VIRTUAL TRY-ON (THỬ KÍNH ẢO)

Tài liệu này hướng dẫn team Frontend (FE) cách tích hợp tính năng Thử kính ảo (VTO) sử dụng các API mới từ Backend.

---

## 1. Thay đổi ở Backend (BE)

| Hạng mục | Chi tiết | Tác động đến FE |
| :--- | :--- | :--- |
| **Model Dữ liệu** | Thêm `model3dUrl`, `model3dFormat`, `model3dSizeBytes` vào Product. | FE có thể biết ngay sản phẩm nào có hỗ trợ 3D model từ API lấy danh sách/chi tiết. |
| **Endpoint Mới** | `GET /id/try-on`, `POST /id/try-on`, `DELETE /id/try-on`. | Hỗ trợ quản lý chuyên sâu model 3D (đặc biệt cho trang Admin). |
| **Bộ nhớ (Supabase)** | Sử dụng bucket `models` để lưu file `.glb`/`.gltf`. | File được serve trực tiếp qua URL public, có hỗ trợ CORS. |

---

## 2. Team Frontend (FE) CẦN làm gì?

1.  **Kiểm tra tính năng VTO**:
    - Sử dụng trường `model3dUrl` trong response của `GET /products/:id`.
    - Nếu `model3dUrl !== null`, hiển thị nút **"Thử kính ảo"**.
    - Nếu `null`, ẩn nút hoàn toàn.
2.  **Hiển thị Model 3D**:
    - Sử dụng thư viện `model-viewer` (đã thống nhất) để render file `.glb`.
    - Truyền `model3dUrl` vào thuộc tính `src` của component.
3.  **Xử lý Kích thước File**:
    - Sử dụng `model3dSizeBytes` để hiển thị cảnh báo nếu file lớn (ví dụ > 10MB) trước khi tải, nhằm tối ưu trải nghiệm người dùng mobile.
4.  **Trang Quản trị (Admin UI)**:
    - Xây dựng form upload model 3D cho sản phẩm loại `FRAME`.
    - Sử dụng `POST /api/products/:id/try-on` với `multipart/form-data`, field name là `model3dFile`.

---

## 3. API Reference cho VTO

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/products/:id/try-on` | Public | Lấy thông tin model 3D nhanh (productId, hasTryOn, url, format, size). |
| **POST** | `/api/products/:id/try-on` | Admin/Staff | Upload hoặc cập nhật file `.glb`/`.gltf`. (Max 50MB). |
| **DELETE** | `/api/products/:id/try-on` | Admin/Staff | Xóa model 3D khỏi sản phẩm. |

---

## 4. Lưu ý Kỹ thuật

- **Định dạng file**: Ưu tiên sử dụng `.glb` (Binary GLTF) để có hiệu năng tốt nhất trên Mobile và WebView.
- **CORS**: File được lưu tại Supabase. Team BE đã cấu hình CORS (`Access-Control-Allow-Origin: *`) để WebView có thể fetch file mà không bị chặn.
- **Validation**:
    - Chỉ sản phẩm có `type: "FRAME"` mới hỗ trợ VTO.
    - API sẽ trả về lỗi `400` nếu cố gắng upload model cho `LENS` hoặc `SERVICE`.

---
**Tài liệu liên quan**:
- [Kế hoạch triển khai (implementation_plan.md)](file:///C:/Users/Administrator/.gemini/antigravity/brain/5cbb8909-fd06-4d11-880a-2bfa806da07f/implementation_plan.md)
- [Báo cáo hoàn thành (walkthrough.md)](file:///C:/Users/Administrator/.gemini/antigravity/brain/5cbb8909-fd06-4d11-880a-2bfa806da07f/walkthrough.md)
