import { z } from 'zod';

export const ImportQuerySchema = z.object({
  name: z
    .string({ error: 'name is required' })
    .min(1, 'name is required')
    .max(255)
    .regex(/^[A-Za-z0-9._-]+$/, 'name contains invalid characters')
    .endsWith('.csv', 'name must end with .csv'),
});

export type ImportQuery = z.infer<typeof ImportQuerySchema>;
