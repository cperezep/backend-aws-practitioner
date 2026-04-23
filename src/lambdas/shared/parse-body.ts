import type { z } from 'zod';
import { BadRequestError } from '@/common/errors';

/**
 * Validates `body` against the given Zod schema.
 * Throws a `BadRequestError` with a human-readable message on failure,
 * so Middy's httpErrorHandler will convert it to a 400 HTTP response.
 */
export const parseBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
  const result = schema.safeParse(body);

  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join('; ');
    throw new BadRequestError(message);
  }

  return result.data;
};
