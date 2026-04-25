import type { APIGatewayProxyEvent } from 'aws-lambda';
import { created } from '@/lambdas/shared/http-response';
import { withMiddleware } from '@/lambdas/shared/middleware';
import { parseBody } from '@/lambdas/shared/parse-body';
import { DynamoDbProductRepository } from '@/repositories/dynamodb/product.repository';
import { ProductService } from '@/services/product.service';
import { CreateProductSchema } from './create-product.schema';

const productService = new ProductService(new DynamoDbProductRepository());

const createProduct = async (event: APIGatewayProxyEvent) => {
  const body = parseBody(CreateProductSchema, event.body);

  // biome-ignore lint/suspicious/noConsole: This log is intentional for debugging purposes
  console.log('Creating product with data:', body);

  const product = await productService.create(body);

  return created(product);
};

export const handler = withMiddleware(createProduct);
