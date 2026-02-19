import { Router } from 'express';
import { config } from '../config/env';

import { authRouter } from './auth.router';
import userRouter from './user.router';
import patientRouter from './patient.router'
import publicRouter from './public.router';
import doctorRouter from './doctor.router';
import appointmentRouter from './appointment.router';
import adminRouter from './admin.router';
import availabilityRouter from './availability.router';
import consultationRouter from './consultation.router';
import invoiceRouter from './invoice.router';
import reportRouter from './report.router';
import searchRouter from './search.router';
import miscRouter from './misc.router';
import paymentRouter from './payment.router';

const router = Router();

router.use(`/api/${config.apiVersion}/auth`, authRouter);
router.use(`/api/${config.apiVersion}/users`, userRouter);
router.use(`/api/${config.apiVersion}/patient`, patientRouter);
router.use(`/api/${config.apiVersion}/public`, publicRouter);
router.use(`/api/${config.apiVersion}/doctors`, doctorRouter);
router.use(`/api/${config.apiVersion}/appointments`, appointmentRouter);
router.use(`/api/${config.apiVersion}/admin`, adminRouter);
router.use(`/api/${config.apiVersion}/schedule`, availabilityRouter);
router.use(`/api/${config.apiVersion}/consultation`, consultationRouter);
router.use(`/api/${config.apiVersion}/invoice`, invoiceRouter);
router.use(`/api/${config.apiVersion}/reports`, reportRouter);
router.use(`/api/${config.apiVersion}/search`, searchRouter);
router.use(`/api/${config.apiVersion}/misc`, miscRouter);
router.use(`/api/${config.apiVersion}/payments`, paymentRouter);

export { router as apiRouter };