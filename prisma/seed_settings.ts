// prisma/seed_settings.ts
import { settingsService } from '../src/modules/settings/settings.service';
import { prisma } from '../src/config/database';

async function main() {
  console.log('🌱 Đang khởi tạo cấu hình hệ thống...');
  try {
    await settingsService.seedDefaults();
    console.log('✅ Khởi tạo cấu hình thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo cấu hình:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
