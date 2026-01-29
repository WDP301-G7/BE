// src/modules/products/product-images.routes.ts
import { Router } from 'express';
import { productImagesController } from './product-images.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { ROLES } from '../../constants/roles';
import { uploadProductImages } from '../../middlewares/upload.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Product Images
 *   description: Product image management endpoints
 */

/**
 * @swagger
 * /products/{id}/images:
 *   get:
 *     summary: Get all images for a product
 *     tags: [Product Images]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/:id/images', productImagesController.getProductImages.bind(productImagesController));

/**
 * @swagger
 * /products/{id}/images:
 *   post:
 *     summary: Upload images for a product (max 5 images total)
 *     tags: [Product Images]
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
 *               - images
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product images (max 5MB each, JPEG/PNG/WebP)
 *               imageType:
 *                 type: string
 *                 enum: [2D, 3D, DETAIL]
 *                 default: 2D
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *       400:
 *         description: Validation error or max images exceeded
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 */
router.post(
  '/:id/images',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  uploadProductImages, // Multer middleware for multiple images
  productImagesController.uploadImages.bind(productImagesController)
);

/**
 * @swagger
 * /products/{id}/images/{imageId}/primary:
 *   put:
 *     summary: Set an image as primary
 *     tags: [Product Images]
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
 *         description: Primary image updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product or image not found
 */
router.put(
  '/:id/images/:imageId/primary',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  productImagesController.setPrimaryImage.bind(productImagesController)
);

/**
 * @swagger
 * /products/{id}/images/{imageId}:
 *   delete:
 *     summary: Delete a product image
 *     tags: [Product Images]
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
 *       400:
 *         description: Cannot delete last image
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product or image not found
 */
router.delete(
  '/:id/images/:imageId',
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  productImagesController.deleteImage.bind(productImagesController)
);

export default router;
