// src/tests/test-orders.ts
import { ordersService } from '../modules/orders/orders.service';
import { prisma } from '../config/database';

async function testOrders() {
  console.log('--- STARTING ORDERS TEST ---');

  // 1. Setup mock customer and order
  const user = await prisma.user.create({
    data: {
      fullName: 'Order Tester',
      email: `order_test_${Date.now()}@example.com`,
      password: 'password',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    }
  });

  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      orderType: 'IN_STOCK',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      totalAmount: 250000,
    }
  });

  console.log(`Created test order ${order.id} for user ${user.id}`);

  // 2. Test Case 1: Handle Payment Success
  console.log('\nCase 1: Handling Payment Success (expecting status CONFIRMED)');
  await ordersService.handlePaymentSuccess(order.id);
  
  const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
  console.log(`Order Status: ${updatedOrder?.status}, Payment Status: ${updatedOrder?.paymentStatus}`);

  // 3. Test Case 2: Redundant Payment Success call
  console.log('\nCase 2: Redundant Payment Success call (testing idempotency)');
  await ordersService.handlePaymentSuccess(order.id);
  console.log('Call finished without error.');

  // Cleanup
  console.log('\nCleaning up...');
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('--- ORDERS TEST FINISHED ---');
}

testOrders()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
