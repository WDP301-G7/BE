// src/validations/zod/prescription-requests.schema.ts
import { z } from 'zod';
import { ConsultationType, PrescriptionRequestStatus } from '@prisma/client';

export const createPrescriptionRequestSchema = z.object({
    body: z.object({
        phone: z.string().min(10, 'Phone number must be at least 10 characters').max(20, 'Phone number too long'),
        storeId: z.string().uuid('Invalid store ID'),
        consultationType: z.nativeEnum(ConsultationType, { required_error: 'Consultation type is required' }),
        symptoms: z.string().max(1000, 'Symptoms description too long').optional(),
    }),
});

export const updateContactStatusSchema = z.object({
    body: z.object({
        status: z.enum(['CONTACTING', 'LOST', 'REJECTED']),
        contactNotes: z.string().max(2000, 'Contact notes too long').optional(),
    }),
});

export const createOrderFromRequestSchema = z.object({
    body: z.object({
        orderItems: z.array(
            z.object({
                productId: z.string().uuid('Invalid product ID'),
                quantity: z.number().int().positive('Quantity must be positive'),
                unitPrice: z.number().positive('Unit price must be positive'),
            })
        ).min(1, 'At least one order item is required'),
        prescriptionData: z.object({
            rightEyeSphere: z.number().min(-20).max(20).optional(),
            rightEyeCylinder: z.number().min(-10).max(10).optional(),
            rightEyeAxis: z.number().int().min(0).max(180).optional(),
            leftEyeSphere: z.number().min(-20).max(20).optional(),
            leftEyeCylinder: z.number().min(-10).max(10).optional(),
            leftEyeAxis: z.number().int().min(0).max(180).optional(),
            pupillaryDistance: z.number().min(40).max(80).optional(),
            notes: z.string().max(1000).optional(),
        }).optional(),
        expectedReadyDate: z.string().datetime().optional(),
        expiryDays: z.number().int().min(1).max(30).default(3), // Default 3 days
    }),
});

export const scheduleAppointmentSchema = z.object({
    body: z.object({
        appointmentDate: z.string().datetime('Invalid appointment date'),
        appointmentNote: z.string().max(500, 'Appointment note too long').optional(),
    }),
});

export const closeRequestSchema = z.object({
    body: z.object({
        status: z.enum(['LOST', 'REJECTED']),
        contactNotes: z.string().max(2000, 'Contact notes too long').optional(),
    }),
});

export const getPrescriptionRequestsQuerySchema = z.object({
    query: z.object({
        status: z.nativeEnum(PrescriptionRequestStatus).optional(),
        storeId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        handledBy: z.string().uuid().optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
});

export type CreatePrescriptionRequestInput = z.infer<typeof createPrescriptionRequestSchema>['body'];
export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>['body'];
export type CreateOrderFromRequestInput = z.infer<typeof createOrderFromRequestSchema>['body'];
export type ScheduleAppointmentInput = z.infer<typeof scheduleAppointmentSchema>['body'];
export type CloseRequestInput = z.infer<typeof closeRequestSchema>['body'];
export type GetPrescriptionRequestsQuery = z.infer<typeof getPrescriptionRequestsQuerySchema>['query'];
