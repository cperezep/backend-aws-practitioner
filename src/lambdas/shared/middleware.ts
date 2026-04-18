import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import type { APIGatewayProxyHandler } from 'aws-lambda';

/**
 * Wraps a Lambda handler with the standard middleware chain.
 * All API-triggered Lambdas should use this wrapper.
 *
 * Middleware order matters:
 * 1. httpEventNormalizer    — normalize path/query params before handler runs
 * 2. httpJsonBodyParser     — parse JSON body string → object (skips GET/no-body requests)
 * 3. httpErrorHandler       — catch errors and format response (runs last on error)
 */
export const withMiddleware = (handler: APIGatewayProxyHandler) =>
  middy(handler)
    .use(httpEventNormalizer())
    .use(httpJsonBodyParser({ disableContentTypeError: true }))
    .use(httpErrorHandler());
