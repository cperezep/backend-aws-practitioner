import type { CreateProductInput } from '@/common/types';
import type { ProductRepository } from '@/repositories/product.repository';
import { PRODUCTS } from './product.data';

export class InMemoryProductRepository implements ProductRepository {
  async findAll() {
    return PRODUCTS;
  }

  async findById(id: string) {
    return PRODUCTS.find((product) => product.id === id);
  }

  async create(input: CreateProductInput) {
    const product = { id: crypto.randomUUID(), ...input };
    PRODUCTS.push(product);

    return product;
  }
}
