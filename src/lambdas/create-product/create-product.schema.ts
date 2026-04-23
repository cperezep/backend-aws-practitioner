import { z } from 'zod';

export const CreateProductSchema = z.object({
  title: z.string({ error: 'title must be a string' }).trim().min(1, 'title is required'),
  description: z.string().optional(),
  price: z.number({ error: 'price must be a non-negative number' }).min(0, 'price must be a non-negative number'),
});
