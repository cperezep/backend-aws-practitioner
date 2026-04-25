import { NotFoundError } from '@/common/errors';
import type { Product } from '@/common/types';
import type { ProductRepository } from '@/repositories/product.repository';
import { ProductService } from './product.service';

const MOCK_PRODUCTS: Product[] = [
  { id: '1', title: 'AWS CDK in Practice', description: 'Learn CDK fundamentals', price: 29.99 },
  { id: '2', title: 'Serverless Patterns', description: 'Common Lambda patterns', price: 34.99 },
];

describe('ProductService', () => {
  let service: ProductService;
  let mockRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn().mockResolvedValue(MOCK_PRODUCTS),
      findById: jest.fn(),
    };
    service = new ProductService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all products from the repository', async () => {
      const result = await service.getAll();

      expect(result).toEqual(MOCK_PRODUCTS);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('getById', () => {
    it('returns the product when it exists', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_PRODUCTS[0]);

      const result = await service.getById('1');

      expect(result).toEqual(MOCK_PRODUCTS[0]);
      expect(mockRepository.findById).toHaveBeenCalledWith('1');
    });

    it('throws NotFoundError when product does not exist', async () => {
      mockRepository.findById.mockResolvedValue(undefined);

      await expect(service.getById('999')).rejects.toThrow(NotFoundError);
      await expect(service.getById('999')).rejects.toThrow('Product with id "999" not found');
    });

    it('delegates the id lookup to the repository', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_PRODUCTS[1]);

      await service.getById('2');

      expect(mockRepository.findById).toHaveBeenCalledWith('2');
    });
  });
});
