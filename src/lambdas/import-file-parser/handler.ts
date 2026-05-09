import type { S3Event } from 'aws-lambda';
import { parseUploadedFile } from '@/services/import.service';

export const handler = async (event: S3Event): Promise<void> => {
  // Process each record sequentially to avoid overwhelming S3 with requests if there are many records
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    try {
      await parseUploadedFile(bucket, key);
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: Intentional error logging per spec SC-006
      console.error('parse failed', { bucket, key, err });
    }
  }
};
