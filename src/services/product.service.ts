import { NotFoundError } from '@/common/errors.js';
import type { ProductRepository } from '@/repositories/product.repository.js';

export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async getAll() {
    return this.productRepository.findAll();
  }

  async getById(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) throw new NotFoundError('Product', id);

    return product;
  }
}
