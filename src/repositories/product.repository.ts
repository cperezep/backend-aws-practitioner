import type { CreateProductInput, Product } from '@/common/types';

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | undefined>;
  create(input: CreateProductInput): Promise<Product>;
}
