// prisma/seed.ts
import { PrismaClient, UserRole, UserStatus, ProductType, Inventory } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // ============================================
  // 1. CATEGORIES
  // ============================================
  console.log('📦 Creating categories...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Gọng kính',
        description: 'Các loại gọng kính thời trang và y tế',
      },
    }),
    prisma.category.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Tròng kính',
        description: 'Các loại tròng kính cận, viễn, loạn thị',
      },
    }),
    prisma.category.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Dịch vụ',
        description: 'Các dịch vụ khám mắt, đo độ, bảo hành',
      },
    }),
    prisma.category.upsert({
      where: { id: '00000000-0000-0000-0000-000000000004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Phụ kiện',
        description: 'Hộp đựng kính, khăn lau, dây đeo',
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // ============================================
  // 2. STORES
  // ============================================
  console.log('🏪 Creating stores...');

  const stores = await Promise.all([
    prisma.store.upsert({
      where: { id: '00000000-0000-0000-0000-000000000011' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000011',
        name: 'Chi nhánh Quận 1',
        address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
      },
    }),
    prisma.store.upsert({
      where: { id: '00000000-0000-0000-0000-000000000012' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000012',
        name: 'Chi nhánh Quận 7',
        address: '456 Nguyễn Văn Linh, Phường Tân Phú, Quận 7, TP.HCM',
      },
    }),
    prisma.store.upsert({
      where: { id: '00000000-0000-0000-0000-000000000013' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000013',
        name: 'Chi nhánh Thủ Đức',
        address: '789 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM',
      },
    }),
  ]);

  console.log(`✅ Created ${stores.length} stores`);

  // ============================================
  // 3. USERS
  // ============================================
  console.log('👤 Creating users...');

  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const users = await Promise.all([
    // Admin
    prisma.user.upsert({
      where: { email: 'admin@wdp.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000101',
        email: 'admin@wdp.com',
        password: hashedPassword,
        fullName: 'Administrator',
        phone: '0901111111',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        address: 'TP. Hồ Chí Minh',
      },
    }),
    // Manager
    prisma.user.upsert({
      where: { email: 'manager@wdp.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000102',
        email: 'manager@wdp.com',
        password: hashedPassword,
        fullName: 'Nguyễn Văn Manager',
        phone: '0902222222',
        role: UserRole.MANAGER,
        status: UserStatus.ACTIVE,
        storeId: stores[0].id,
        address: 'Quận 1, TP. Hồ Chí Minh',
      },
    }),
    // Operation (cần cho prescription flow)
    prisma.user.upsert({
      where: { email: 'operation@wdp.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000103',
        email: 'operation@wdp.com',
        password: hashedPassword,
        fullName: 'Trần Thị Operation',
        phone: '0903333333',
        role: UserRole.OPERATION,
        status: UserStatus.ACTIVE,
        storeId: stores[0].id,
        address: 'Quận 1, TP. Hồ Chí Minh',
      },
    }),
    // Staff 1
    prisma.user.upsert({
      where: { email: 'staff1@wdp.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000104',
        email: 'staff1@wdp.com',
        password: hashedPassword,
        fullName: 'Lê Văn Staff',
        phone: '0904444444',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        storeId: stores[0].id,
        address: 'Quận 1, TP. Hồ Chí Minh',
      },
    }),
    // Staff 2
    prisma.user.upsert({
      where: { email: 'staff2@wdp.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000105',
        email: 'staff2@wdp.com',
        password: hashedPassword,
        fullName: 'Phạm Thị Staff 2',
        phone: '0905555555',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        storeId: stores[1].id,
        address: 'Quận 7, TP. Hồ Chí Minh',
      },
    }),
    // Customer 1 (dùng để test prescription flow - phone: 0906666666)
    prisma.user.upsert({
      where: { email: 'customer@example.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000106',
        email: 'customer@example.com',
        password: hashedPassword,
        fullName: 'Nguyễn Văn Khách',
        phone: '0906666666',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        address: 'Quận 3, TP. Hồ Chí Minh',
      },
    }),
    // Customer 2
    prisma.user.upsert({
      where: { email: 'customer2@example.com' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000107',
        email: 'customer2@example.com',
        password: hashedPassword,
        fullName: 'Trần Thị Khách Hai',
        phone: '0907777777',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        address: 'Quận 5, TP. Hồ Chí Minh',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // ============================================
  // 4. PRODUCTS
  // ============================================
  console.log('📦 Creating products...');

  const products = await Promise.all([
    // Gọng kính 1
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000021' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000021',
        categoryId: categories[0].id,
        name: 'Gọng kính Rayban Classic',
        description: 'Gọng kính Rayban phong cách cổ điển, chất liệu nhựa cao cấp',
        type: ProductType.FRAME,
        price: 1500000,
        sku: 'FRAME-RB-001',
        brand: 'Rayban',
        isPreorder: false,
      },
    }),
    // Gọng kính 2
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000022' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000022',
        categoryId: categories[0].id,
        name: 'Gọng kính Gucci Luxury',
        description: 'Gọng kính Gucci cao cấp, thiết kế sang trọng',
        type: ProductType.FRAME,
        price: 3500000,
        sku: 'FRAME-GU-002',
        brand: 'Gucci',
        isPreorder: false,
      },
    }),
    // Tròng kính 1
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000023' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000023',
        categoryId: categories[1].id,
        name: 'Tròng kính cận Essilor',
        description: 'Tròng kính cận Essilor chống ánh sáng xanh',
        type: ProductType.LENS,
        price: 800000,
        sku: 'LENS-ES-001',
        brand: 'Essilor',
        isPreorder: false,
      },
    }),
    // Tròng kính 2
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000024' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000024',
        categoryId: categories[1].id,
        name: 'Tròng kính đổi màu Transitions',
        description: 'Tròng kính tự động đổi màu theo ánh sáng',
        type: ProductType.LENS,
        price: 1200000,
        sku: 'LENS-TR-002',
        brand: 'Transitions',
        isPreorder: true,
        leadTimeDays: 7,
      },
    }),
    // Dịch vụ
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000025' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000025',
        categoryId: categories[2].id,
        name: 'Dịch vụ khám mắt',
        description: 'Khám và đo độ mắt chuyên nghiệp',
        type: ProductType.SERVICE,
        price: 50000,
        sku: 'SVC-EYE-001',
        brand: null,
        isPreorder: false,
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // ============================================
  // 5. INVENTORY
  // ============================================
  console.log('📊 Creating inventory...');

  const inventoryItems: Inventory[] = [];

  for (const product of products.slice(0, 4)) {
    for (const store of stores) {
      const inventory = await prisma.inventory.upsert({
        where: {
          id: `inv-${product.id.slice(-4)}-${store.id.slice(-4)}`,
        },
        update: {},
        create: {
          id: `inv-${product.id.slice(-4)}-${store.id.slice(-4)}`,
          productId: product.id,
          storeId: store.id,
          quantity: 50,
          reservedQuantity: 0,
        },
      });
      inventoryItems.push(inventory as Inventory);
    }
  }

  console.log(`✅ Created ${inventoryItems.length} inventory items`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Categories: ${categories.length}`);
  console.log(`   - Stores: ${stores.length}`);
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Products: ${products.length}`);
  console.log(`   - Inventory: ${inventoryItems.length}`);

  console.log('\n🔑 Login Credentials (password: Admin@123):');
  console.log('   ADMIN       → admin@wdp.com        | phone: 0901111111');
  console.log('   MANAGER     → manager@wdp.com      | phone: 0902222222');
  console.log('   OPERATION   → operation@wdp.com    | phone: 0903333333');
  console.log('   STAFF       → staff1@wdp.com       | phone: 0904444444');
  console.log('   STAFF       → staff2@wdp.com       | phone: 0905555555');
  console.log('   CUSTOMER    → customer@example.com | phone: 0906666666');
  console.log('   CUSTOMER    → customer2@example.com| phone: 0907777777');

  console.log('\n📌 Postman Environment Variables (copy-paste):');
  console.log('   base_url          → http://localhost:3000/api');
  console.log('   store_id          → 00000000-0000-0000-0000-000000000011');
  console.log('   frame_product_id  → 00000000-0000-0000-0000-000000000021');
  console.log('   lens_product_id   → 00000000-0000-0000-0000-000000000023');
  console.log('\n   ⚠️  Khi test verify order, dùng phone: 0906666666');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
