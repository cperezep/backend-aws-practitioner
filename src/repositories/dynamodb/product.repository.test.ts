const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: mockSend }),
  },
  ScanCommand: jest.fn().mockImplementation((input) => ({ _type: 'Scan', ...input })),
  GetCommand: jest.fn().mockImplementation((input) => ({ _type: 'Get', ...input })),
  TransactWriteCommand: jest.fn().mockImplementation((input) => ({ _type: 'TransactWrite', ...input })),
}));

import { DynamoDbProductRepository } from './product.repository';

describe('DynamoDbProductRepository', () => {
  let repository: DynamoDbProductRepository;

  beforeEach(() => {
    process.env.PRODUCTS_TABLE_NAME = 'test-products';
    process.env.STOCK_TABLE_NAME = 'test-stock';
    repository = new DynamoDbProductRepository();
    mockSend.mockReset();
  });

  describe('findAll', () => {
    it('returns all products joined with their stock counts', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [{ id: '1', title: 'Book A', price: 10 }] })
        .mockResolvedValueOnce({ Items: [{ product_id: '1', count: 5 }] });

      const result = await repository.findAll();

      expect(result).toEqual([{ id: '1', title: 'Book A', price: 10, count: 5 }]);
    });

    it('defaults count to 0 when no stock entry exists for a product', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [{ id: '1', title: 'Book A', price: 10 }] })
        .mockResolvedValueOnce({ Items: [] });

      const result = await repository.findAll();

      expect(result).toEqual([{ id: '1', title: 'Book A', price: 10, count: 0 }]);
    });

    it('returns an empty array when the products table is empty', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the product with its stock count when found', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: { id: '1', title: 'Book A', price: 10 } })
        .mockResolvedValueOnce({ Item: { product_id: '1', count: 3 } });

      const result = await repository.findById('1');

      expect(result).toEqual({ id: '1', title: 'Book A', price: 10, count: 3 });
    });

    it('returns undefined when the product does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined }).mockResolvedValueOnce({ Item: undefined });

      const result = await repository.findById('unknown');

      expect(result).toBeUndefined();
    });

    it('defaults count to 0 when no stock entry exists', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: { id: '1', title: 'Book A', price: 10 } })
        .mockResolvedValueOnce({ Item: undefined });

      const result = await repository.findById('1');

      expect(result).toEqual({ id: '1', title: 'Book A', price: 10, count: 0 });
    });
  });

  describe('create', () => {
    it('returns the created product with a generated id and default count of 0', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await repository.create({ title: 'New Book', price: 19.99, count: 0 });

      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.title).toBe('New Book');
      expect(result.price).toBe(19.99);
      expect(result.count).toBe(0);
    });

    it('uses a single TransactWrite call (atomic insert into both tables)', async () => {
      mockSend.mockResolvedValueOnce({});

      await repository.create({ title: 'New Book', price: 19.99, count: 0 });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('includes description in the products item when provided', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await repository.create({
        title: 'New Book',
        description: 'A great read',
        price: 19.99,
        count: 0,
      });

      expect(result.description).toBe('A great read');
    });
  });
});
