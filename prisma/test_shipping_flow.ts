// prisma/test_shipping_flow.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
// Using relative imports as this script will be run by ts-node from project root
import { ordersService } from '../src/modules/orders/orders.service';
import { ordersRepository } from '../src/modules/orders/orders.repository';

const prisma = new PrismaClient();

async function testShipping() {
  console.log('🚀 Bắt đầu test luồng Shipping...');

  const customerId = '1d9e1b7f-a2d3-4547-a2cf-02182eb5e014'; // customer@example.com
  const productId = '00000000-0000-0000-0000-000000000021'; // Gọng Rayban

  try {
    // 1. Tạo đơn hàng HOME_DELIVERY
    console.log('1. Đang tạo đơn hàng Home Delivery...');
    const order = await ordersService.createOrder(customerId, {
      deliveryMethod: 'HOME_DELIVERY',
      shippingAddress: '123 Đường Test, Phường 1, Quận 1, TP.HCM',
      shippingProvinceId: 202, // HCM
      shippingDistrictId: 1442, // Quận 1
      shippingWardCode: '20106', // Phường Bến Nghé
      items: [
        { productId, quantity: 1 }
      ]
    });
    console.log(`✅ Đơn hàng đã tạo: #${order.id.slice(0, 8)} - Trạng thái: ${order.status}`);

    // 2. Chuyển trạng thái PAID (Bắt buộc để qua chốt chặn 100%)
    console.log('2. Đang cập nhật thanh toán PAID (100%)...');
    const confirmedOrder = await ordersService.updatePaymentStatus(order.id, 'PAID');
    console.log(`✅ Trạng thái thanh toán: ${confirmedOrder.paymentStatus} - Trạng thái đơn: ${confirmedOrder.status}`);

    // 3. Đưa đơn vào khâu xử lý (PROCESSING)
    console.log('3. Chuyển đơn sang PROCESSING...');
    // Cần phải ở READY_TO_PICKUP (WAITING_CUSTOMER) -> PROCESSING -> READY
    // Lưu ý: confirmOrder -> WAITING_CUSTOMER
    await ordersService.confirmAndSetAppointment(order.id, {
        appointmentDate: new Date(Date.now() + 86400000).toISOString(),
    });
    const processingOrder = await ordersService.startProcessing(order.id, '3976808d-6c40-4e61-9a0c-4487e9930a85');
    console.log(`✅ Đơn đang xử lý: ${processingOrder.status}`);

    // 4. Mark AS READY (Kích hoạt đẩy đơn GHN)
    console.log('4. Đang gọi markAsReady (Kích hoạt đẩy GHN)...');
    const shipmentOrder = await ordersService.markAsReady(order.id);
    
    // Lấy lại dữ liệu mới nhất để xem mã vận đơn
    const finalOrder = await ordersRepository.findById(shipmentOrder.id);
    
    console.log('\n--- KẾT QUẢ TEST ---');
    console.log(`ID Đơn hàng: ${finalOrder?.id}`);
    console.log(`Trạng thái đơn: ${finalOrder?.status}`);
    console.log(`Nhà vận chuyển: ${finalOrder?.shippingProvider}`);
    console.log(`Mã vận đơn (GHN): ${finalOrder?.trackingNumber}`);
    console.log(`Phí thu hộ (COD): ${finalOrder?.totalAmount} -> Phải là 0đ nếu Paid 100%`);
    console.log(`Trạng thái GHN: ${finalOrder?.shippingStatus}`);
    console.log('--------------------\n');

  } catch (error: any) {
    console.error('❌ Lỗi khi test:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testShipping();
