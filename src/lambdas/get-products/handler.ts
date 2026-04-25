import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ok } from '@/lambdas/shared/http-response.js';
import { withMiddleware } from '@/lambdas/shared/middleware.js';
import { InMemoryProductRepository } from '@/repositories/in-memory/product.repository.js';
import { ProductService } from '@/services/product.service.js';

const productService = new ProductService(new InMemoryProductRepository());

const getProducts = async (_event: APIGatewayProxyEvent) => {
  const products = await productService.getAll();

  return ok(products);
};

export const handler = withMiddleware(getProducts);
