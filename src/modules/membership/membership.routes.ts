// src/modules/membership/membership.routes.ts
import { Router } from 'express';
import { membershipController } from './membership.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../constants/roles';
import {
    createTierSchema,
    updateTierSchema,
    tierIdParamSchema,
    getMembershipHistoryQuerySchema,
} from '../../validations/zod/membership.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Membership
 *   description: Membership tier management and customer loyalty status
 */

// ─── Public: List all tiers ──────────────────────────────────────────────────

/**
 * @swagger
 * /membership/tiers:
 *   get:
 *     summary: Get all membership tiers
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: List of membership tiers
 */
router.get('/tiers', membershipController.getAllTiers.bind(membershipController));

/**
 * @swagger
 * /membership/tiers/{id}:
 *   get:
 *     summary: Get a single membership tier
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Membership tier details
 *       404:
 *         description: Tier not found
 */
router.get(
    '/tiers/:id',
    validate(tierIdParamSchema),
    membershipController.getTierById.bind(membershipController)
);

// ─── Admin: Tier management ──────────────────────────────────────────────────

/**
 * @swagger
 * /membership/tiers:
 *   post:
 *     summary: Create a new membership tier
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, minSpend]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Gold
 *               minSpend:
 *                 type: number
 *                 example: 10000000
 *               discountPercent:
 *                 type: number
 *                 example: 10
 *               warrantyMonths:
 *                 type: integer
 *                 example: 12
 *               returnDays:
 *                 type: integer
 *                 example: 7
 *               exchangeDays:
 *                 type: integer
 *                 example: 30
 *               periodDays:
 *                 type: integer
 *                 example: 365
 *               sortOrder:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: Tier created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
    '/tiers',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    validate(createTierSchema),
    membershipController.createTier.bind(membershipController)
);

/**
 * @swagger
 * /membership/tiers/{id}:
 *   put:
 *     summary: Update a membership tier
 *     tags: [Membership]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               minSpend:
 *                 type: number
 *               discountPercent:
 *                 type: number
 *               warrantyMonths:
 *                 type: integer
 *               returnDays:
 *                 type: integer
 *               exchangeDays:
 *                 type: integer
 *               periodDays:
 *                 type: integer
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Tier updated
 *       404:
 *         description: Tier not found
 */
router.put(
    '/tiers/:id',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    validate(updateTierSchema),
    membershipController.updateTier.bind(membershipController)
);

/**
 * @swagger
 * /membership/tiers/{id}:
 *   delete:
 *     summary: Delete a membership tier (only if no users assigned)
 *     tags: [Membership]
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
 *         description: Tier deleted
 *       400:
 *         description: Cannot delete tier with assigned users
 *       404:
 *         description: Tier not found
 */
router.delete(
    '/tiers/:id',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    validate(tierIdParamSchema),
    membershipController.deleteTier.bind(membershipController)
);

// ─── Customer: Membership status ─────────────────────────────────────────────

/**
 * @swagger
 * /membership/me:
 *   get:
 *     summary: Get current user's membership status and tier progress
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership status with nextTier and amountToNextTier
 *         content:
 *           application/json:
 *             example:
 *               tier: Silver
 *               discountPercent: 5
 *               warrantyMonths: 9
 *               returnDays: 10
 *               exchangeDays: 22
 *               totalSpent: 8500000
 *               spendInPeriod: 3500000
 *               periodStartDate: "2026-01-01T00:00:00.000Z"
 *               periodEndDate: "2026-12-31T23:59:59.000Z"
 *               nextTier: Gold
 *               amountToNextTier: 6500000
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/me',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    membershipController.getMyMembership.bind(membershipController)
);

/**
 * @swagger
 * /membership/me/history:
 *   get:
 *     summary: Get current user's tier change history
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Tier change history
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/me/history',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    membershipController.getMyHistory.bind(membershipController)
);

// ─── Admin/Operation: Full audit history ─────────────────────────────────────

/**
 * @swagger
 * /membership/history:
 *   get:
 *     summary: Get all tier change history (admin audit log)
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *           enum: [ORDER_COMPLETED, PERIOD_RESET, ADMIN_MANUAL]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Paginated tier change history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
    '/history',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN, ROLES.OPERATION, ROLES.MANAGER]),
    validate(getMembershipHistoryQuerySchema),
    membershipController.getHistory.bind(membershipController)
);

export default router;
