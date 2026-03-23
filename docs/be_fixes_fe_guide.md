# HƯỚNG DẪN TÍCH HỢP BE-FE: CÁC CẢI TIẾN SAU AUDIT

Tài liệu này tổng hợp toàn bộ các thay đổi ở Backend (BE) và hướng dẫn team Frontend (FE) cách tương thích với hệ thống mới.

---

## 1. Các thay đổi quan trọng ở Backend (BE)

| Hạng mục | Thay đổi ở BE | Tác động / Kỳ vọng |
| :--- | :--- | :--- |
| **Tiền tệ (VND)** | Schema đổi từ `Decimal(10, 2)` sang `Decimal(15, 2)`. | Hỗ trợ các con số lớn (nghìn tỷ) mà không bị lỗi. |
| **Hiệu năng (N+1)** | Refactor logic [OrdersService](file:///c:/Users/Administrator/Desktop/BE-WDP/src/modules/orders/orders.service.ts#33-903) để query batch (1 lần lấy tất cả). | API đặt hàng/xác thực sẽ phản hồi nhanh hơn đáng kể. |
| **Stock (Race Condition)** | Cập nhật tồn kho theo cơ chế Atomic SQL (an toàn đa luồng). | Giảm thiểu tối đa lỗi "đặt hàng thành công nhưng thực tế hết hàng". |
| **Cấu hình động** | Chuyển toàn bộ hằng số kinh doanh (Deadline, Max Images, v.v.) vào Database. | Admin có thể thay đổi luật chơi mà không cần sửa code BE. |
| **Auth Error** | Middleware hiện trả về lỗi chi tiết hơn (ví dụ: `Invalid token`, `Token expired`). | FE có thể báo lỗi chính xác cho người dùng. |

---

## 2. Team Frontend (FE) CẦN làm gì?

1.  **Hiển thị cấu hình động (Cực kỳ quan trọng)**:
    - **Reviews**: Thay vì dùng hằng số `3` ảnh ở phía FE, hãy tôn trọng giá trị trả về từ BE (nếu FE build trang Admin UI cho Settings).
    - **Membership**: Các giá trị mặc định của Bảo hành/Đổi trả/Khuyến mãi giờ đây có thể thay đổi linh hoạt. FE nên ưu tiên dùng dữ liệu trả về từ API [getMembershipStatus](file:///c:/Users/Administrator/Desktop/BE-WDP/src/modules/membership/membership.service.ts#68-120).
2.  **Xử lý lỗi Authentication**:
    - Cập nhật UI để hiển thị message lỗi chính xác từ `response.data.message`. Đừng mặc định hiển thị "Lỗi đăng nhập" cho mọi mã 401.
3.  **Xử lý số liệu tiền tệ**:
    - Khi hiển thị giá tiền lớn (mới), hãy đảm bảo thư viện format tiền tệ (như `Intl.NumberFormat`) xử lý tốt prefix/suffix VND.

---

## 3. Team Frontend (FE) KHÔNG CẦN làm gì?

1.  **KHÔNG CẦN thay đổi API endpoint**: Các endpoint cũ (`/orders/create`, `/auth/login`, v.v.) vẫn giữ nguyên cấu trúc Request/Response.
2.  **KHÔNG CẦN thay đổi logic tính toán Discount**: BE đã xử lý việc fetch % giảm giá mặc định và tính toán số tiền cuối cùng một cách chính xác. FE chỉ việc hiển thị.
3.  **KHÔNG CẦN thay đổi logic xử lý Stock**: Toàn bộ việc tranh chấp (race condition) và batching (N+1) đã được giải quyết triệt để ở BE.
4.  **KHÔNG CẦN thay đổi Logic Token**: BE vẫn dùng cơ chế JWT cũ, chỉ cải thiện phần xử lý lỗi nội bộ để an toàn hơn.

---

## 4. Ghi chú tiếp theo
Admin hiện đã có một bảng `SystemSetting` trong DB để thay đổi các tham số sau mà không cần can thiệp vào mã nguồn:
- `review.deadline_days`: Hạn chót viết đánh giá.
- `review.max_images`: Số lượng ảnh đánh giá tối đa.
- `membership.default_discount_percent`: % giảm giá cho khách mới.
- `membership.default_warranty_months`: Thời hạn bảo hành mặc định.
- `product.max_image_size_mb`: Giới hạn dung lượng upload ảnh.

> [!NOTE]
> Để xây dựng trang Admin UI chỉnh sửa các cấu hình này, hãy sử dụng các Endpoint mới dưới đây.

---

## 4. API Quản lý Cấu hình (Dành cho Admin)

Team FE có thể xây dựng giao diện quản lý cấu hình hệ thống dựa trên các API mới sau (Yêu cầu quyền `ADMIN`):

| Method | Endpoint | Mô tả | Body |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/settings` | Lấy danh sách tất cả cấu hình. | Không |
| **PATCH** | `/api/v1/settings/:key` | Cập nhật giá trị một cấu hình. | `{ "value": "20", "description": "Ghi chú mới" }` |

**Các lưu ý cho FE khi dùng API này:**
- **Key**: Là định danh duy nhất (ví dụ: `review.max_images`).
- **Value**: Mọi giá trị gửi lên đều được BE xử lý và cast theo đúng `type` đã định nghĩa trong DB (NUMBER, STRING, BOOLEAN, JSON).
- **Phân quyền**: Các endpoint này được bảo vệ bởi [authMiddleware](file:///c:/Users/Administrator/Desktop/BE-WDP/src/middlewares/auth.middleware.ts#19-48) và yêu cầu người dùng có Role `ADMIN`.

---
**Tài liệu liên quan**:
- [Tóm tắt kỹ thuật (fix_summary.md)](file:///C:/Users/Administrator/.gemini/antigravity/brain/b87d71cb-4004-494b-98d9-990f447e0d85/fix_summary.md)
- [Báo cáo Audit chi tiết (audit_report.md)](file:///C:/Users/Administrator/.gemini/antigravity/brain/b87d71cb-4004-494b-98d9-990f447e0d85/audit_report.md)
