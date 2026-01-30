// src/modules/payments/payments.routes.ts
import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createPaymentSchema, vnpayIPNSchema } from '../../validations/zod/payments.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management APIs
 */

/**
 * @swagger
 * /payments/{orderId}/create:
 *   post:
 *     summary: Create payment and get payment URL
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID to create payment for
 *     responses:
 *       200:
 *         description: Payment URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentUrl:
 *                   type: string
 *                 paymentId:
 *                   type: string
 *                 orderId:
 *                   type: string
 *                 amount:
 *                   type: number
 *       400:
 *         description: Invalid order status or payment already exists
 *       404:
 *         description: Order not found
 */
router.post(
    '/:orderId/create',
    authMiddleware,
    validate(createPaymentSchema),
    paymentsController.createPayment.bind(paymentsController)
);

/**
 * @swagger
 * /payments/vnpay/ipn:
 *   get:
 *     summary: VNPay IPN webhook (called by VNPay server)
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: vnp_TmnCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IPN processed
 */
router.get(
    '/vnpay/ipn',
    validate(vnpayIPNSchema),
    paymentsController.handleVNPayIPN.bind(paymentsController)
);

/**
 * @swagger
 * /payments/vnpay/return:
 *   get:
 *     summary: VNPay Return URL (Customer redirected here)
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Display payment result
 */
router.get(
    '/vnpay/return',
    paymentsController.handleVNPayReturn.bind(paymentsController)
);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get payment details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 *       404:
 *         description: Payment not found
 */
router.get('/:id', authMiddleware, paymentsController.getPayment.bind(paymentsController));

/**
 * @swagger
 * /payments/order/{orderId}:
 *   get:
 *     summary: Get payment by order ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 *       404:
 *         description: Payment not found
 */
router.get(
    '/order/:orderId',
    authMiddleware,
    paymentsController.getPaymentByOrderId.bind(paymentsController)
);

export default router;
