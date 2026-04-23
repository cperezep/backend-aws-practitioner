import type { APIGatewayProxyEvent } from 'aws-lambda';
import { BadRequestError } from '@/common/errors';
import { ok } from '@/lambdas/shared/http-response';
import { withMiddleware } from '@/lambdas/shared/middleware';
import { InMemoryProductRepository } from '@/repositories/in-memory/product.repository';
import { ProductService } from '@/services/product.service';

const productService = new ProductService(new InMemoryProductRepository());

const getProduct = async (event: APIGatewayProxyEvent) => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
    throw new BadRequestError('productId path parameter is required');
  }

  return ok(await productService.getById(productId));
};

export const handler = withMiddleware(getProduct);
