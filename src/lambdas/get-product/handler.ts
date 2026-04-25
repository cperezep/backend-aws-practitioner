import type { APIGatewayProxyEvent } from 'aws-lambda';
import { BadRequestError } from '@/common/errors';
import { ok } from '@/lambdas/shared/http-response';
import { withMiddleware } from '@/lambdas/shared/middleware';
import { DynamoDbProductRepository } from '@/repositories/dynamodb/product.repository';
import { ProductService } from '@/services/product.service';

const productService = new ProductService(new DynamoDbProductRepository());

const getProduct = async (event: APIGatewayProxyEvent) => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
    throw new BadRequestError('productId path parameter is required');
  }

  // biome-ignore lint/suspicious/noConsole: This log is intentional for debugging purposes
  console.log('Fetching product with ID:', productId);

  return ok(await productService.getById(productId));
};

export const handler = withMiddleware(getProduct);
