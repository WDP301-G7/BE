// src/tests/test-preorder.ts
import { ordersService } from '../modules/orders/orders.service';
import { prisma } from '../config/database';

async function testPreorder() {
  console.log('--- STARTING PRE-ORDER TEST ---');

  // 1. Setup mock category and products
  const category = await prisma.category.create({
    data: { name: 'Test Preorder Category' }
  });

  // Normal product (in stock)
  const productInStock = await prisma.product.create({
    data: {
      name: 'In Stock Product',
      price: 100000,
      type: 'FRAME',
      categoryId: category.id,
      isPreorder: false,
    }
  });

  // Pre-order product (LENS)
  const productPreorderLens = await prisma.product.create({
    data: {
      name: 'Pre-order Lens',
      price: 200000,
      type: 'LENS',
      categoryId: category.id,
      isPreorder: true,
      leadTimeDays: 7,
    }
  });

  // Pre-order product (FRAME) - to test max lead time
  const productPreorderFrame = await prisma.product.create({
    data: {
      name: 'Pre-order Frame',
      price: 500000,
      type: 'FRAME',
      categoryId: category.id,
      isPreorder: true,
      leadTimeDays: 10,
    }
  });

  // Store and inventory (only for in-stock, preorder will have 0)
  const store = await prisma.store.create({
    data: { name: 'Test Store', address: '123' }
  });

  await prisma.inventory.create({
    data: {
      productId: productInStock.id,
      storeId: store.id,
      quantity: 10,
      reservedQuantity: 0
    }
  });

  const user = await prisma.user.create({
    data: {
      fullName: 'Preorder Tester',
      email: `preorder_${Date.now()}@example.com`,
      password: 'password',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    }
  });

  console.log('Setup finished. Testing Pre-order identification.');

  // 2. Test Case 1: Order with Pre-order item (Combo: 1 Frame In Stock + 1 Lens Preorder)
  console.log('\nCase 1: Creating order with a Pre-order item (1 Frame In Stock + 1 Lens Preorder)');
  const order = await ordersService.createOrder(user.id, {
    items: [
      { productId: productInStock.id, quantity: 1 },
      { productId: productPreorderLens.id, quantity: 1 },
    ]
  });

  console.log(`Order Created. Type: ${order.orderType}`);
  console.log(`Expected Ready Date: ${order.expectedReadyDate}`);

  if (order.orderType === 'PRE_ORDER' && order.expectedReadyDate) {
    console.log('✅ Success: Order correctly identified as PRE_ORDER with expected date.');
  } else {
    console.log('❌ Failure: Order type or expected date is incorrect.');
  }

  // 3. Test Case 2: Stock check bypass and Max Lead Time (1 Frame Preorder (10d) + 1 Lens Preorder (7d))
  console.log('\nCase 2: Testing stock check bypass and Max Lead Time (1 Frame Preorder 10d + 1 Lens Preorder 7d)');
  const pOrder = await ordersService.createOrder(user.id, {
    items: [
      { productId: productPreorderFrame.id, quantity: 1 },
      { productId: productPreorderLens.id, quantity: 1 }
    ]
  });
  console.log(`Pre-order created successfully. Type: ${pOrder.orderType}`);
  console.log(`Expected Ready Date: ${pOrder.expectedReadyDate} (Should be roughly 10 days from now)`);

  // Cleanup
  console.log('\nCleaning up...');
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [order.id, pOrder.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [order.id, pOrder.id] } } });
  await prisma.inventory.deleteMany({ where: { productId: productInStock.id } });
  await prisma.store.delete({ where: { id: store.id } });
  await prisma.product.deleteMany({ where: { id: { in: [productInStock.id, productPreorderLens.id, productPreorderFrame.id] } } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.category.delete({ where: { id: category.id } });

  console.log('--- PRE-ORDER TEST FINISHED ---');
}

testPreorder()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
