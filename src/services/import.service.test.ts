import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { SdkStream } from '@smithy/types';
import { mockClient } from 'aws-sdk-client-mock';
import { generateUploadUrl, parseUploadedFile } from './import.service.js';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const s3Mock = mockClient(S3Client);
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const createReadableStream = (content: string): SdkStream<Readable> => {
  const stream = Readable.from(content) as SdkStream<Readable>;
  stream.transformToByteArray = async () => Buffer.from(content);
  stream.transformToString = async () => content;
  stream.transformToWebStream = () => {
    throw new Error('Not implemented');
  };
  return stream;
};

beforeEach(() => {
  s3Mock.reset();
  mockGetSignedUrl.mockReset();
  process.env.IMPORT_BUCKET_NAME = 'test-import-bucket';
});

describe('ImportService', () => {
  it('calls getSignedUrl with correct PutObjectCommand params', async () => {
    const fakeUrl = 'https://test-bucket.s3.amazonaws.com/uploaded/products.csv?signed';
    mockGetSignedUrl.mockResolvedValue(fakeUrl);

    const result = await generateUploadUrl('products.csv');

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

    const [client, command, options] = mockGetSignedUrl.mock.calls[0];
    expect(client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: 'test-import-bucket',
      Key: 'uploaded/products.csv',
      ContentType: 'text/csv',
    });
    expect(options).toEqual({ expiresIn: 300 });
    expect(result).toBe(fakeUrl);
  });
});

describe('parseUploadedFile', () => {
  it('logs each CSV row via console.log', async () => {
    const csv = 'id,title\np1,Widget\np2,Gadget\n';
    s3Mock.on(GetObjectCommand).resolves({
      Body: createReadableStream(csv),
    });
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    await parseUploadedFile('test-import-bucket', 'uploaded/products.csv');

    expect(s3Mock.commandCalls(GetObjectCommand)[0].args[0].input).toEqual({
      Bucket: 'test-import-bucket',
      Key: 'uploaded/products.csv',
    });

    const recordLogs = logSpy.mock.calls.filter(([first]) => first === 'record');
    expect(recordLogs).toHaveLength(2);
    expect(recordLogs[0][1]).toEqual({ id: 'p1', title: 'Widget' });
    expect(recordLogs[1][1]).toEqual({ id: 'p2', title: 'Gadget' });

    logSpy.mockRestore();
  });

  it('moves file from uploaded/ to parsed/ after parsing', async () => {
    const csv = 'id,title\np1,Widget\n';
    s3Mock.on(GetObjectCommand).resolves({
      Body: createReadableStream(csv),
    });
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    await parseUploadedFile('test-import-bucket', 'uploaded/products.csv');

    const copyCalls = s3Mock.commandCalls(CopyObjectCommand);
    expect(copyCalls).toHaveLength(1);
    expect(copyCalls[0].args[0].input).toEqual({
      Bucket: 'test-import-bucket',
      CopySource: 'test-import-bucket/uploaded/products.csv',
      Key: 'parsed/products.csv',
    });

    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args[0].input).toEqual({
      Bucket: 'test-import-bucket',
      Key: 'uploaded/products.csv',
    });

    logSpy.mockRestore();
  });

  it('throws when Body is not a Readable', async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: undefined });

    await expect(parseUploadedFile('test-import-bucket', 'uploaded/test.csv')).rejects.toThrow(
      'Expected Readable body',
    );
  });
});
