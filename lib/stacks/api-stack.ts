import * as cdk from 'aws-cdk-lib/core';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { ApiLambda } from '../constructs/api-lambda';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
    new ApiLambda(this, 'GetProducts', {
      entry: 'get-products',
      method: 'GET',
      resource: productsResource,
    });

    // GET /products/{productId}
    const productResource = productsResource.addResource('{productId}');
    new ApiLambda(this, 'GetProduct', {
      entry: 'get-product',
      method: 'GET',
      resource: productResource,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });
  }
}