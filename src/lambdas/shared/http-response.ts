import type { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export const ok = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

export const created = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 201,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});
