import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ok } from '@/lambdas/shared/http-response';
import { withMiddleware } from '@/lambdas/shared/middleware';
import { DynamoDbProductRepository } from '@/repositories/dynamodb/product.repository';
import { ProductService } from '@/services/product.service';

const productService = new ProductService(new DynamoDbProductRepository());

const getProducts = async (_event: APIGatewayProxyEvent) => {
  const products = await productService.getAll();

  return ok(products);
};

export const handler = withMiddleware(getProducts);
