import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { parseSchema } from '@/lambdas/shared/parse-schema';
import { DynamoDbProductRepository } from '@/repositories/dynamodb/product.repository';
import { ProductService } from '@/services/product.service';
import { ProductSchema } from '../shared/product.schema';

const productService = new ProductService(new DynamoDbProductRepository());

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const input = parseSchema(ProductSchema, body);

      await productService.create(input);
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: Intentional error logging for failed SQS records
      console.error('Failed to process SQS record', { messageId: record.messageId, err });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
