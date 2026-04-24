import type { CreateProductInput, ProductWithStock } from '@/common/types';
import type { ProductRepository } from '@/repositories/product.repository';
import { PRODUCTS, STOCK } from './product.data';

export class InMemoryProductRepository implements ProductRepository {
  async findAll(): Promise<ProductWithStock[]> {
    return PRODUCTS.map((product) => ({
      ...product,
      count: STOCK.find((s) => s.product_id === product.id)?.count ?? 0,
    }));
  }

  async findById(id: string): Promise<ProductWithStock | undefined> {
    const product = PRODUCTS.find((p) => p.id === id);

    if (!product) return undefined;

    return {
      ...product,
      count: STOCK.find((s) => s.product_id === id)?.count ?? 0,
    };
  }

  async create(input: CreateProductInput): Promise<ProductWithStock> {
    const product = { id: crypto.randomUUID(), ...input };
    PRODUCTS.push(product);
    STOCK.push({ product_id: product.id, count: 0 });

    return { ...product, count: 0 };
  }
}
