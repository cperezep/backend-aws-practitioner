import * as cdk from 'aws-cdk-lib/core';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { ApiLambda } from '../constructs/api-lambda';
import { DynamoDbTables } from '../constructs/dynamodb-tables';

export class ApiStack extends cdk.Stack {
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
  }
}