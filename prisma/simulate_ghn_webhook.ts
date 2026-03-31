// prisma/simulate_ghn_webhook.ts
import axios from 'axios';

async function simulateWebhook() {
  // THAY ĐỔI MÃ VẬN ĐƠN CỦA BẠN VÀO ĐÂY
  const TRACKING_NUMBER = 'GYK6XGP9';
  const API_URL = 'http://localhost:3000/api/logistics/ghn-webhook';

  console.log(`📡 Đang gửi giả lập Webhook cho đơn hàng: ${TRACKING_NUMBER}...`);

  const payload = {
    OrderCode: TRACKING_NUMBER,
    Status: 'delivered', // Trạng thái giao thành công
    Description: 'Shipper đã giao hàng và thu tiền (nếu có)',
    ClientOrderCode: '', // Để trống để test luồng tìm bằng Tracking Number
    Warehouse: 'Kho Quận 1'
  };

  try {
    const response = await axios.post(API_URL, payload);
    console.log('✅ Kết quả phản hồi từ Server của bạn:', response.data);
    console.log('\n--- KẾT QUẢ DỰ KIẾN TRÊN HỆ THỐNG ---');
    console.log('1. Đơn hàng trong DB sẽ tự động chuyển sang: COMPLETED');
    console.log('2. Tồn kho sản phẩm sẽ chính thức bị trừ (Quantity giảm).');
    console.log('3. Khách hàng nhận được thông báo: "Đơn hàng đã giao thành công"');
    console.log('------------------------------------\n');
  } catch (error: any) {
    console.error('❌ Lỗi khi gửi Webhook:', error.response?.data || error.message);
    console.log('Lưu ý: Hãy chắc chắn rằng server của bạn đang chạy (npm run dev)');
  }
}

simulateWebhook();
