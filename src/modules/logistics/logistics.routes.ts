import { Router } from 'express';
import { logisticsController } from './logistics.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

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

/**
 * @openapi
 * /api/logistics/simulate/{orderId}:
 *   post:
 *     summary: "[DEMO] Giả lập trạng thái giao hàng"
 *     description: |
 *       Dùng trong demo/dev để tiến từng bước shipping mà không cần shipper thật.
 *       Gọi lần lượt 3 lần để hoàn tất: picking → delivering → delivered (order COMPLETED).
 *       Nếu không truyền `step`, backend tự chọn bước tiếp theo.
 *     tags:
 *       - Logistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               step:
 *                 type: string
 *                 enum: [picking, delivering, delivered]
 *                 description: "Bước cần giả lập. Nếu bỏ trống, backend tự chọn bước kế tiếp."
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Order không ở trạng thái READY hoặc không phải HOME_DELIVERY
 *       404:
 *         description: Order không tồn tại
 */
router.post(
    '/simulate/:orderId',
    authMiddleware,
    roleMiddleware(['STAFF', 'OPERATION', 'ADMIN']),
    logisticsController.simulateDelivery.bind(logisticsController)
);

export const logisticsRoutes = router;
