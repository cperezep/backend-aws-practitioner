import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import type { ProductWithStock } from '@/common/types';
import { NotificationService } from './notification.service';

const snsMock = mockClient(SNSClient);

const MOCK_PRODUCT: ProductWithStock = {
  id: '1',
  title: 'AWS CDK in Practice',
  description: 'Learn CDK fundamentals',
  price: 29.99,
  count: 4,
};

describe('NotificationService', () => {
  beforeEach(() => {
    snsMock.reset();
    process.env.CREATE_PRODUCT_TOPIC_ARN = 'mock-topic-arn';
  });

  it('publishes a message to SNS with the correct parameters', async () => {
    snsMock.on(PublishCommand).resolves({ MessageId: 'msg-1' });
    const service = new NotificationService();

    await service.notifyProductCreated(MOCK_PRODUCT);

    const publishCalls = snsMock.commandCalls(PublishCommand);

    expect(publishCalls).toHaveLength(1);
    expect(publishCalls[0].args[0].input).toEqual({
      TopicArn: 'mock-topic-arn',
      Subject: 'New product created',
      Message: JSON.stringify(MOCK_PRODUCT),
      MessageAttributes: {
        price: {
          DataType: 'Number',
          StringValue: String(MOCK_PRODUCT.price),
        },
      },
    });
  });

  it('does not throw when SNS publish fails', async () => {
    snsMock.on(PublishCommand).rejects(new Error('SNS unavailable'));
    const service = new NotificationService();

    await expect(service.notifyProductCreated(MOCK_PRODUCT)).resolves.toBeUndefined();
  });

  it('logs an error when SNS publish fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const snsError = new Error('SNS unavailable');
    snsMock.on(PublishCommand).rejects(snsError);
    const service = new NotificationService();

    await service.notifyProductCreated(MOCK_PRODUCT);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to publish SNS notification', { snsErr: snsError });
    consoleSpy.mockRestore();
  });
});
