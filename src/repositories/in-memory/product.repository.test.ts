import { PRODUCTS, STOCK } from './product.data';
import { InMemoryProductRepository } from './product.repository';

describe('InMemoryProductRepository', () => {
  let repository: InMemoryProductRepository;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
  });

  describe('findAll', () => {
    it('returns all products with stock counts', async () => {
      const result = await repository.findAll();
      const expected = PRODUCTS.map((p) => ({
        ...p,
        count: STOCK.find((s) => s.product_id === p.id)?.count ?? 0,
      }));

      expect(result).toEqual(expected);
      expect(result).toHaveLength(PRODUCTS.length);
    });
  });

  describe('findById', () => {
    it('returns the product with stock count when the id exists', async () => {
      const [firstProduct] = PRODUCTS;
      const result = await repository.findById(firstProduct.id);
      const expectedCount = STOCK.find((s) => s.product_id === firstProduct.id)?.count ?? 0;

      expect(result).toEqual({ ...firstProduct, count: expectedCount });
    });

    it('returns undefined when the id does not exist', async () => {
      const result = await repository.findById('999');

      expect(result).toBeUndefined();
    });
  });
});
