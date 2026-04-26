import { Router } from 'express';
import { submit, getStatus, replay } from '../controllers/ticketController.js';

const router = Router();

router.post('/',               submit);
router.get('/:taskId',         getStatus);
router.post('/:taskId/replay', replay);

export default router;
