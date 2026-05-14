import z from 'zod';
import { ProductSchema } from '../shared/product.schema';

// CSV values are always strings — coerce numeric fields before strict validation
export const CsvProductSchema = ProductSchema.extend({
  price: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.coerce.number().min(0, 'price must be a non-negative number'),
  ),
  count: z.preprocess((val) => (val === '' ? undefined : val), z.coerce.number().int().min(0).default(0)),
});
