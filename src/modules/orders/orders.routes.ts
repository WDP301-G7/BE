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
    roleMiddleware([ROLES.ADMIN, ROLES.MANAGER]),
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
 *     summary: Complete order
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
 *                 enum: [NEW, CONFIRMED, WAITING_CUSTOMER, WAITING_PRODUCT, PROCESSING, READY, COMPLETED, CANCELLED]
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

export default router;
