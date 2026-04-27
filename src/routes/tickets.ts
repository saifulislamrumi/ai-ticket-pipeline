// src/routes/tickets.ts
import { Router } from 'express';
import { list, submit, getStatus, replay } from '../controllers/ticketController.ts';

const router = Router();

router.get('/',                list);
router.post('/',               submit);
router.get('/:taskId',         getStatus);
router.post('/:taskId/replay', replay);

export default router;
