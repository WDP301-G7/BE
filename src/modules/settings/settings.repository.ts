// src/modules/settings/settings.repository.ts
import { SystemSetting, SettingType } from '@prisma/client';
import { prisma } from '../../config/database';

class SettingsRepository {
  /**
   * Get all settings
   */
  async getAll(): Promise<SystemSetting[]> {
    return await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Find setting by key
   */
  async findByKey(key: string): Promise<SystemSetting | null> {
    return await prisma.systemSetting.findUnique({
      where: { key },
    });
  }

  /**
   * Upsert setting (create or update)
   */
  async upsert(key: string, data: { value: string; type?: SettingType; description?: string }): Promise<SystemSetting> {
    return await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: data.value,
        type: data.type,
        description: data.description,
      },
      create: {
        key,
        value: data.value,
        type: data.type || 'STRING',
        description: data.description,
      },
    });
  }

  /**
   * Delete setting
   */
  async delete(key: string): Promise<SystemSetting> {
    return await prisma.systemSetting.delete({
      where: { key },
    });
  }
}

export const settingsRepository = new SettingsRepository();
