// src/modules/orders/orders.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ordersService } from './orders.service';
import { apiResponse } from '../../utils/apiResponse';
import {
    CreateOrderInput,
    ConfirmOrderInput,
    UpdateAppointmentInput,
    GetOrdersQuery,
    UpdateOrderStatusInput,
    CancelOrderInput,
    VerifyOrderQuery,
    CompleteOrderWithNotesInput,
} from '../../validations/zod/orders.schema';

class OrdersController {
    /**
     * @route   POST /api/orders
     * @desc    Create new order
     * @access  Private (Customer)
     */
    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const data: CreateOrderInput = req.body;

            const order = await ordersService.createOrder(customerId, data);

            res.status(201).json(apiResponse.success(order, 'Order created successfully', 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders/my
     * @desc    Get customer's orders
     * @access  Private (Customer)
     */
    async getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await ordersService.getMyOrders(customerId, page, limit);

            res.status(200).json(apiResponse.success(result, 'Orders retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders/:id
     * @desc    Get order by ID
     * @access  Private
     */
    async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            const order = await ordersService.getOrderById(orderId, userId, userRole);

            res.status(200).json(apiResponse.success(order, 'Order retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders
     * @desc    Get all orders with filters (Operation/Admin)
     * @access  Private (Operation, Manager, Admin)
     */
    async getAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const query = req.query as any as GetOrdersQuery;

            const filter = {
                page: query.page ? parseInt(query.page) : 1,
                limit: query.limit ? parseInt(query.limit) : 10,
                status: query.status,
                orderType: query.orderType,
                customerId: query.customerId,
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined,
            };

            const result = await ordersService.getAllOrders(filter);

            res.status(200).json(apiResponse.success(result, 'Orders retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/:id/confirm
     * @desc    Confirm order and set appointment (Operation)
     * @access  Private (Operation, Manager, Admin)
     */
    async confirmOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const data: ConfirmOrderInput = req.body;

            const order = await ordersService.confirmAndSetAppointment(orderId, data);

            res.status(200).json(apiResponse.success(order, 'Order confirmed and appointment set successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/orders/:id/appointment
     * @desc    Update appointment
     * @access  Private (Operation, Manager, Admin)
     */
    async updateAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const data: UpdateAppointmentInput = req.body;

            const order = await ordersService.updateAppointment(
                orderId,
                data.appointmentDate,
                data.appointmentNote
            );

            res.status(200).json(apiResponse.success(order, 'Appointment updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders/assigned
     * @desc    Get orders assigned to staff
     * @access  Private (Staff)
     */
    async getAssignedOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.userId;
            const { status } = req.query as { status?: string };

            const orders = await ordersService.getAssignedOrders(staffId, status as any);

            res.status(200).json(apiResponse.success(orders, 'Assigned orders retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/:id/start-processing
     * @desc    Start processing order (Staff)
     * @access  Private (Staff)
     */
    async startProcessing(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const staffId = req.user!.userId;

            const order = await ordersService.startProcessing(orderId, staffId);

            res.status(200).json(apiResponse.success(order, ' Order processing started'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/:id/mark-ready
     * @desc    Mark order as ready (Staff)
     * @access  Private (Staff)
     */
    async markAsReady(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;

            const order = await ordersService.markAsReady(orderId);

            res.status(200).json(apiResponse.success(order, 'Order marked as ready'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/:id/complete
     * @desc    Complete order (Staff)
     * @access  Private (Staff)
     */
    async completeOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;

            const order = await ordersService.completeOrder(orderId);

            res.status(200).json(apiResponse.success(order, 'Order completed successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/:id/cancel
     * @desc    Cancel order
     * @access  Private
     */
    async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;
            const data: CancelOrderInput = req.body;

            const order = await ordersService.cancelOrder(orderId, userId, userRole, data.reason);

            res.status(200).json(apiResponse.success(order, 'Order cancelled successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders/stats
     * @desc    Get order statistics
     * @access  Private (Admin, Manager)
     */
    async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const stats = await ordersService.getStats();

            res.status(200).json(apiResponse.success(stats, 'Order statistics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/orders/:id/status
     * @desc    Force update order status (Admin only)
     * @access  Private (Admin)
     */
    async forceUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const data: UpdateOrderStatusInput = req.body;

            const order = await ordersService.forceUpdateStatus(orderId, data.status);

            res.status(200).json(apiResponse.success(order, 'Order status updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders/:id/verify
     * @desc    Verify order for pickup (Staff)
     * @access  Private (Staff, Operation, Admin)
     */
    async verifyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const { phone } = req.query as VerifyOrderQuery;

            const result = await ordersService.verifyOrderForPickup(orderId, phone);

            res.status(200).json(apiResponse.success(result, 'Order verification completed'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PATCH /api/orders/:id/complete
     * @desc    Complete order with notes (Staff)
     * @access  Private (Staff, Operation, Admin)
     */
    async completeOrderWithNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const staffId = req.user!.userId;
            const data: CompleteOrderWithNotesInput = req.body;

            const order = await ordersService.completeOrderWithNotes(orderId, staffId, data.completionNote);

            res.status(200).json(apiResponse.success(order, 'Order completed successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/orders/:id/prescription
     * @desc    Get order prescription details
     * @access  Private (Customer/Staff/Operation/Admin)
     */
    async getOrderPrescription(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            const prescription = await ordersService.getOrderPrescription(orderId, userId, userRole);

            res.status(200).json(apiResponse.success(prescription, 'Prescription retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/expire-unpaid
     * @desc    Manually trigger expiry of unpaid orders (Admin/Operation)
     * @access  Private (Admin, Operation)
     */
    async expireUnpaidOrders(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await ordersService.expireUnpaidOrders();

            res.status(200).json(apiResponse.success(result, `Expired ${result.expiredCount} unpaid order(s)`));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/orders/:id/confirm-receipt
     * @desc    Customer confirms they received the order
     * @access  Private (Customer)
     */
    async confirmReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.id as string;
            const customerId = req.user!.userId;

            const order = await ordersService.confirmReceipt(orderId, customerId);

            res.status(200).json(apiResponse.success(order, 'Receipt confirmed and order completed'));
        } catch (error) {
            next(error);
        }
    }
}

export const ordersController = new OrdersController();
