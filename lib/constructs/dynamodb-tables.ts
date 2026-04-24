import { RemovalPolicy } from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { IGrantable } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Provisions the two DynamoDB tables required by the Products API:
 *  - `products`  (PK: id)
 *  - `stock`     (PK: product_id)
 *
 * Table names are CDK-generated (unique per stack/environment).
 * Use the `productsTable.tableName` and `stockTable.tableName` properties
 * to pass them as Lambda environment variables.
 */
export class DynamoDbTables extends Construct {
  public readonly productsTable: dynamodb.Table;
  public readonly stockTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.productsTable = new dynamodb.Table(this, 'Products', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.stockTable = new dynamodb.Table(this, 'Stock', {
      partitionKey: { name: 'product_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  /** Grants read + write access on both tables to any IAM principal (e.g. a Lambda role). */
  grantReadWriteData(grantable: IGrantable): void {
    this.productsTable.grantReadWriteData(grantable);
    this.stockTable.grantReadWriteData(grantable);
  }
}
