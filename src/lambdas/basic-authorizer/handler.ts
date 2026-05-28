import type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

type PolicyEffect = 'Allow' | 'Deny';

const buildPolicy = (principalId: string, effect: PolicyEffect, resource: string): APIGatewayAuthorizerResult => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource }],
  },
});

const parseBasicToken = (token: string): { username: string; password: string } | null => {
  if (!token.startsWith('Basic ')) return null;

  const encoded = token.slice('Basic '.length);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const colonIndex = decoded.indexOf(':');

  if (colonIndex === -1) return null;

  return {
    username: decoded.substring(0, colonIndex),
    password: decoded.substring(colonIndex + 1),
  };
};

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  const { authorizationToken, methodArn } = event;

  if (!authorizationToken) {
    throw new Error('Unauthorized');
  }

  const credentials = parseBasicToken(authorizationToken);

  if (!credentials) {
    throw new Error('Unauthorized');
  }

  const { username, password } = credentials;
  const storedPassword = process.env[username];

  if (!storedPassword || storedPassword !== password) {
    return buildPolicy(username, 'Deny', methodArn);
  }

  return buildPolicy(username, 'Allow', methodArn);
};
