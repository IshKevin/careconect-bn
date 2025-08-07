import { Router } from 'express';
import { config } from '../config/env';

import { authRouter } from './auth.router';
//import userRouter from './user.router';
//import doctorRouter from './doctor.router';
//import appointmentRouter from './appointment.router';
// import adminRouter from './admin.router';
// import availabilityRouter from './availability.router';
// import consultationRouter from './consultation.router';
// import invoiceRouter from './invoice.router';
// import reportRouter from './report.router';
// import searchRouter from './search.router';
// import miscRouter from './misc.router';

const router = Router();

router.use(`/api/${config.apiVersion}/auth`, authRouter);
//router.use(`/api/${config.apiVersion}/users`, userRouter);
//router.use(`/api/${config.apiVersion}/doctors`, doctorRouter);
//router.use(`/api/${config.apiVersion}/appointments`, appointmentRouter);
// router.use(adminRouter);
// router.use(availabilityRouter);
// router.use(consultationRouter);
// router.use(invoiceRouter);
// router.use(reportRouter);
// router.use(searchRouter);
// router.use(miscRouter);

export { router as apiRouter };