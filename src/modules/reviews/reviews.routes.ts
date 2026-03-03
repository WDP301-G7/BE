// src/modules/reviews/reviews.routes.ts
import { Router } from 'express';
import { reviewsController } from './reviews.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { uploadReviewImages } from '../../middlewares/upload.middleware';
import { ROLES } from '../../constants/roles';
import {
    createReviewSchema,
    updateReviewSchema,
    reviewIdSchema,
    replyReviewSchema,
    getProductReviewsQuerySchema,
    getReviewsQuerySchema,
    productIdParamSchema,
} from '../../validations/zod/reviews.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Product review and rating endpoints
 */

// ─── Special named routes first (before parameterized routes) ─────────────────

/**
 * @swagger
 * /reviews/my-reviews:
 *   get:
 *     summary: Get all reviews written by the authenticated customer
 *     tags: [Reviews]
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
 *           default: 10
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/my-reviews',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    reviewsController.getMyReviews.bind(reviewsController)
);

/**
 * @swagger
 * /reviews/eligible:
 *   get:
 *     summary: Get OrderItems the customer can still review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Eligible order items retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/eligible',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    reviewsController.getEligibleOrderItems.bind(reviewsController)
);

/**
 * @swagger
 * /reviews/stats:
 *   get:
 *     summary: Get rating statistics for products
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of product IDs (optional)
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
    '/stats',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    reviewsController.getRatingStats.bind(reviewsController)
);

// ─── Root & create ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Get all reviews with filters (admin/manager dashboard)
 *     tags: [Reviews]
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
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PUBLISHED, HIDDEN]
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get(
    '/',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(getReviewsQuerySchema),
    reviewsController.getAllReviews.bind(reviewsController)
);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review for a purchased product
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - orderItemId
 *               - rating
 *             properties:
 *               orderItemId:
 *                 type: string
 *                 format: uuid
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Max 3 images
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Validation error or business rule violation
 *       409:
 *         description: Review already exists for this order item
 */
router.post(
    '/',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    uploadReviewImages,
    validate(createReviewSchema),
    reviewsController.createReview.bind(reviewsController)
);

// ─── Single review by ID ──────────────────────────────────────────────────────

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get single review by ID
 *     tags: [Reviews]
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
 *         description: Review retrieved successfully
 *       404:
 *         description: Review not found
 */
router.get(
    '/:id',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(reviewIdSchema),
    reviewsController.getReviewById.bind(reviewsController)
);

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     summary: Update own review (within 7 days of creation)
 *     tags: [Reviews]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       400:
 *         description: Edit window expired or review is hidden
 *       403:
 *         description: Not the owner of the review
 */
router.put(
    '/:id',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    uploadReviewImages,
    validate(updateReviewSchema),
    reviewsController.updateReview.bind(reviewsController)
);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Hard delete a review (Admin only)
 *     tags: [Reviews]
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
 *         description: Review deleted permanently
 *       404:
 *         description: Review not found
 */
router.delete(
    '/:id',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    validate(reviewIdSchema),
    reviewsController.deleteReview.bind(reviewsController)
);

// ─── Review reply ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /reviews/{id}/reply:
 *   post:
 *     summary: Add a shop reply to a review
 *     tags: [Reviews]
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
 *             required:
 *               - replyContent
 *             properties:
 *               replyContent:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Reply sent successfully
 *       409:
 *         description: Reply already exists, use PUT to update
 */
router.post(
    '/:id/reply',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(replyReviewSchema),
    reviewsController.replyToReview.bind(reviewsController)
);

/**
 * @swagger
 * /reviews/{id}/reply:
 *   put:
 *     summary: Update existing shop reply
 *     tags: [Reviews]
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
 *             required:
 *               - replyContent
 *             properties:
 *               replyContent:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Reply updated successfully
 */
router.put(
    '/:id/reply',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(replyReviewSchema),
    reviewsController.updateReply.bind(reviewsController)
);

// ─── Review moderation ────────────────────────────────────────────────────────

/**
 * @swagger
 * /reviews/{id}/hide:
 *   patch:
 *     summary: Hide a review that violates policy
 *     tags: [Reviews]
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
 *         description: Review hidden successfully
 *       400:
 *         description: Review already hidden
 */
router.patch(
    '/:id/hide',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(reviewIdSchema),
    reviewsController.hideReview.bind(reviewsController)
);

/**
 * @swagger
 * /reviews/{id}/show:
 *   patch:
 *     summary: Restore a hidden review back to published
 *     tags: [Reviews]
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
 *         description: Review restored successfully
 *       400:
 *         description: Review is not hidden
 */
router.patch(
    '/:id/show',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(reviewIdSchema),
    reviewsController.showReview.bind(reviewsController)
);

export default router;

// ─── Product-scoped review routes ─────────────────────────────────────────────
// Mounted at: /api/products/:productId/reviews (via app.ts)

export const productReviewsRouter = Router({ mergeParams: true });

/**
 * @swagger
 * /products/{productId}/reviews:
 *   get:
 *     summary: Get published reviews for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: hasImages
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, rating]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *       404:
 *         description: Product not found
 */
productReviewsRouter.get(
    '/',
    validate(getProductReviewsQuerySchema),
    reviewsController.getProductReviews.bind(reviewsController)
);

/**
 * @swagger
 * /products/{productId}/reviews/summary:
 *   get:
 *     summary: Get rating summary (average + star distribution) for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rating summary retrieved successfully
 *       404:
 *         description: Product not found
 */
productReviewsRouter.get(
    '/summary',
    validate(productIdParamSchema),
    reviewsController.getProductRatingSummary.bind(reviewsController)
);
