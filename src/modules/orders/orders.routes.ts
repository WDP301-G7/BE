// src/modules/orders/orders.routes.ts
import { Router } from 'express';
import { ordersController } from './orders.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../constants/roles';
import {
    createOrderSchema,
    confirmOrderSchema,
    updateAppointmentSchema,
    getOrdersQuerySchema,
    orderIdSchema,
    updateOrderStatusSchema,
    cancelOrderSchema,
    verifyOrderSchema,
    completeOrderWithNotesSchema,
} from '../../validations/zod/orders.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management endpoints
 */

// Special routes first (before parameterized routes)

/**
 * @swagger
 * /orders/my:
 *   get:
 *     summary: Get customer's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get(
    '/my',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    ordersController.getMyOrders.bind(ordersController)
);

/**
 * @swagger
 * /orders/assigned:
 *   get:
 *     summary: Get orders assigned to staff
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING_PAYMENT, WAITING_CUSTOMER, PROCESSING, READY, COMPLETED, CANCELLED]
 *         description: Filter by order status. If omitted, returns WAITING_CUSTOMER, PROCESSING, READY.
 *     responses:
 *       200:
 *         description: Assigned orders retrieved successfully
 */
router.get(
    '/assigned',
    authMiddleware,
    roleMiddleware([ROLES.STAFF]),
    ordersController.getAssignedOrders.bind(ordersController)
);

/**
 * @swagger
 * /orders/stats:
 *   get:
 *     summary: Get order statistics
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
    '/stats',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN, ROLES.OPERATION]),
    ordersController.getStats.bind(ordersController)
);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders with filters
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get(
    '/',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.MANAGER, ROLES.ADMIN]),
    validate(getOrdersQuerySchema),
    ordersController.getAllOrders.bind(ordersController)
);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error or insufficient stock
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    validate(createOrderSchema),
    ordersController.createOrder.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/confirm-receipt:
 *   post:
 *     summary: Customer confirms they received the order
 *     tags: [Orders]
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
 *         description: Receipt confirmed successfully
 *       400:
 *         description: Invalid order status
 *       403:
 *         description: Not order owner
 *       404:
 *         description: Order not found
 */
router.post(
    '/:id/confirm-receipt',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    validate(orderIdSchema),
    ordersController.confirmReceipt.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
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
 *         description: Order retrieved successfully
 */
router.get(
    '/:id',
    authMiddleware,
    validate(orderIdSchema),
    ordersController.getOrderById.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/confirm:
 *   post:
 *     summary: Confirm order and set appointment
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentDate
 *             properties:
 *               appointmentDate:
 *                 type: string
 *                 format: date-time
 *               appointmentNote:
 *                 type: string
 *               assignedStaffId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Order confirmed and appointment set successfully
 *       400:
 *         description: Invalid order status or insufficient stock
 *       404:
 *         description: Order not found
 */
router.post(
    '/:id/confirm',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.MANAGER, ROLES.ADMIN]),
    validate(confirmOrderSchema),
    ordersController.confirmOrder.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/appointment:
 *   put:
 *     summary: Update appointment
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentDate
 *             properties:
 *               appointmentDate:
 *                 type: string
 *                 format: date-time
 *               appointmentNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 *       400:
 *         description: Invalid order status
 *       404:
 *         description: Order not found
 */
router.put(
    '/:id/appointment',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.MANAGER, ROLES.ADMIN]),
    validate(updateAppointmentSchema),
    ordersController.updateAppointment.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Cannot cancel order in current status
 *       403:
 *         description: Forbidden - not order owner
 *       404:
 *         description: Order not found
 */
router.post(
    '/:id/cancel',
    authMiddleware,
    validate(cancelOrderSchema),
    ordersController.cancelOrder.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/start-processing:
 *   post:
 *     summary: Start processing order
 *     tags: [Orders]
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
 *         description: Processing started
 *       400:
 *         description: Invalid order status
 *       404:
 *         description: Order not found
 */
router.post(
    '/:id/start-processing',
    authMiddleware,
    roleMiddleware([ROLES.STAFF]),
    validate(orderIdSchema),
    ordersController.startProcessing.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/mark-ready:
 *   post:
 *     summary: Mark order as ready
 *     tags: [Orders]
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
 *         description: Order marked as ready
 *       400:
 *         description: Invalid order status
 *       404:
 *         description: Order not found
 */
router.post(
    '/:id/mark-ready',
    authMiddleware,
    roleMiddleware([ROLES.STAFF]),
    validate(orderIdSchema),
    ordersController.markAsReady.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/complete:
 *   post:
 *     summary: Complete order (legacy endpoint)
 *     tags: [Orders]
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
 *         description: Order completed successfully
 *       400:
 *         description: Invalid order status
 *       404:
 *         description: Order not found
 */
router.post(
    '/:id/complete',
    authMiddleware,
    roleMiddleware([ROLES.STAFF]),
    validate(orderIdSchema),
    ordersController.completeOrder.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/verify:
 *   get:
 *     summary: Verify order for pickup
 *     description: Staff verifies customer identity and order details at pickup
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer phone number for verification
 *     responses:
 *       200:
 *         description: Order verification completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 customer:
 *                   type: object
 *                 isPaid:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       404:
 *         description: Order not found
 */
router.get(
    '/:id/verify',
    authMiddleware,
    roleMiddleware([ROLES.STAFF, ROLES.OPERATION, ROLES.ADMIN]),
    validate(verifyOrderSchema),
    ordersController.verifyOrder.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/complete:
 *   patch:
 *     summary: Complete order with notes
 *     description: Enhanced completion endpoint with staff notes
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completionNote:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional completion notes
 *     responses:
 *       200:
 *         description: Order completed successfully
 *       400:
 *         description: Invalid order status
 *       404:
 *         description: Order not found
 */
router.patch(
    '/:id/complete',
    authMiddleware,
    roleMiddleware([ROLES.STAFF, ROLES.OPERATION, ROLES.ADMIN]),
    validate(completeOrderWithNotesSchema),
    ordersController.completeOrderWithNotes.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/prescription:
 *   get:
 *     summary: Get order prescription details
 *     description: View prescription with eye measurements and images
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Prescription retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId:
 *                   type: string
 *                 customer:
 *                   type: object
 *                 prescription:
 *                   type: object
 *                   properties:
 *                     rightEye:
 *                       type: object
 *                     leftEye:
 *                       type: object
 *                     pupillaryDistance:
 *                       type: number
 *                 prescriptionRequestImages:
 *                   type: array
 *       403:
 *         description: Forbidden - not order owner
 *       404:
 *         description: Order or prescription not found
 */
router.get(
    '/:id/prescription',
    authMiddleware,
    validate(orderIdSchema),
    ordersController.getOrderPrescription.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/status:
 *   put:
 *     summary: Force update order status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [NEW, PENDING_PAYMENT, CONFIRMED, WAITING_CUSTOMER, WAITING_PRODUCT, PROCESSING, READY, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Order not found
 */
router.put(
    '/:id/status',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    validate(updateOrderStatusSchema),
    ordersController.forceUpdateStatus.bind(ordersController)
);

// ============================================
// PRESCRIPTION FLOW - NEW ENDPOINTS
// ============================================

/**
 * @swagger
 * /orders/{id}/verify:
 *   get:
 *     summary: Verify order for pickup (Prescription Flow)
 *     description: Staff verifies customer identity and order details at pickup
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer phone number for verification
 *     responses:
 *       200:
 *         description: Order verification completed
 *       404:
 *         description: Order not found
 */
router.get(
    '/:id/verify',
    authMiddleware,
    roleMiddleware([ROLES.STAFF, ROLES.OPERATION, ROLES.ADMIN]),
    validate(verifyOrderSchema),
    ordersController.verifyOrder.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/complete-with-notes:
 *   patch:
 *     summary: Complete order with notes (Prescription Flow)
 *     description: Enhanced completion endpoint with staff notes for prescription orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completionNote:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional completion notes
 *     responses:
 *       200:
 *         description: Order completed successfully
 *       400:
 *         description: Invalid order status
 *       404:
 *         description: Order not found
 */
router.patch(
    '/:id/complete-with-notes',
    authMiddleware,
    roleMiddleware([ROLES.STAFF, ROLES.OPERATION, ROLES.ADMIN]),
    validate(completeOrderWithNotesSchema),
    ordersController.completeOrderWithNotes.bind(ordersController)
);

/**
 * @swagger
 * /orders/{id}/prescription:
 *   get:
 *     summary: Get order prescription details (Prescription Flow)
 *     description: View prescription with eye measurements and images
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Prescription retrieved successfully
 *       403:
 *         description: Forbidden - not order owner
 *       404:
 *         description: Order or prescription not found
 */
router.get(
    '/:id/prescription',
    authMiddleware,
    validate(orderIdSchema),
    ordersController.getOrderPrescription.bind(ordersController)
);

/**
 * @swagger
 * /orders/expire-unpaid:
 *   post:
 *     summary: Manually expire unpaid orders (Admin/Operation)
 *     description: Find and expire all unpaid orders past their expiry date
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders expired successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 expiredCount:
 *                   type: integer
 */
router.post(
    '/expire-unpaid',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN, ROLES.OPERATION]),
    ordersController.expireUnpaidOrders.bind(ordersController)
);

export default router;
