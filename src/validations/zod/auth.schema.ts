// src/validations/zod/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(150, 'Full name must not exceed 150 characters'),
    email: z.string().email('Invalid email format'),
    phone: z
      .string()
      .regex(/^[0-9]{10,11}$/, 'Phone must be 10-11 digits')
      .optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(255, 'Password must not exceed 255 characters'),
    address: z.string().max(255).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string().min(1, 'Credential is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(255, 'New password must not exceed 255 characters'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
