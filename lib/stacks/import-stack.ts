import * as cdk from 'aws-cdk-lib/core';
import { Duration } from 'aws-cdk-lib/core';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';
import { ApiLambda } from '../constructs/api-lambda';

export interface ImportServiceStackProps extends cdk.StackProps {
  catalogItemsQueue: sqs.IQueue;
  authorizerFn: lambda.IFunction;
}

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      description: 'Import API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // When the Lambda authorizer rejects a request, API Gateway generates the
    // 401/403 response itself — before the Lambda runs — so no CORS headers are
    // added. The browser then blocks the response (JS sees status: 0).
    // Gateway Responses fix this by injecting the header at the API GW level.
    api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: { 'Access-Control-Allow-Origin': "'*'" },
    });

    api.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: { 'Access-Control-Allow-Origin': "'*'" },
    });

    const bucket = new s3.Bucket(this, 'ImportProductsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
    });

    const authorizerRole = new iam.Role(this, 'ApiGwAuthorizerRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    const authorizer = new apigateway.TokenAuthorizer(this, 'BasicAuthorizer', {
      handler: props.authorizerFn,
      assumeRole: authorizerRole,
      resultsCacheTtl: Duration.seconds(0),
    });

    const importResource = api.root.addResource('import');
    const signer = new ApiLambda(this, 'ImportProductsFile', {
      entry: 'import-products-file',
      method: 'GET',
      resource: importResource,
      environment: {
        IMPORT_BUCKET_NAME: bucket.bucketName,
      },
      authorizer,
    });

    bucket.grantPut(signer.handler, 'uploaded/*');

    const parserFn = new lambda_nodejs.NodejsFunction(this, 'ImportFileParser', {
      entry: path.join(process.cwd(), 'src', 'lambdas', 'import-file-parser', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      environment: {
        IMPORT_BUCKET_NAME: bucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(parserFn),
      { prefix: 'uploaded/' },
    );

    bucket.grantRead(parserFn, 'uploaded/*');
    bucket.grantDelete(parserFn, 'uploaded/*');
    bucket.grantPut(parserFn, 'parsed/*');
    props.catalogItemsQueue.grantSendMessages(parserFn);

    new cdk.CfnOutput(this, 'ImportApiUrl', {
      value: api.url,
      description: 'Import API Gateway endpoint URL',
    });
  }
}
