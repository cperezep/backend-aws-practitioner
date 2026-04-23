import { PRODUCTS } from './product.data';
import { InMemoryProductRepository } from './product.repository';

describe('InMemoryProductRepository', () => {
  let repository: InMemoryProductRepository;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
  });

  describe('findAll', () => {
    it('returns all products', async () => {
      const result = await repository.findAll();

      expect(result).toEqual(PRODUCTS);
      expect(result).toHaveLength(PRODUCTS.length);
    });
  });

  describe('findById', () => {
    it('returns the product when the id exists', async () => {
      const [firstProduct] = PRODUCTS;
      const result = await repository.findById(firstProduct.id);

      expect(result).toEqual(firstProduct);
    });

    it('returns undefined when the id does not exist', async () => {
      const result = await repository.findById('999');

      expect(result).toBeUndefined();
    });
  });
});
