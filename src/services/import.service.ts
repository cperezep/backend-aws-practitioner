import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import csvParser = require('csv-parser');

const s3Client = new S3Client({});

export const generateUploadUrl = async (name: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: process.env.IMPORT_BUCKET_NAME,
    Key: `uploaded/${name}`,
    ContentType: 'text/csv',
  });

  return getSignedUrl(s3Client, command, { expiresIn: 300 });
};

export const parseUploadedFile = async (bucket: string, key: string): Promise<void> => {
  const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!(Body instanceof Readable)) {
    throw new Error('Expected Readable body');
  }

  for await (const row of Body.pipe(csvParser())) {
    // biome-ignore lint/suspicious/noConsole: Intentional logging per spec FR-011/SC-004
    console.log('record', row);
  }

  const parsedKey = key.replace(/^uploaded\//, 'parsed/');

  // Copy original file to "parsed" location before deleting to ensure data isn't lost if copy fails
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: parsedKey,
    }),
  );

  // Delete original file after successful copy
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};
