// src/modules/settings/settings.service.ts
import { SettingType, SystemSetting } from '@prisma/client';
import { settingsRepository } from './settings.repository';
import { NotFoundError } from '../../utils/errorHandler';

class SettingsService {
  /**
   * Get setting by key and cast to correct type
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    const setting = await settingsRepository.findByKey(key);
    if (!setting) {
      if (defaultValue !== undefined) return defaultValue;
      throw new NotFoundError(`Setting "${key}" not found`);
    }

    return this.castValue(setting.value, setting.type) as T;
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<SystemSetting[]> {
    return await settingsRepository.getAll();
  }

  /**
   * Set/Update setting
   */
  async set(key: string, value: any, type: SettingType = 'STRING', description?: string): Promise<SystemSetting> {
    const stringValue = type === 'JSON' ? JSON.stringify(value) : String(value);
    return await settingsRepository.upsert(key, { value: stringValue, type, description });
  }

  /**
   * Update setting (used by Admin API)
   */
  async update(key: string, value: any, description?: string): Promise<SystemSetting> {
    const setting = await settingsRepository.findByKey(key);
    if (!setting) {
      throw new NotFoundError(`Setting "${key}" not found`);
    }

    const stringValue = setting.type === 'JSON' ? JSON.stringify(value) : String(value);
    return await settingsRepository.upsert(key, { 
      value: stringValue, 
      type: setting.type, 
      description: description ?? setting.description ?? undefined 
    });
  }

  /**
   * Cast string value to specified type
   */
  private castValue(value: string, type: SettingType): any {
    switch (type) {
      case 'NUMBER':
        return Number(value);
      case 'BOOLEAN':
        return value === 'true' || value === '1';
      case 'JSON':
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      case 'STRING':
      default:
        return value;
    }
  }

  /**
   * Seed default settings
   */
  async seedDefaults(): Promise<void> {
    const defaults = [
      { key: 'review.deadline_days', value: '30', type: 'NUMBER' as SettingType, description: 'Số ngày tối đa khách được đánh giá sau khi nhận hàng' },
      { key: 'review.editable_days', value: '7', type: 'NUMBER' as SettingType, description: 'Số ngày khách được sửa đánh giá sau khi tạo' },
      { key: 'review.max_images', value: '3', type: 'NUMBER' as SettingType, description: 'Số ảnh tối đa cho mỗi đánh giá' },
      { key: 'product.image_count', value: '5', type: 'NUMBER' as SettingType, description: 'Số ảnh bắt buộc khi tạo sản phẩm' },
      { key: 'product.max_image_size_mb', value: '5', type: 'NUMBER' as SettingType, description: 'Dung lượng ảnh tối đa (MB)' },
      { key: 'membership.default_warranty_months', value: '6', type: 'NUMBER' as SettingType, description: 'Bảo hành mặc định (tháng) cho khách chưa có hạng' },
      { key: 'membership.default_return_days', value: '7', type: 'NUMBER' as SettingType, description: 'Số ngày đổi trả mặc định cho khách chưa có hạng' },
      { key: 'membership.default_exchange_days', value: '15', type: 'NUMBER' as SettingType, description: 'Số ngày đổi hàng mặc định cho khách chưa có hạng' },
      { key: 'membership.default_period_days', value: '365', type: 'NUMBER' as SettingType, description: 'Chu kỳ membership mặc định (ngày)' },
      { key: 'membership.cache_ttl_ms', value: '600000', type: 'NUMBER' as SettingType, description: 'Thời gian cache danh sách hạng (ms)' },
      { key: 'membership.default_discount_percent', value: '0', type: 'NUMBER' as SettingType, description: '% giảm giá mặc định cho khách chưa có hạng' },
    ];

    for (const item of defaults) {
      await this.set(item.key, item.value, item.type, item.description);
    }
  }
}

export const settingsService = new SettingsService();
