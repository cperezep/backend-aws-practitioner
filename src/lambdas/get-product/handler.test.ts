import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

jest.mock('@/services/product.service.js', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    getById: jest.fn().mockResolvedValue({ id: 'mock-product-id', name: 'Test Product', price: 99 }),
  })),
}));

import { handler } from './handler';

const buildEvent = (productId?: string): Partial<APIGatewayProxyEvent> => ({
  httpMethod: 'GET',
  path: productId ? `/products/${productId}` : '/products',
  pathParameters: productId ? { productId } : null,
  headers: { Accept: 'application/json' },
});

describe('getProduct handler', () => {
  it('returns 200 with product when productId is provided', async () => {
    const event = buildEvent('mock-product-id') as Parameters<typeof handler>[0];

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      id: 'mock-product-id',
      name: 'Test Product',
      price: 99,
    });
  });

  it('throws BadRequestError when productId is missing', async () => {
    const event = buildEvent() as Parameters<typeof handler>[0];

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(400);
  });
});
