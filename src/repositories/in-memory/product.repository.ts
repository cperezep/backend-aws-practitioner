import type { ProductRepository } from '@/repositories/product.repository';
import { PRODUCTS } from './product.data.js';

export class InMemoryProductRepository implements ProductRepository {
  async findAll() {
    return PRODUCTS;
  }
  async findById(id: string) {
    return PRODUCTS.find((product) => product.id === id);
  }
}
