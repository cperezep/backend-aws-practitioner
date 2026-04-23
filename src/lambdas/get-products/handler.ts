import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ok } from '@/lambdas/shared/http-response';
import { withMiddleware } from '@/lambdas/shared/middleware';
import { InMemoryProductRepository } from '@/repositories/in-memory/product.repository';
import { ProductService } from '@/services/product.service';

const productService = new ProductService(new InMemoryProductRepository());

const getProducts = async (_event: APIGatewayProxyEvent) => {
  const products = await productService.getAll();

  return ok(products);
};

export const handler = withMiddleware(getProducts);
