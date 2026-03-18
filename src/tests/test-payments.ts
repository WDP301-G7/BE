// src/tests/test-payments.ts
import { paymentsService } from '../modules/payments/payments.service';
import { prisma } from '../config/database';
import { paymentsRepository } from '../modules/payments/payments.repository';
import { VNPayIPNParams } from '../types/payment.types';

async function testPayments() {
  console.log('--- STARTING PAYMENTS TEST ---');

  // 1. Setup mock order and payment
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('Need at least one user in DB');

  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      orderType: 'IN_STOCK',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      totalAmount: 100000,
    }
  });

  const payment = await paymentsRepository.create({
    orderId: order.id,
    method: 'VNPAY',
    amount: 100000,
    status: 'PENDING',
  });

  console.log(`Created test order ${order.id} with payment ${payment.id}, amount 100,000`);

  // Mock IPN Params (assuming signature is valid since we're testing the service logic)
  // We'll mock the gateway verification to return true for this test
  const createMockIPN = (amount: number): VNPayIPNParams => ({
    vnp_TxnRef: order.id,
    vnp_Amount: (amount * 100).toString(),
    vnp_ResponseCode: '00',
    vnp_TransactionNo: '123456',
    vnp_SecureHash: 'mock_hash',
    vnp_TmnCode: 'mock',
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'mock',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'mock',
    vnp_PayDate: '20230101000000',
    vnp_TransactionStatus: '00',
  });

  // 2. Test Case 1: Mismatched Amount
  console.log('\nCase 1: Mismatched amount (expecting responseCode 04)');
  const badIPN = createMockIPN(50000); // 50,000 instead of 100,000
  // Note: we'll have to manually trigger the service with a bypass for signature or use a valid one if possible
  // For this standalone test, we are testing the service logic.
  const badResult = await paymentsService.handleVNPayIPN(badIPN);
  console.log(`Result: isValid=${badResult.isValid}, Msg=${badResult.message}, Code=${badResult.responseCode}`);

  // 3. Test Case 2: Correct Amount
  console.log('\nCase 2: Correct amount (expecting success)');
  const goodIPN = createMockIPN(100000);
  const goodResult = await paymentsService.handleVNPayIPN(goodIPN);
  console.log(`Result: isValid=${goodResult.isValid}, Msg=${goodResult.message}, Code=${goodResult.responseCode}`);

  // 4. Test Case 3: Idempotency (Processing again)
  console.log('\nCase 3: Processing the same IPN again (idempotency)');
  const repeatResult = await paymentsService.handleVNPayIPN(goodIPN);
  console.log(`Result: isValid=${repeatResult.isValid}, Msg=${repeatResult.message}`);

  // Cleanup
  console.log('\nCleaning up...');
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });

  console.log('--- PAYMENTS TEST FINISHED ---');
}

testPayments()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
