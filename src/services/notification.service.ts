import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { ProductWithStock } from '@/common/types';

export class NotificationService {
  private readonly snsClient = new SNSClient({ region: process.env.AWS_REGION });
  private readonly topicArn = process.env.CREATE_PRODUCT_TOPIC_ARN ?? '';

  async notifyProductCreated(product: ProductWithStock): Promise<void> {
    try {
      await this.snsClient.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Subject: 'New product created',
          Message: JSON.stringify(product),
          MessageAttributes: {
            price: {
              DataType: 'Number',
              StringValue: String(product.price),
            },
          },
        }),
      );
    } catch (snsErr) {
      // biome-ignore lint/suspicious/noConsole: SNS publish failure is non-fatal — product already persisted
      console.error('Failed to publish SNS notification', { snsErr });
    }
  }
}
