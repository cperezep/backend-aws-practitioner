import type { APIGatewayProxyEvent } from 'aws-lambda';
import { BadRequestError } from '@/common/errors.js';
import { ok } from '@/lambdas/shared/http-response.js';
import { withMiddleware } from '@/lambdas/shared/middleware.js';
import { InMemoryProductRepository } from '@/repositories/in-memory/product.repository.js';
import { ProductService } from '@/services/product.service.js';

const productService = new ProductService(new InMemoryProductRepository());

const getProduct = async (event: APIGatewayProxyEvent) => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
    throw new BadRequestError('productId path parameter is required');
  }

  return ok(await productService.getById(productId));
};

export const handler = withMiddleware(getProduct);
