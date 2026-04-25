import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { Product } from '@/common/types';
import { ProductService } from '@/services/product.service';

jest.mock('@/lambdas/shared/middleware', () => ({
  withMiddleware: (fn: unknown) => fn,
}));

jest.mock('@/services/product.service');

import { handler } from './handler';

const MockProductService = ProductService as jest.MockedClass<typeof ProductService>;

const MOCK_PRODUCTS: Product[] = [
  { id: '1', title: 'AWS CDK in Practice', description: 'Learn CDK fundamentals', price: 29.99 },
  { id: '2', title: 'Serverless Patterns', description: 'Common Lambda patterns', price: 34.99 },
];

const buildEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): Partial<APIGatewayProxyEvent> => ({
  httpMethod: 'GET',
  path: '/products',
  headers: { Accept: 'application/json' },
  ...overrides,
});

describe('GET /products handler', () => {
  let mockServiceInstance: jest.Mocked<InstanceType<typeof ProductService>>;
  const event = buildEvent() as Parameters<typeof handler>[0];

  beforeAll(async () => {
    mockServiceInstance = MockProductService.mock.instances[0] as jest.Mocked<InstanceType<typeof ProductService>>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with all products', async () => {
    mockServiceInstance.getAll.mockResolvedValue(MOCK_PRODUCTS);

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(MOCK_PRODUCTS);
  });

  it('propagates errors thrown by the service', async () => {
    mockServiceInstance.getAll.mockRejectedValue(new Error('DB connection failed'));

    await expect(handler(event, {} as Context)).rejects.toThrow('DB connection failed');
  });
});
