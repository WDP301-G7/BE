// src/modules/stores/stores.routes.ts
import { Router } from 'express';
import { storesController } from './stores.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../constants/roles';
import {
  createStoreSchema,
  updateStoreSchema,  
  getStoreSchema,
  getStoresQuerySchema,
} from '../../validations/zod/stores.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Stores
 *   description: Store management endpoints
 */

/**
 * @swagger
 * /stores:
 *   get:
 *     summary: Get all stores with pagination
 *     tags: [Stores]
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stores retrieved successfully
 */
router.get(
  '/',
  validate(getStoresQuerySchema),
  storesController.getStores.bind(storesController)
);

/**
 * @swagger
 * /stores/{id}:
 *   get:
 *     summary: Get store by ID
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Store retrieved successfully
 *       404:
 *         description: Store not found
 */
router.get(
  '/:id',
  validate(getStoreSchema),
  storesController.getStoreById.bind(storesController)
);

/**
 * @swagger
 * /stores:
 *   post:
 *     summary: Create new store
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               address:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 255
 *     responses:
 *       201:
 *         description: Store created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Store name already exists
 */
router.post(
  '/',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  validate(createStoreSchema),
  storesController.createStore.bind(storesController)
);

/**
 * @swagger
 * /stores/{id}:
 *   put:
 *     summary: Update store
 *     tags: [Stores]
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
 *                 minLength: 2
 *                 maxLength: 100
 *               address:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 255
 *     responses:
 *       200:
 *         description: Store updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Store not found
 *       409:
 *         description: Store name already exists
 */
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  validate(updateStoreSchema),
  validate(getStoreSchema),
  storesController.updateStore.bind(storesController)
);

/**
 * @swagger
 * /stores/{id}:
 *   delete:
 *     summary: Delete store
 *     tags: [Stores]
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
 *         description: Store deleted successfully
 *       400:
 *         description: Store has inventory or users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Store not found
 */
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  validate(getStoreSchema),
  storesController.deleteStore.bind(storesController)
);

export default router;
