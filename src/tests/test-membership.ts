// src/tests/test-membership.ts
import { membershipService } from '../modules/membership/membership.service';
import { prisma } from '../config/database';

async function testMembership() {
  console.log('--- STARTING MEMBERSHIP TEST ---');

  // 1. Setup tiers and user
  const tiers = await prisma.membershipTier.findMany({ orderBy: { minSpend: 'asc' } });
  if (tiers.length < 2) {
    console.log('Creating default tiers for testing...');
    await prisma.membershipTier.createMany({
      data: [
        { name: 'Bronze', minSpend: 0, sortOrder: 1 },
        { name: 'Silver', minSpend: 1000000, sortOrder: 2 },
        { name: 'Gold', minSpend: 5000000, sortOrder: 3 },
      ]
    });
  }

  const user = await prisma.user.create({
    data: {
      fullName: 'Test Member',
      email: `test_${Date.now()}@example.com`,
      password: 'password',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      totalSpent: 0,
      spendInPeriod: 0,
    }
  });

  console.log(`Created test user: ${user.email}`);

  // 2. Test Case 1: Simple spend and update
  console.log('\nCase 1: Recording spend of 1,500,000 (should upgrade to Silver)');
  await membershipService.recordSpend(user.id, 1500000);
  let status = await membershipService.getMembershipStatus(user.id);
  console.log(`Current Tier: ${status.tier}, Total Spent: ${status.totalSpent}`);

  // 3. Test Case 2: Concurrent spend updates
  console.log('\nCase 2: Concurrent spend recording (simulating race condition)');
  // We'll record 10 small spends of 100,000 simultaneously
  const requests = Array(10).fill(null).map(() => membershipService.recordSpend(user.id, 100000));
  await Promise.all(requests);
  
  status = await membershipService.getMembershipStatus(user.id);
  console.log(`Final Total Spent: ${status.totalSpent} (Expected: 1,500,000 + 1,000,000 = 2,500,000)`);

  // 4. Test Case 3: Caching validation
  console.log('\nCase 3: Membership Tier Caching (Internal)');
  const startTime = Date.now();
  await membershipService.recordSpend(user.id, 1000);
  const firstDuration = Date.now() - startTime;
  
  const startTime2 = Date.now();
  await membershipService.recordSpend(user.id, 1000);
  const secondDuration = Date.now() - startTime2;
  
  console.log(`Duration 1 (possible cache miss): ${firstDuration}ms`);
  console.log(`Duration 2 (should be cache hit): ${secondDuration}ms`);

  // Cleanup
  console.log('\nCleaning up...');
  await prisma.membershipHistory.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('--- MEMBERSHIP TEST FINISHED ---');
}

testMembership()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
