// src/middlewares/upload.middleware.ts
import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../utils/errorHandler';

// Configure multer to use memory storage
const storage = multer.memoryStorage();


// File filter function
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed image MIME types
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG, PNG, and WebP images are allowed', 400) as any);
  }
};

// Create multer upload instance for single image
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single('image');

// Create multer upload instance for multiple images (max 10)
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
}).array('images', 10);

// Create multer upload instance for avatar
export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for avatars
  },
}).single('avatar');

// Create multer upload instance for prescription
export const uploadPrescription = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single('prescription');

// Create multer upload instance for product images (max 5)
export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
}).array('images', 5);

// Create multer upload instance for prescription request images (1-3 images)
export const uploadPrescriptionImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
}).array('images', 3);

// Create multer upload instance for return request images (1-10 images)
export const uploadReturnImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

// Create multer upload instance for review images (max 3 images)
export const uploadReviewImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
}).array('images', 3);

// Export as 'upload' for convenience
export const upload = uploadReturnImages;
