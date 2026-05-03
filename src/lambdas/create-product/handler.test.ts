import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { ProductWithStock } from '@/common/types';

const MOCK_PRODUCT: ProductWithStock = {
  id: 'generated-uuid',
  title: 'New Book',
  description: 'A great book',
  price: 19.99,
  count: 0,
};

jest.mock('@/services/product.service', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue(MOCK_PRODUCT),
  })),
}));

import { handler } from './handler';

const buildEvent = (body: unknown): Partial<APIGatewayProxyEvent> => ({
  httpMethod: 'POST',
  path: '/products',
  headers: { 'Content-Type': 'application/json' },
  body: body === null ? null : JSON.stringify(body),
});

describe('createProduct handler', () => {
  it('returns 201 with the created product', async () => {
    const event = buildEvent({ title: 'New Book', description: 'A great book', price: 19.99 });

    const response = await handler(event as Parameters<typeof handler>[0], {} as Context);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual(MOCK_PRODUCT);
  });

  it('returns 400 when title is missing', async () => {
    const event = buildEvent({ price: 9.99 });

    const response = await handler(event as Parameters<typeof handler>[0], {} as Context);

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when title is empty string', async () => {
    const event = buildEvent({ title: '  ', price: 9.99 });

    const response = await handler(event as Parameters<typeof handler>[0], {} as Context);

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when price is missing', async () => {
    const event = buildEvent({ title: 'New Book' });

    const response = await handler(event as Parameters<typeof handler>[0], {} as Context);

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when price is negative', async () => {
    const event = buildEvent({ title: 'New Book', price: -1 });

    const response = await handler(event as Parameters<typeof handler>[0], {} as Context);

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const event = buildEvent(null);

    const response = await handler(event as Parameters<typeof handler>[0], {} as Context);

    expect(response.statusCode).toBe(400);
  });
});
