// src/routes/tickets.ts
import { Router } from 'express';
import { submit, getStatus, replay } from '../controllers/ticketController.ts';

const router = Router();

router.post('/',               submit);
router.get('/:taskId',         getStatus);
router.post('/:taskId/replay', replay);

export default router;
