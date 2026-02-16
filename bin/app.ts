#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EdgeStack } from '../lib/edge-stack';

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
if (!account) {
  throw new Error("Account is not set. Set AWS_ACCOUNT_ID in the shell, or ensure CDK_DEFAULT_ACCOUNT is present.");
}

new EdgeStack(app, 'WafCfLambdaStackUsEast1', {
  env: { account, region: 'us-east-1' },
});
