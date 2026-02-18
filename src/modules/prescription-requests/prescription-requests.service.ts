// src/modules/prescription-requests/prescription-requests.service.ts
import { PrismaClient, PrescriptionRequestStatus, OrderStatus, PaymentStatus, OrderType } from '@prisma/client';
import { uploadToSupabase } from '../../utils/upload';
import { AppError } from '../../utils/errorHandler';
import {
    CreatePrescriptionRequestInput,
    UpdateContactStatusInput,
    CreateOrderFromRequestInput,
    ScheduleAppointmentInput,
    CloseRequestInput,
    GetPrescriptionRequestsQuery,
} from '../../validations/zod/prescription-requests.schema';

const prisma = new PrismaClient();

class PrescriptionRequestsService {
    /**
     * Create a new prescription request with images
     */
    async createRequest(
        customerId: string,
        data: CreatePrescriptionRequestInput,
        files: Express.Multer.File[]
    ) {
        // Validate images (1-3 required)
        if (!files || files.length < 1 || files.length > 3) {
            throw new AppError('Between 1 and 3 prescription images are required', 400);
        }

        // Verify store exists
        const store = await prisma.store.findUnique({
            where: { id: data.storeId },
        });

        if (!store) {
            throw new AppError('Store not found', 404);
        }

        // Upload images to Supabase
        const uploadedImages = await Promise.all(
            files.map(async (file) => {
                return await uploadToSupabase(file, 'prescriptions');
            })
        );

        // Create request with images in transaction
        const request = await prisma.prescriptionRequest.create({
            data: {
                customerId,
                phone: data.phone,
                storeId: data.storeId,
                consultationType: data.consultationType,
                symptoms: data.symptoms,
                status: PrescriptionRequestStatus.PENDING,
                images: {
                    create: uploadedImages.map((img) => ({
                        imageUrl: img.url,
                    })),
                },
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
                store: true,
                images: true,
            },
        });

        return request;
    }

    /**
     * Get prescription requests with filters
     */
    async getRequests(query: GetPrescriptionRequestsQuery) {
        const { status, storeId, customerId, handledBy, page = 1, limit = 20 } = query;

        const where: any = {};
        if (status) where.status = status;
        if (storeId) where.storeId = storeId;
        if (customerId) where.customerId = customerId;
        if (handledBy) where.handledBy = handledBy;

        const [requests, total] = await Promise.all([
            prisma.prescriptionRequest.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                        },
                    },
                    store: true,
                    handler: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                        },
                    },
                    images: true,
                    order: {
                        select: {
                            id: true,
                            status: true,
                            totalAmount: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.prescriptionRequest.count({ where }),
        ]);

        return {
            data: requests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get single prescription request by ID
     */
    async getRequestById(id: string) {
        const request = await prisma.prescriptionRequest.findUnique({
            where: { id },
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        address: true,
                    },
                },
                store: true,
                handler: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
                images: {
                    orderBy: { createdAt: 'asc' },
                },
                order: {
                    include: {
                        orderItems: {
                            include: {
                                product: {
                                    include: {
                                        images: {
                                            where: { isPrimary: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!request) {
            throw new AppError('Prescription request not found', 404);
        }

        return request;
    }

    /**
     * Update contact status
     */
    async updateContactStatus(id: string, handledBy: string, data: UpdateContactStatusInput) {
        const request = await this.getRequestById(id);

        if (request.status !== PrescriptionRequestStatus.PENDING && request.status !== PrescriptionRequestStatus.CONTACTING) {
            throw new AppError('Request cannot be updated in current status', 400);
        }

        const updated = await prisma.prescriptionRequest.update({
            where: { id },
            data: {
                status: data.status as PrescriptionRequestStatus,
                contactNotes: data.contactNotes,
                contactedAt: new Date(),
                handledBy,
            },
            include: {
                customer: true,
                store: true,
                handler: true,
                images: true,
            },
        });

        return updated;
    }

    /**
     * Create order from prescription request
     */
    async createOrderFromRequest(requestId: string, handledBy: string, data: CreateOrderFromRequestInput) {
        const request = await this.getRequestById(requestId);

        // Validate request status
        if (request.status !== PrescriptionRequestStatus.PENDING && request.status !== PrescriptionRequestStatus.CONTACTING) {
            throw new AppError('Cannot create order from request in current status', 400);
        }

        if (request.orderId) {
            throw new AppError('Order already created for this request', 400);
        }

        // Validate products exist
        const productIds = data.orderItems.map((item) => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
        });

        if (products.length !== productIds.length) {
            throw new AppError('One or more products not found', 404);
        }

        // Calculate total amount
        const totalAmount = data.orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + data.expiryDays);

        // Create order with prescription in transaction (writes only)
        const orderId = await prisma.$transaction(async (tx) => {
            // Create order
            const order = await tx.order.create({
                data: {
                    customerId: request.customerId,
                    orderType: OrderType.PRESCRIPTION,
                    status: OrderStatus.WAITING_CUSTOMER,
                    paymentStatus: PaymentStatus.UNPAID,
                    totalAmount,
                    expectedReadyDate: data.expectedReadyDate ? new Date(data.expectedReadyDate) : undefined,
                    handledBy,
                    pickupStoreId: request.storeId,
                    expiresAt,
                    quotedAt: new Date(),
                    orderItems: {
                        create: data.orderItems.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            itemStatus: 'PENDING',
                        })),
                    },
                },
            });

            // Create prescription if data provided
            if (data.prescriptionData) {
                // Use first image from request as prescription image
                const firstImage = request.images[0];

                await tx.prescription.create({
                    data: {
                        orderId: order.id,
                        customerId: request.customerId,
                        prescriptionImageUrl: firstImage?.imageUrl ?? null,
                        notes: data.prescriptionData.notes,
                        measuredBy: handledBy,
                        rightEyeSphere: data.prescriptionData.rightEyeSphere,
                        rightEyeCylinder: data.prescriptionData.rightEyeCylinder,
                        rightEyeAxis: data.prescriptionData.rightEyeAxis,
                        leftEyeSphere: data.prescriptionData.leftEyeSphere,
                        leftEyeCylinder: data.prescriptionData.leftEyeCylinder,
                        leftEyeAxis: data.prescriptionData.leftEyeAxis,
                        pupillaryDistance: data.prescriptionData.pupillaryDistance,
                    },
                });
            }

            // Update request status
            await tx.prescriptionRequest.update({
                where: { id: requestId },
                data: {
                    status: PrescriptionRequestStatus.QUOTED,
                    orderId: order.id,
                    handledBy,
                },
            });

            return order.id;
        }, { timeout: 15000 }); // 15s timeout for slow connections

        // Fetch complete order OUTSIDE transaction (no timeout risk)
        const result = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: {
                    include: {
                        product: {
                            include: {
                                images: {
                                    where: { isPrimary: true },
                                },
                            },
                        },
                    },
                },
                prescription: true,
                pickupStore: true,
            },
        });

        return result;
    }

    /**
     * Schedule appointment
     */
    async scheduleAppointment(id: string, data: ScheduleAppointmentInput) {
        const request = await this.getRequestById(id);

        if (request.status === PrescriptionRequestStatus.ACCEPTED ||
            request.status === PrescriptionRequestStatus.REJECTED ||
            request.status === PrescriptionRequestStatus.LOST) {
            throw new AppError('Cannot schedule appointment for closed request', 400);
        }

        const updated = await prisma.prescriptionRequest.update({
            where: { id },
            data: {
                status: PrescriptionRequestStatus.SCHEDULED,
                appointmentDate: new Date(data.appointmentDate),
                contactNotes: data.appointmentNote,
            },
            include: {
                customer: true,
                store: true,
                images: true,
            },
        });

        return updated;
    }

    /**
     * Close request (lost/rejected)
     */
    async closeRequest(id: string, handledBy: string, data: CloseRequestInput) {
        const request = await this.getRequestById(id);

        if (request.orderId) {
            throw new AppError('Cannot close request that has an associated order', 400);
        }

        const updated = await prisma.prescriptionRequest.update({
            where: { id },
            data: {
                status: data.status as PrescriptionRequestStatus,
                contactNotes: data.contactNotes,
                handledBy,
            },
            include: {
                customer: true,
                store: true,
                handler: true,
                images: true,
            },
        });

        return updated;
    }
}

export const prescriptionRequestsService = new PrescriptionRequestsService();
