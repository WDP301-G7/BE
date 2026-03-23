// src/modules/settings/settings.controller.ts
import { Request, Response, NextFunction } from 'express';
import { settingsService } from './settings.service';
import { apiResponse } from '../../utils/apiResponse';
import { BadRequestError } from '../../utils/errorHandler';

class SettingsController {
  /**
   * Get all system settings
   */
  async getAllSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getAll();
      res.status(200).json(apiResponse.success(settings));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a specific setting
   */
  async updateSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;

      if (value === undefined) {
        throw new BadRequestError('Value is required for update');
      }

      const updatedSetting = await settingsService.update(key as string, value, description as string);
      res.status(200).json(apiResponse.success(updatedSetting, 'Setting updated successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
