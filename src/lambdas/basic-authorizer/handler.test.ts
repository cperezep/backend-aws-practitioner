import type { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { handler } from './handler';

const METHOD_ARN = 'mock-api-id.execute-api.mock-region.amazonaws.com/mock-stage/GET/resource';

const buildEvent = (authorizationToken: string | undefined): APIGatewayTokenAuthorizerEvent => ({
  type: 'TOKEN',
  authorizationToken: authorizationToken as string,
  methodArn: METHOD_ARN,
});

type ParsedStatement = { Effect: string; Resource: string; Action: string };
const getStatement = (result: Awaited<ReturnType<typeof handler>>) =>
  result.policyDocument.Statement[0] as ParsedStatement;

const encodeBasic = (username: string, password: string): string =>
  `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

describe('basicAuthorizer handler', () => {
  const VALID_USER = 'mock-username';
  const VALID_PASS = 'mock-password';

  beforeEach(() => {
    process.env[VALID_USER] = VALID_PASS;
  });

  afterEach(() => {
    delete process.env[VALID_USER];
    jest.clearAllMocks();
  });

  describe('401 — Unauthorized (missing or malformed token)', () => {
    it('throws Unauthorized when authorizationToken is missing', async () => {
      await expect(handler(buildEvent(undefined))).rejects.toThrow('Unauthorized');
    });

    it('throws Unauthorized when token has no "Basic " prefix', async () => {
      await expect(handler(buildEvent('Bearer sometoken'))).rejects.toThrow('Unauthorized');
    });

    it('throws Unauthorized when base64 payload has no colon separator', async () => {
      const noColon = `Basic ${Buffer.from('usernamewithoutpassword').toString('base64')}`;
      await expect(handler(buildEvent(noColon))).rejects.toThrow('Unauthorized');
    });
  });

  describe('403 — Deny (invalid credentials)', () => {
    it('returns DENY policy when username does not exist in env vars', async () => {
      const event = buildEvent(encodeBasic('unknownuser', 'somepassword'));
      const result = await handler(event);

      const statement = getStatement(result);
      expect(statement.Effect).toBe('Deny');
      expect(result.principalId).toBe('unknownuser');
      expect(statement.Resource).toBe(METHOD_ARN);
    });

    it('returns DENY policy when password is incorrect', async () => {
      const event = buildEvent(encodeBasic(VALID_USER, 'WRONG_PASSWORD'));
      const result = await handler(event);

      const statement = getStatement(result);
      expect(statement.Effect).toBe('Deny');
      expect(result.principalId).toBe(VALID_USER);
    });
  });

  describe('200 — Allow (valid credentials)', () => {
    it('returns ALLOW policy for valid username and password', async () => {
      const event = buildEvent(encodeBasic(VALID_USER, VALID_PASS));
      const result = await handler(event);

      const statement = getStatement(result);
      expect(statement.Effect).toBe('Allow');
      expect(result.principalId).toBe(VALID_USER);
      expect(statement.Resource).toBe(METHOD_ARN);
    });

    it('returns ALLOW policy when password contains a colon', async () => {
      process.env[VALID_USER] = 'PASS:WITH:COLONS';
      const event = buildEvent(encodeBasic(VALID_USER, 'PASS:WITH:COLONS'));
      const result = await handler(event);

      expect(getStatement(result).Effect).toBe('Allow');
    });
  });
});
