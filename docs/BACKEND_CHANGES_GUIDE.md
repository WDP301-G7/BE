# Tổng hợp thay đổi Backend & Hướng dẫn dành cho Frontend (FE)

Tài liệu này tóm tắt các thay đổi logic quan trọng đã được thực hiện ở phía Backend và các lưu ý tương ứng cho phía Frontend để đảm bảo hệ thống vận hành ổn định.

---

## 1. Module Kho hàng (Inventory)
- **Thay đổi**: Đã áp dụng tính nguyên tử (Atomicity) cho việc giữ hàng. Hệ thống hiện tại sẽ kiểm tra tồn kho và giữ hàng trong một bước duy nhất ở tầng Database.
- **Tác động FE**: 
    - **Không cần thay đổi mã nguồn**.
    - **Lưu ý**: Nếu kho hàng không đủ, API sẽ trả về lỗi `400 BadRequestError` với thông báo: `"Not enough available quantity for this request."`. FE nên hiển thị thông báo này cho người dùng.

---

## 2. Module Thanh toán (Payments - VNPay)
- **Thay đổi**: Bổ sung bước xác thực số tiền (`amount`) trả về từ VNPay so với số tiền trong đơn hàng ban đầu.
- **Tác động FE**: 
    - **Không cần thay đổi mã nguồn**.
    - **Bảo mật**: Đảm bảo FE không tự ý can thiệp vào tham số `vnp_Amount` khi tạo URL thanh toán. Nếu số tiền gửi lên VNPay khác với số tiền Backend ghi nhận, giao dịch IPN sẽ bị từ chối với mã lỗi `04` (Amount mismatch).

---

## 3. Module Thành viên (Membership)
- **Thay đổi**: 
    - Tự động hóa việc tích lũy chi tiêu một cách nguyên tử để tránh sai lệch dữ liệu khi có nhiều đơn hàng hoàn thành cùng lúc.
    - Áp dụng Caching (10 phút) cho danh sách các hạng thành viên (Tiers).
- **Tác động FE**: 
    - **Không cần thay đổi mã nguồn**.
    - **Lưu ý**: Do có cơ chế cache, nếu Admin thay đổi cấu hình hạng thành viên (ví dụ: đổi \% giảm giá), có thể mất tối đa 10 phút để thay đổi đó có hiệu lực hoàn toàn trên toàn hệ thống.

---

## 4. Luồng Đơn hàng (Orders & Pre-order)
- **Thay đổi**: 
    - Tự động nhận diện loại đơn hàng: Nếu có sản phẩm Pre-order, `orderType` sẽ tự động là `PRE_ORDER`.
    - Tính toán ngày dự kiến: Backend tự động tính `expectedReadyDate` dựa trên thời gian chờ của sản phẩm cao nhất trong đơn hàng.
- **Hướng dẫn cho FE**:
    - **Hiển thị thông tin**: FE có thể kiểm tra trường `orderType` (nếu là `PRE_ORDER`) và hiển thị trường `expectedReadyDate` trên giao diện chi tiết đơn hàng hoặc lịch sử mua hàng để khách hàng biết thời gian chờ dự kiến.
    - **Quy tắc combo**: Backend vẫn bắt buộc combo gồm **1 Gọng (FRAME) + 1 Tròng (LENS)**. FE cần đảm bảo luồng chọn hàng tuân thủ quy tắc này trước khi gửi yêu cầu tạo đơn hàng.

---

## 5. Luồng Đổi trả (Returns & Exchange)
- **Thay đổi**: 
    - Tối ưu hóa việc hoàn kho: Chỉ những sản phẩm có tình trạng tốt (`NEW`, `LIKE_NEW`, `GOOD`) mới được tự động cộng lại vào kho.
    - Xử lý đổi hàng (Exchange): Backend tự động trừ kho của sản phẩm mới một cách chính xác và ném lỗi nếu không đủ tồn kho để đổi.
    - **Nhập giá cuối thủ công**: Khi hoàn tất đơn đổi trả, nhân viên có quyền nhập tay số tiền cuối cùng (`finalAmount`) để xử lý các trường hợp bù trừ đặc biệt hoặc giảm giá thêm.
- **Tác động FE**: 
    - **Cập nhật giao diện**: Trong màn hình Hoàn tất Đổi/Trả (Staff), FE cần cung cấp ô nhập liệu cho trường `finalAmount`.
    - **Xử lý logic**: Khi gọi API `completeReturn`, hãy gửi kèm trường `finalAmount` (kiểu number) nếu nhân viên có thay đổi. Nếu không gửi, Backend sẽ sử dụng giá trị tính toán mặc định.

---

## 6. Tổng kết
Tất cả các thay đổi trên đều nhằm mục đích tăng độ tin cậy và hiệu suất của hệ thống. **Cấu trúc API (API Input/Output) hoàn toàn không thay đổi**, vì vậy phía FE có thể triển khai bản cập nhật này mà không lo ngại về lỗi tương thích.

### Các tài liệu liên quan:
- `docs/BACKEND_BUG_REVIEW_RATING.md` (Thông tin bổ sung về các lỗi đã được rà soát)
- `src/tests/` (Các bộ test case đã chạy thành công cho các luồng trên)
