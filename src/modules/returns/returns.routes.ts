// src/modules/returns/returns.routes.ts
import { Router } from 'express';
import { returnsController } from './returns.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { upload } from '../../middlewares/upload.middleware';
import { ROLES } from '../../constants/roles';
import {
    getReturnsQuerySchema,
    returnIdSchema,
    approveReturnSchema,
    rejectReturnSchema,
    completeReturnSchema,
    uploadImagesSchema,
    deleteImageSchema,
    updateReturnStatusSchema,
} from '../../validations/zod/returns.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Returns
 *   description: Return & Exchange management endpoints
 */

// ============================================
// CUSTOMER ROUTES
// ============================================

/**
 * @swagger
 * /returns/my:
 *   get:
 *     summary: Get customer's return requests
 *     tags: [Returns]
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
 *         description: Return requests retrieved successfully
 */
router.get(
    '/my',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    returnsController.getMyReturns.bind(returnsController)
);

/**
 * @swagger
 * /returns:
 *   post:
 *     summary: Create return request with images
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - type
 *               - reason
 *               - items
 *               - images
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [RETURN, EXCHANGE, WARRANTY]
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               items:
 *                 type: string
 *                 description: JSON string of items array
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 minItems: 1
 *                 maxItems: 5
 *     responses:
 *       201:
 *         description: Return request created successfully
 *       400:
 *         description: Validation error or business rule violation
 */
router.post(
    '/',
    authMiddleware,
    roleMiddleware([ROLES.CUSTOMER]),
    upload.array('images', 5),
    returnsController.createReturn.bind(returnsController)
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @swagger
 * /returns/stats:
 *   get:
 *     summary: Get return statistics
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
    '/stats',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    returnsController.getStats.bind(returnsController)
);

// ============================================
// STAFF/OPERATION/ADMIN ROUTES
// ============================================

/**
 * @swagger
 * /returns:
 *   get:
 *     summary: Get all return requests with filters
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, COMPLETED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [RETURN, EXCHANGE, WARRANTY]
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Return requests retrieved successfully
 */
router.get(
    '/',
    authMiddleware,
    roleMiddleware([ROLES.STAFF, ROLES.OPERATION, ROLES.ADMIN]),
    validate(getReturnsQuerySchema),
    returnsController.getAllReturns.bind(returnsController)
);

// ============================================
// DETAIL ROUTES
// ============================================

/**
 * @swagger
 * /returns/{id}:
 *   get:
 *     summary: Get return request by ID
 *     tags: [Returns]
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
 *         description: Return request retrieved successfully
 *       403:
 *         description: Forbidden - not request owner
 *       404:
 *         description: Return request not found
 */
router.get(
    '/:id',
    authMiddleware,
    validate(returnIdSchema),
    returnsController.getReturnById.bind(returnsController)
);

// ============================================
// OPERATION ACTIONS (Back Office)
// ============================================

/**
 * @swagger
 * /returns/{id}/approve:
 *   put:
 *     summary: Approve return request
 *     tags: [Returns]
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
 *               note:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Return request approved successfully
 *       400:
 *         description: Invalid status for approval
 *       404:
 *         description: Return request not found
 */
router.put(
    '/:id/approve',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(approveReturnSchema),
    returnsController.approveReturn.bind(returnsController)
);

/**
 * @swagger
 * /returns/{id}/reject:
 *   put:
 *     summary: Reject return request
 *     tags: [Returns]
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
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Return request rejected successfully
 *       400:
 *         description: Invalid status for rejection
 *       404:
 *         description: Return request not found
 */
router.put(
    '/:id/reject',
    authMiddleware,
    roleMiddleware([ROLES.OPERATION, ROLES.ADMIN]),
    validate(rejectReturnSchema),
    returnsController.rejectReturn.bind(returnsController)
);

// ============================================
// STAFF ACTIONS (Front Line)
// ============================================

/**
 * @swagger
 * /returns/{id}/complete:
 *   put:
 *     summary: Complete return request
 *     tags: [Returns]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               refundAmount:
 *                 type: number
 *                 minimum: 0
 *               refundMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER]
 *               completionNote:
 *                 type: string
 *                 maxLength: 500
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 10
 *     responses:
 *       200:
 *         description: Return request completed successfully
 *       400:
 *         description: Invalid status for completion
 *       404:
 *         description: Return request not found
 */
router.put(
    '/:id/complete',
    authMiddleware,
    roleMiddleware([ROLES.STAFF, ROLES.OPERATION, ROLES.ADMIN]),
    upload.array('images', 10),
    validate(completeReturnSchema),
    returnsController.completeReturn.bind(returnsController)
);

// ============================================
// IMAGE MANAGEMENT
// ============================================

/**
 * @swagger
 * /returns/{id}/images:
 *   post:
 *     summary: Upload images to return request
 *     tags: [Returns]
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
 *             required:
 *               - imageType
 *               - images
 *             properties:
 *               imageType:
 *                 type: string
 *                 enum: [CUSTOMER_PRODUCT, CUSTOMER_DEFECT, STAFF_RECEIVED, STAFF_INSPECTION, OTHER]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 minItems: 1
 *                 maxItems: 10
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: Validation error
 */
router.post(
    '/:id/images',
    authMiddleware,
    upload.array('images', 10),
    validate(uploadImagesSchema),
    returnsController.uploadImages.bind(returnsController)
);

/**
 * @swagger
 * /returns/{id}/images/{imageId}:
 *   delete:
 *     summary: Delete image from return request
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       403:
 *         description: Forbidden - not image owner
 *       404:
 *         description: Image not found
 */
router.delete(
    '/:id/images/:imageId',
    authMiddleware,
    validate(deleteImageSchema),
    returnsController.deleteImage.bind(returnsController)
);

// ============================================
// CUSTOMER ACTIONS
// ============================================

/**
 * @swagger
 * /returns/{id}:
 *   delete:
 *     summary: Cancel return request
 *     tags: [Returns]
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
 *         description: Return request cancelled successfully
 *       400:
 *         description: Cannot cancel in current status
 *       403:
 *         description: Forbidden - not request owner
 *       404:
 *         description: Return request not found
 */
router.delete(
    '/:id',
    authMiddleware,
    validate(returnIdSchema),
    returnsController.cancelReturn.bind(returnsController)
);

// ============================================
// ADMIN ONLY
// ============================================

/**
 * @swagger
 * /returns/{id}/status:
 *   put:
 *     summary: Force update return status (Admin only)
 *     tags: [Returns]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED, COMPLETED]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Return request not found
 */
router.put(
    '/:id/status',
    authMiddleware,
    roleMiddleware([ROLES.ADMIN]),
    validate(updateReturnStatusSchema),
    returnsController.forceUpdateStatus.bind(returnsController)
);

export default router;
