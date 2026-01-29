// src/utils/upload.ts
import { supabase, SUPABASE_BUCKET } from '../config/supabase';
import { AppError } from './errorHandler';

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload a file to Supabase Storage
 * @param file - Express Multer file object
 * @param folder - Folder path in bucket (e.g., 'avatars', 'products', 'prescriptions')
 * @returns Object containing public URL and storage path
 */
export const uploadToSupabase = async (
  file: Express.Multer.File,
  folder: string
): Promise<UploadResult> => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${timestamp}-${randomString}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error details:', {
        message: error.message,
        name: error.name,
        error: error,
      });
      throw new AppError(
        `Failed to upload file to storage: ${error.message}`,
        500
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to upload file: ${error?.message || 'Unknown error'}`,
      500
    );
  }
};

/**
 * Delete a file from Supabase Storage
 * @param filePath - Path to file in storage
 */
export const deleteFromSupabase = async (filePath: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      throw new AppError('Failed to delete file from storage', 500);
    }
  } catch (error) {
    console.error('Delete error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete file', 500);
  }
};

/**
 * Extract file path from Supabase URL
 * @param url - Full Supabase storage URL
 * @returns File path in storage
 */
export const extractPathFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split(`/${SUPABASE_BUCKET}/`);
    return pathParts[1] || null;
  } catch {
    return null;
  }
};

/**
 * Validate image file
 * @param file - Express Multer file object
 * @param maxSizeMB - Maximum file size in MB
 */
export const validateImageFile = (
  file: Express.Multer.File,
  maxSizeMB: number = 5
): void => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError(
      'Invalid file type. Only JPEG, PNG, and WebP images are allowed',
      400
    );
  }

  if (file.size > maxSize) {
    throw new AppError(`File size must not exceed ${maxSizeMB}MB`, 400);
  }
};
