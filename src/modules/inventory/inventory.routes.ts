// src/modules/inventory/inventory.routes.ts
import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../constants/roles';
import {
  createInventorySchema,
  updateInventorySchema,
  reserveInventorySchema,
  releaseInventorySchema,
  getInventorySchema,
  getInventoryByProductSchema,
  getInventoryByStoreSchema,
  getInventoryQuerySchema,
} from '../../validations/zod/inventory.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory management endpoints
 */

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory with pagination and filters
 *     tags: [Inventory]
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
 *         name: productId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Inventory retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  validate(getInventoryQuerySchema),
  inventoryController.getInventory.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/product/{productId}:
 *   get:
 *     summary: Get inventory for a specific product across all stores
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inventory retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get(
  '/product/:productId',
  validate(getInventoryByProductSchema),
  inventoryController.getInventoryByProduct.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/product/{productId}/available:
 *   get:
 *     summary: Get total available quantity for a product
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Available quantity retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get(
  '/product/:productId/available',
  validate(getInventoryByProductSchema),
  inventoryController.getTotalAvailableQuantity.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/store/{storeId}:
 *   get:
 *     summary: Get inventory for a specific store
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inventory retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Store not found
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  validate(getInventoryByStoreSchema),
  inventoryController.getInventoryByStore.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get inventory by ID
 *     tags: [Inventory]
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
 *         description: Inventory retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  validate(getInventorySchema),
  inventoryController.getInventoryById.bind(inventoryController)
);

/**
 * @swagger
 * /inventory:
 *   post:
 *     summary: Create new inventory
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - storeId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *               storeId:
 *                 type: string
 *                 format: uuid
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *               reservedQuantity:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       201:
 *         description: Inventory created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product or store not found
 *       409:
 *         description: Inventory already exists
 */
router.post(
  '/',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  validate(createInventorySchema),
  inventoryController.createInventory.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update inventory
 *     tags: [Inventory]
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
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *               reservedQuantity:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  validate(updateInventorySchema),
  validate(getInventorySchema),
  inventoryController.updateInventory.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/{id}/reserve:
 *   patch:
 *     summary: Reserve inventory (for orders)
 *     tags: [Inventory]
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
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Inventory reserved successfully
 *       400:
 *         description: Not enough available quantity
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
router.patch(
  '/:id/reserve',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  validate(reserveInventorySchema),
  validate(getInventorySchema),
  inventoryController.reserveInventory.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/{id}/release:
 *   patch:
 *     summary: Release reserved inventory
 *     tags: [Inventory]
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
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Inventory released successfully
 *       400:
 *         description: Cannot release more than reserved quantity
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
router.patch(
  '/:id/release',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]),
  validate(releaseInventorySchema),
  validate(getInventorySchema),
  inventoryController.releaseInventory.bind(inventoryController)
);

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete inventory
 *     tags: [Inventory]
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
 *         description: Inventory deleted successfully
 *       400:
 *         description: Cannot delete inventory with reserved items
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  validate(getInventorySchema),
  inventoryController.deleteInventory.bind(inventoryController)
);

export default router;
