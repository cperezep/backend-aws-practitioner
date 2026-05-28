import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaRuntime from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as path from 'path';

export class AuthStack extends cdk.Stack {
  public readonly basicAuthorizerFn: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.basicAuthorizerFn = new lambda.NodejsFunction(this, 'BasicAuthorizer', {
      entry: path.join(process.cwd(), 'src', 'lambdas', 'basic-authorizer', 'handler.ts'),
      handler: 'handler',
      runtime: lambdaRuntime.Runtime.NODEJS_24_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        [process.env.USER_GITHUB!]: process.env.USER_PASSWORD!,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });
  }
}
