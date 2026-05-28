import * as cdk from 'aws-cdk-lib/core';
import { Duration } from 'aws-cdk-lib/core';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaRuntime from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import * as path from 'path';
import { ApiLambda } from '../constructs/api-lambda';
import { DynamoDbTables } from '../constructs/dynamodb-tables';

export class ApiStack extends cdk.Stack {
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tables = new DynamoDbTables(this, 'Tables');

    const tableEnv = {
      PRODUCTS_TABLE_NAME: tables.productsTable.tableName,
      STOCK_TABLE_NAME: tables.stockTable.tableName,
    };

    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'Products API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // GET /products
    const productsResource = api.root.addResource('products');
    const getProducts = new ApiLambda(this, 'GetProducts', {
      entry: 'get-products',
      method: 'GET',
      resource: productsResource,
      environment: tableEnv,
    });
    tables.grantReadWriteData(getProducts.handler);

    // POST /products
    const createProduct = new ApiLambda(this, 'CreateProduct', {
      entry: 'create-product',
      method: 'POST',
      resource: productsResource,
      environment: tableEnv,
    });
    tables.grantReadWriteData(createProduct.handler);

    // GET /products/{productId}
    const productResource = productsResource.addResource('{productId}');
    const getProduct = new ApiLambda(this, 'GetProduct', {
      entry: 'get-product',
      method: 'GET',
      resource: productResource,
      environment: tableEnv,
    });
    tables.grantReadWriteData(getProduct.handler);

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'ProductsTableName', {
      value: tables.productsTable.tableName,
      description: 'DynamoDB products table name',
    });

    new cdk.CfnOutput(this, 'StockTableName', {
      value: tables.stockTable.tableName,
      description: 'DynamoDB stock table name',
    });

    // SQS queue for batch product creation
    this.catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      visibilityTimeout: Duration.seconds(180),
    });

    const catalogBatchProcess = new lambda.NodejsFunction(this, 'CatalogBatchProcess', {
      entry: path.join(process.cwd(), 'src', 'lambdas', 'catalog-batch-process', 'handler.ts'),
      handler: 'handler',
      runtime: lambdaRuntime.Runtime.NODEJS_24_X,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: tableEnv,
      bundling: { minify: true, sourceMap: true },
    });

    tables.grantReadWriteData(catalogBatchProcess);

    catalogBatchProcess.addEventSource(new SqsEventSource(this.catalogItemsQueue, {
      batchSize: 5,
      reportBatchItemFailures: true,
    }));

    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: this.catalogItemsQueue.queueUrl,
      description: 'SQS queue URL for catalog batch product creation',
    });

    // SNS topic — notifies on every successful product creation
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
      displayName: 'Product Creation Notifications',
    });

    const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
    const opsEmail = process.env.NOTIFY_OPS_EMAIL;
    const highValueThreshold = Number(process.env.NOTIFY_HIGH_VALUE_PRICE_THRESHOLD ?? '100');

    if (!adminEmail || !opsEmail) {
      throw new Error('NOTIFY_ADMIN_EMAIL and NOTIFY_OPS_EMAIL must be set in .env');
    }

    // Primary subscription: receives ALL product-created events (no filter)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(adminEmail),
    );

    // Secondary subscription: receives only high-value products (price >= threshold)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(opsEmail, {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({ greaterThanOrEqualTo: highValueThreshold }),
        },
      }),
    );

    createProductTopic.grantPublish(catalogBatchProcess);
    catalogBatchProcess.addEnvironment('CREATE_PRODUCT_TOPIC_ARN', createProductTopic.topicArn);

    new cdk.CfnOutput(this, 'CreateProductTopicArn', {
      value: createProductTopic.topicArn,
      description: 'SNS topic ARN for product creation notifications',
    });
  }
}