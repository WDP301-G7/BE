import { Router } from 'express';
import { logisticsController } from './logistics.controller';

const router = Router();

/**
 * @openapi
 * /api/logistics/ghn-webhook:
 *   post:
 *     summary: Nhận Webhook từ Giao Hàng Nhanh (GHN)
 *     description: Endpoint để GHN gọi tới khi có cập nhật trạng thái đơn hàng (đang giao, đã giao, trả hàng, v.v.).
 *     tags:
 *       - Logistics
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post('/ghn-webhook', logisticsController.ghnWebhook.bind(logisticsController));

export const logisticsRoutes = router;
