// src/modules/prescription-requests/prescription-requests.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prescriptionRequestsService } from './prescription-requests.service';
import { apiResponse } from '../../utils/apiResponse';
import {
    CreatePrescriptionRequestInput,
    UpdateContactStatusInput,
    CreateOrderFromRequestInput,
    ScheduleAppointmentInput,
    CloseRequestInput,
    GetPrescriptionRequestsQuery,
} from '../../validations/zod/prescription-requests.schema';

class PrescriptionRequestsController {
    /**
     * @route   POST /api/prescription-requests
     * @desc    Create new prescription request with images
     * @access  Private (Customer)
     */
    async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const data: CreatePrescriptionRequestInput = req.body;
            const files = req.files as Express.Multer.File[];

            const request = await prescriptionRequestsService.createRequest(customerId, data, files);

            res.status(201).json(apiResponse.success(request, 'Prescription request created successfully. Our consultant will contact you within 1-2 hours.', 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/prescription-requests
     * @desc    Get prescription requests with filters
     * @access  Private (Operation/Admin)
     */
    async getRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const query: GetPrescriptionRequestsQuery = req.query;
            const result = await prescriptionRequestsService.getRequests(query);

            res.status(200).json(apiResponse.success(result, 'Prescription requests retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/prescription-requests/:id
     * @desc    Get single prescription request
     * @access  Private (Customer/Operation/Admin)
     */
    async getRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const request = await prescriptionRequestsService.getRequestById(id as string);

            res.status(200).json(apiResponse.success(request, 'Prescription request retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PATCH /api/prescription-requests/:id/contact
     * @desc    Update contact status
     * @access  Private (Operation/Admin)
     */
    async updateContactStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const handledBy = req.user!.userId;
            const data: UpdateContactStatusInput = req.body;

            const request = await prescriptionRequestsService.updateContactStatus(id as string, handledBy, data);

            res.status(200).json(apiResponse.success(request, 'Contact status updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/prescription-requests/:id/create-order
     * @desc    Create order from prescription request
     * @access  Private (Operation/Admin)
     */
    async createOrderFromRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const handledBy = req.user!.userId;
            const data: CreateOrderFromRequestInput = req.body;

            const order = await prescriptionRequestsService.createOrderFromRequest(id as string, handledBy, data);

            res.status(201).json(apiResponse.success(order, 'Order created successfully from prescription request', 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PATCH /api/prescription-requests/:id/schedule
     * @desc    Schedule appointment
     * @access  Private (Operation/Admin)
     */
    async scheduleAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const data: ScheduleAppointmentInput = req.body;

            const request = await prescriptionRequestsService.scheduleAppointment(id as string, data);

            res.status(200).json(apiResponse.success(request, 'Appointment scheduled successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PATCH /api/prescription-requests/:id/close
     * @desc    Close request (lost/rejected)
     * @access  Private (Operation/Admin)
     */
    async closeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const handledBy = req.user!.userId;
            const data: CloseRequestInput = req.body;

            const request = await prescriptionRequestsService.closeRequest(id as string, handledBy, data);

            res.status(200).json(apiResponse.success(request, 'Request closed successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export const prescriptionRequestsController = new PrescriptionRequestsController();
