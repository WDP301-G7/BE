// src/modules/prescription-requests/prescription-requests.routes.ts
import { Router } from 'express';
import { prescriptionRequestsController } from './prescription-requests.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { uploadPrescriptionImages } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
    createPrescriptionRequestSchema,
    updateContactStatusSchema,
    createOrderFromRequestSchema,
    scheduleAppointmentSchema,
    closeRequestSchema,
    getPrescriptionRequestsQuerySchema,
} from '../../validations/zod/prescription-requests.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: PrescriptionRequests
 *   description: Prescription request management endpoints
 */

/**
 * @swagger
 * /prescription-requests:
 *   post:
 *     summary: Create new prescription request
 *     description: Customer uploads 1-3 prescription images and creates a consultation request
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - storeId
 *               - consultationType
 *               - images
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Customer phone number
 *                 example: "0901234567"
 *               storeId:
 *                 type: string
 *                 format: uuid
 *                 description: Preferred store ID for pickup
 *               consultationType:
 *                 type: string
 *                 enum: [PHONE, IN_STORE]
 *                 description: Type of consultation
 *               symptoms:
 *                 type: string
 *                 description: Customer's vision symptoms or concerns
 *                 example: "Mắt mờ khi nhìn xa, đau đầu khi đọc sách"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 minItems: 1
 *                 maxItems: 3
 *                 description: Prescription images (1-3 required)
 *     responses:
 *       201:
 *         description: Prescription request created successfully
 *       400:
 *         description: Validation error or invalid image count
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/',
    authMiddleware,
    uploadPrescriptionImages,
    validate(createPrescriptionRequestSchema),
    prescriptionRequestsController.createRequest
);

/**
 * @swagger
 * /prescription-requests:
 *   get:
 *     summary: Get prescription requests with filters
 *     description: Operation/Admin can view and filter prescription requests
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONTACTING, QUOTED, ACCEPTED, REJECTED, LOST, EXPIRED, SCHEDULED]
 *         description: Filter by status
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by store
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by customer
 *       - in: query
 *         name: handledBy
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by handler
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Prescription requests retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires OPERATION or ADMIN role
 */
router.get(
    '/',
    authMiddleware,
    roleMiddleware(['OPERATION', 'ADMIN']),
    validate(getPrescriptionRequestsQuerySchema),
    prescriptionRequestsController.getRequests
);

/**
 * @swagger
 * /prescription-requests/{id}:
 *   get:
 *     summary: Get prescription request by ID
 *     description: Get detailed information about a specific prescription request
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Prescription request ID
 *     responses:
 *       200:
 *         description: Prescription request retrieved successfully
 *       404:
 *         description: Prescription request not found
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/:id',
    authMiddleware,
    prescriptionRequestsController.getRequestById
);

/**
 * @swagger
 * /prescription-requests/{id}/contact:
 *   patch:
 *     summary: Update contact status
 *     description: Operation updates the contact status after calling customer
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Prescription request ID
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
 *                 enum: [CONTACTING, LOST, REJECTED]
 *                 description: New status
 *               contactNotes:
 *                 type: string
 *                 description: Notes from the contact attempt
 *                 example: "Đã gọi điện, khách cần gọng nhựa màu đen"
 *     responses:
 *       200:
 *         description: Contact status updated successfully
 *       400:
 *         description: Invalid status transition
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires OPERATION or ADMIN role
 *       404:
 *         description: Prescription request not found
 */
router.patch(
    '/:id/contact',
    authMiddleware,
    roleMiddleware(['OPERATION', 'ADMIN']),
    validate(updateContactStatusSchema),
    prescriptionRequestsController.updateContactStatus
);

/**
 * @swagger
 * /prescription-requests/{id}/create-order:
 *   post:
 *     summary: Create order from prescription request
 *     description: Operation creates a quotation order from the prescription request
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Prescription request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderItems
 *             properties:
 *               orderItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                     - unitPrice
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     unitPrice:
 *                       type: number
 *                       minimum: 0
 *               prescriptionData:
 *                 type: object
 *                 properties:
 *                   rightEyeSphere:
 *                     type: number
 *                     example: -2.5
 *                   rightEyeCylinder:
 *                     type: number
 *                     example: -0.5
 *                   rightEyeAxis:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 180
 *                   leftEyeSphere:
 *                     type: number
 *                     example: -2.75
 *                   leftEyeCylinder:
 *                     type: number
 *                     example: -0.75
 *                   leftEyeAxis:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 180
 *                   pupillaryDistance:
 *                     type: number
 *                     example: 62
 *                   notes:
 *                     type: string
 *               expectedReadyDate:
 *                 type: string
 *                 format: date-time
 *                 description: Expected completion date
 *               expiryDays:
 *                 type: integer
 *                 default: 3
 *                 description: Days until quotation expires
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid request or order already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires OPERATION or ADMIN role
 *       404:
 *         description: Prescription request or products not found
 */
router.post(
    '/:id/create-order',
    authMiddleware,
    roleMiddleware(['OPERATION', 'ADMIN']),
    validate(createOrderFromRequestSchema),
    prescriptionRequestsController.createOrderFromRequest
);

/**
 * @swagger
 * /prescription-requests/{id}/schedule:
 *   patch:
 *     summary: Schedule in-store appointment
 *     description: Schedule an appointment for customer to visit store
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Prescription request ID
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
 *                 description: Appointment date and time
 *               appointmentNote:
 *                 type: string
 *                 description: Notes for the appointment
 *     responses:
 *       200:
 *         description: Appointment scheduled successfully
 *       400:
 *         description: Cannot schedule for closed request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires OPERATION or ADMIN role
 *       404:
 *         description: Prescription request not found
 */
router.patch(
    '/:id/schedule',
    authMiddleware,
    roleMiddleware(['OPERATION', 'ADMIN']),
    validate(scheduleAppointmentSchema),
    prescriptionRequestsController.scheduleAppointment
);

/**
 * @swagger
 * /prescription-requests/{id}/close:
 *   patch:
 *     summary: Close prescription request
 *     description: Mark request as lost or rejected
 *     tags: [PrescriptionRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Prescription request ID
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
 *                 enum: [LOST, REJECTED]
 *                 description: Closing status
 *               contactNotes:
 *                 type: string
 *                 description: Reason for closing
 *     responses:
 *       200:
 *         description: Request closed successfully
 *       400:
 *         description: Cannot close request with associated order
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires OPERATION or ADMIN role
 *       404:
 *         description: Prescription request not found
 */
router.patch(
    '/:id/close',
    authMiddleware,
    roleMiddleware(['OPERATION', 'ADMIN']),
    validate(closeRequestSchema),
    prescriptionRequestsController.closeRequest
);

export default router;
