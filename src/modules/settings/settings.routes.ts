// src/modules/settings/settings.routes.ts
import { Router } from 'express';
import { settingsController } from './settings.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionMiddleware } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: Get all system settings (Admin only)
 *     tags: [Settings]
 */
router.get(
  '/',
  authMiddleware,
  permissionMiddleware('settings:read'),
  settingsController.getAllSettings
);

/**
 * @swagger
 * /api/v1/settings/{key}:
 *   patch:
 *     summary: Update a system setting (Admin only)
 *     tags: [Settings]
 */
router.patch(
  '/:key',
  authMiddleware,
  permissionMiddleware('settings:write'),
  settingsController.updateSetting
);

export default router;
