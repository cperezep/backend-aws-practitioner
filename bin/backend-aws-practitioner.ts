#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib/core';
import { ApiStack } from '../lib/stacks/api-stack';
import { ImportServiceStack } from '../lib/stacks/import-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const apiStack = new ApiStack(app, 'ApiStack', { env });

new ImportServiceStack(app, 'ImportServiceStack', {
  env,
  catalogItemsQueue: apiStack.catalogItemsQueue,
});
