import type { S3Event, S3EventRecord } from 'aws-lambda';
import { parseUploadedFile } from '@/services/import.service';

jest.mock('@/services/import.service', () => ({
  parseUploadedFile: jest.fn(),
}));

const mockParseUploadedFile = parseUploadedFile as jest.MockedFunction<typeof parseUploadedFile>;

import { handler } from './handler';

beforeEach(() => {
  jest.clearAllMocks();
});

const buildS3Event = (...keys: string[]): S3Event => ({
  Records: keys.map(
    (key) =>
      ({
        s3: {
          bucket: { name: 'test-import-bucket' },
          object: { key },
        },
      }) as unknown as S3EventRecord,
  ),
});

describe('import-file-parser handler', () => {
  it('calls parseUploadedFile for each record', async () => {
    mockParseUploadedFile.mockResolvedValue(undefined);

    await handler(buildS3Event('uploaded/file1.csv', 'uploaded/file2.csv'));

    expect(mockParseUploadedFile).toHaveBeenCalledTimes(2);
    expect(mockParseUploadedFile).toHaveBeenCalledWith('test-import-bucket', 'uploaded/file1.csv');
    expect(mockParseUploadedFile).toHaveBeenCalledWith('test-import-bucket', 'uploaded/file2.csv');
  });

  it('decodes URL-encoded keys', async () => {
    mockParseUploadedFile.mockResolvedValue(undefined);

    await handler(buildS3Event('uploaded/my+file+%281%29.csv'));

    expect(mockParseUploadedFile).toHaveBeenCalledWith('test-import-bucket', 'uploaded/my file (1).csv');
  });

  it('logs error and continues on failure', async () => {
    mockParseUploadedFile.mockRejectedValueOnce(new Error('parse error')).mockResolvedValueOnce(undefined);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(handler(buildS3Event('uploaded/bad.csv', 'uploaded/good.csv'))).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      'parse failed',
      expect.objectContaining({
        bucket: 'test-import-bucket',
        key: 'uploaded/bad.csv',
      }),
    );
    expect(mockParseUploadedFile).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });
});
