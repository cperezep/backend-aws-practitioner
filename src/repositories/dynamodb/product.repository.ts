import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { CreateProductInput, ProductWithStock } from '@/common/types';
import type { ProductRepository } from '@/repositories/product.repository';

export class DynamoDbProductRepository implements ProductRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly productsTable: string;
  private readonly stockTable: string;

  constructor() {
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.productsTable = process.env.PRODUCTS_TABLE_NAME ?? '';
    this.stockTable = process.env.STOCK_TABLE_NAME ?? '';
  }

  async findAll(): Promise<ProductWithStock[]> {
    const [{ Items: products = [] }, { Items: stocks = [] }] = await Promise.all([
      this.client.send(new ScanCommand({ TableName: this.productsTable })),
      this.client.send(new ScanCommand({ TableName: this.stockTable })),
    ]);

    const stockByProductId = new Map(stocks.map((s) => [s.product_id as string, s.count as number]));

    return products.map((item) => ({
      id: item.id as string,
      title: item.title as string,
      description: item.description as string | undefined,
      price: item.price as number,
      count: stockByProductId.get(item.id as string) ?? 0,
    }));
  }

  async findById(id: string): Promise<ProductWithStock | undefined> {
    const [{ Item: product }, { Item: stock }] = await Promise.all([
      this.client.send(new GetCommand({ TableName: this.productsTable, Key: { id } })),
      this.client.send(new GetCommand({ TableName: this.stockTable, Key: { product_id: id } })),
    ]);

    if (!product) return undefined;

    return {
      id: product.id as string,
      title: product.title as string,
      description: product.description as string | undefined,
      price: product.price as number,
      count: (stock?.count as number) ?? 0,
    };
  }

  async create({ title, description, price, count }: CreateProductInput): Promise<ProductWithStock> {
    const id = crypto.randomUUID();

    const item: Record<string, unknown> = { id, title, price };
    if (description !== undefined) item.description = description;

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.productsTable, Item: item } },
          { Put: { TableName: this.stockTable, Item: { product_id: id, count } } },
        ],
      }),
    );

    return { id, title, description, price, count };
  }
}
