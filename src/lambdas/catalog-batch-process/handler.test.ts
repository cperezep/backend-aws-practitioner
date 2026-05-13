import type { SQSEvent, SQSRecord } from 'aws-lambda';
import type { ProductWithStock } from '@/common/types';

const mockCreate = jest.fn();

jest.mock('@/services/product.service', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    create: mockCreate,
  })),
}));

import { handler } from './handler';

const MOCK_PRODUCT: ProductWithStock = {
  id: 'test-uuid',
  title: 'Widget',
  description: undefined,
  price: 9.99,
  count: 0,
};

const makeRecord = (body: unknown, messageId = 'msg-1'): SQSRecord =>
  ({
    messageId,
    body: JSON.stringify(body),
  }) as SQSRecord;

const makeEvent = (records: SQSRecord[]): SQSEvent => ({ Records: records }) as SQSEvent;

describe('catalogBatchProcess handler', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(MOCK_PRODUCT);
  });

  it('processes a single valid record and returns no failures', async () => {
    const event = makeEvent([makeRecord({ title: 'Widget', price: 9.99 })]);

    const result = await handler(event);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({ title: 'Widget', price: 9.99, count: 0 });
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('processes a full batch of 5 valid records and returns no failures', async () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ title: `Product ${i + 1}`, price: i + 1 }, `msg-${i + 1}`),
    );
    const event = makeEvent(records);

    const result = await handler(event);

    expect(mockCreate).toHaveBeenCalledTimes(5);
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('passes description through when provided', async () => {
    const event = makeEvent([makeRecord({ title: 'Described', price: 5.0, description: 'A desc', count: 3 }, 'msg-d')]);

    await handler(event);

    expect(mockCreate).toHaveBeenCalledWith({
      title: 'Described',
      price: 5.0,
      description: 'A desc',
      count: 3,
    });
  });

  it('reports only the invalid message when title is missing, and still creates valid ones', async () => {
    const records = [
      makeRecord({ title: 'Valid A', price: 1.0 }, 'msg-valid-a'),
      makeRecord({ price: 2.0 }, 'msg-invalid'),
      makeRecord({ title: 'Valid B', price: 3.0 }, 'msg-valid-b'),
    ];
    const event = makeEvent(records);

    const result = await handler(event);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-invalid' }]);
  });

  it('reports the malformed message when body is not valid JSON, without throwing', async () => {
    const records = [
      makeRecord({ title: 'Good', price: 1.0 }, 'msg-good'),
      { messageId: 'msg-bad-json', body: 'not-json' } as SQSRecord,
    ];
    const event = makeEvent(records);

    const result = await handler(event);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-bad-json' }]);
  });

  it('returns all messageIds in batchItemFailures when every record is invalid', async () => {
    const records = [
      makeRecord({ price: 1.0 }, 'msg-1'),
      makeRecord({ price: 2.0 }, 'msg-2'),
      makeRecord({ price: 3.0 }, 'msg-3'),
    ];
    const event = makeEvent(records);

    const result = await handler(event);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: 'msg-1' },
      { itemIdentifier: 'msg-2' },
      { itemIdentifier: 'msg-3' },
    ]);
  });
});
