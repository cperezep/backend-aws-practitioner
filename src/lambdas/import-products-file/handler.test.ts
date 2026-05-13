import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { generateUploadUrl } from '@/services/import.service';
import { handler } from './handler';

jest.mock('@/services/import.service', () => ({
  generateUploadUrl: jest.fn(),
}));

const mockGenerateUploadUrl = generateUploadUrl as jest.MockedFunction<typeof generateUploadUrl>;

const buildEvent = (queryStringParameters: Record<string, string>): Partial<APIGatewayProxyEvent> => ({
  httpMethod: 'GET',
  path: '/import',
  headers: { Accept: 'application/json' },
  queryStringParameters: queryStringParameters ?? null,
});

describe('GET /import handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with signed URL for valid name', async () => {
    const fakeUrl = 'https://bucket.s3.amazonaws.com/uploaded/products.csv?signed';
    mockGenerateUploadUrl.mockResolvedValue(fakeUrl);

    const event = buildEvent({ name: 'products.csv' }) as Parameters<typeof handler>[0];
    const response = await handler(event, {} as Context);

    expect(mockGenerateUploadUrl).toHaveBeenCalledWith('products.csv');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toBe(fakeUrl);
  });
});
