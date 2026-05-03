import { NotFoundError } from '@/common/errors';
import type { CreateProductInput } from '@/common/types';
import type { ProductRepository } from '@/repositories/product.repository';

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

  async create(input: CreateProductInput) {
    return this.productRepository.create(input);
  }
}
