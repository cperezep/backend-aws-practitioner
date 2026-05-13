import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ok } from '@/lambdas/shared/http-response';
import { withMiddleware } from '@/lambdas/shared/middleware';
import { parseSchema } from '@/lambdas/shared/parse-schema';
import { generateUploadUrl } from '@/services/import.service';
import { ImportQuerySchema } from './import-products-file.schema';

const importProductsFile = async (event: APIGatewayProxyEvent) => {
  const data = parseSchema(ImportQuerySchema, event.queryStringParameters);

  const url = await generateUploadUrl(data.name);

  return ok(url);
};

export const handler = withMiddleware(importProductsFile);
