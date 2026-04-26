import { z } from 'zod';

export const ticketSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  subject:  z.string().min(1, 'Subject is required'),
  body:     z.string().min(10, 'Body must be at least 10 characters'),
});
