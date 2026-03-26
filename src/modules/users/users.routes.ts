// src/modules/users/users.routes.ts
import { Router } from 'express';
import { usersController } from './users.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { uploadAvatar } from '../../middlewares/upload.middleware';
import { ROLES } from '../../constants/roles';
import {
  createUserSchema,
  getUserSchema,
  getUsersQuerySchema,
} from '../../validations/zod/users.schema';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Get users statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/stats',
  roleMiddleware([ROLES.ADMIN, ROLES.OPERATION]),
  usersController.getUsersStats.bind(usersController)
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users with pagination
 *     tags: [Users]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, STAFF, MANAGER, ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, BANNED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *           enum: [membership]
 *         description: Set to 'membership' to include user membership information
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  roleMiddleware([ROLES.ADMIN, ROLES.OPERATION]),
  validate(getUsersQuerySchema),
  usersController.getUsers.bind(usersController)
);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               address:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, STAFF, MANAGER, ADMIN]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, BANNED]
 *               storeId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER]),
  validate(createUserSchema),
  usersController.createUser.bind(usersController)
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  validate(getUserSchema),
  usersController.getUserById.bind(usersController)
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user profile (supports multipart/form-data with avatar upload)
 *     tags: [Users]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file (max 2MB, JPEG/PNG/WebP)
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, STAFF, MANAGER, ADMIN]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, BANNED]
 *               storeId:
 *                 type: string
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, STAFF, MANAGER, ADMIN]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, BANNED]
 *               storeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error or invalid file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put(
  '/:id',
  validate(getUserSchema),
  uploadAvatar, // Multer middleware to handle avatar upload (optional)
  usersController.updateUser.bind(usersController)
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete(
  '/:id',
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER]),
  validate(getUserSchema),
  usersController.deleteUser.bind(usersController)
);

export default router;
