// src/tests/test-inventory.ts
import { inventoryRepository } from '../modules/inventory/inventory.repository';
import { prisma } from '../config/database';

async function testInventory() {
  console.log('--- STARTING INVENTORY TEST ---');

  // 1. Setup mock product and inventory
  const category = await prisma.category.create({
    data: { name: 'Test Category' }
  });

  const product = await prisma.product.create({
    data: {
      name: 'Test Product',
      price: 100,
      type: 'FRAME',
      categoryId: category.id
    }
  });

  const store = await prisma.store.create({
    data: { name: 'Test Store', address: '123 Test St' }
  });

  const inventory = await prisma.inventory.create({
    data: {
      productId: product.id,
      storeId: store.id,
      quantity: 10,
      reservedQuantity: 0
    }
  });

  console.log(`Created test inventory: ID=${inventory.id}, Qty=10, Reserved=0`);

  // 2. Test Case 1: Simple reservation
  console.log('\nCase 1: Simple reservation of 5 units');
  await inventoryRepository.reserveWithCheck(inventory.id, 5);
  let updated = await inventoryRepository.findById(inventory.id);
  console.log(`Reserved 5. Current Reserved: ${updated?.reservedQuantity}`);

  // 3. Test Case 2: Reservation exceeding quantity
  console.log('\nCase 2: Reservation exceeding available quantity (expecting error)');
  try {
    await inventoryRepository.reserveWithCheck(inventory.id, 6); // Total would be 11/10
    console.log('Error: Reservation should have failed');
  } catch (error: any) {
    console.log(`Success: Caught expected error: ${error.message}`);
  }

  // 4. Test Case 3: Concurrent reservations
  console.log('\nCase 3: Concurrent reservations (simulating race condition)');
  // We try to reserve 2 units, 3 times simultaneously.
  // Current: 5 reserved, 5 available.
  // 3 requests for 2 units = 6 units total. One should fail.
  const requests = [
    inventoryRepository.reserveWithCheck(inventory.id, 2),
    inventoryRepository.reserveWithCheck(inventory.id, 2),
    inventoryRepository.reserveWithCheck(inventory.id, 2)
  ];

  const results = await Promise.allSettled(requests);
  const successes = results.filter(r => r.status === 'fulfilled').length;
  const failures = results.filter(r => r.status === 'rejected').length;

  console.log(`Results: ${successes} successful, ${failures} failed.`);
  updated = await inventoryRepository.findById(inventory.id);
  console.log(`Final Reserved: ${updated?.reservedQuantity}/10`);

  // Cleanup
  console.log('\nCleaning up...');
  await prisma.inventory.delete({ where: { id: inventory.id } });
  await prisma.store.delete({ where: { id: store.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.category.delete({ where: { id: category.id } });

  console.log('--- INVENTORY TEST FINISHED ---');
}

testInventory()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
