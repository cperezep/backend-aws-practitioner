import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaRuntime from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib/core';
import * as path from 'path';

export interface ApiLambdaProps {
  /** Folder name inside src/lambdas/ e.g. 'get-products' */
  entry: string;
  /** HTTP method for the route e.g. 'GET' */
  method: string;
  /** API Gateway resource to attach this method to */
  resource: apigateway.IResource;
  /** Environment variables injected into the Lambda function at runtime */
  environment?: Record<string, string>;
  /** Optional Lambda authorizer to protect this route */
  authorizer?: apigateway.IAuthorizer;
}

export class ApiLambda extends Construct {
  public readonly handler: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiLambdaProps) {
    super(scope, id);

    this.handler = new lambda.NodejsFunction(this, 'Handler', {
      entry: path.join(
        process.cwd(), 'src', 'lambdas', props.entry, 'handler.ts',
      ),
      handler: 'handler',
      runtime: lambdaRuntime.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: props.environment,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    props.resource.addMethod(
      props.method,
      new apigateway.LambdaIntegration(this.handler, { proxy: true }),
      props.authorizer
        ? {
            authorizationType: apigateway.AuthorizationType.CUSTOM,
            authorizer: props.authorizer,
          }
        : undefined,
    );
  }
}