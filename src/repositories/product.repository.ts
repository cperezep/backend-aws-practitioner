import type { CreateProductInput, ProductWithStock } from '@/common/types';

export interface ProductRepository {
  findAll(): Promise<ProductWithStock[]>;
  findById(id: string): Promise<ProductWithStock | undefined>;
  create(input: CreateProductInput): Promise<ProductWithStock>;
}
