# Parser Lambda input contract: S3 ObjectCreated event

The parser Lambda has no HTTP contract; its "API" is the AWS-defined `S3Event`
payload delivered by S3 → Lambda push notification.

## Trigger configuration (CDK)

```ts
bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(parserFn),
  { prefix: 'uploaded/' },
);
```

Effect: any of `ObjectCreated:Put`, `ObjectCreated:Post`,
`ObjectCreated:Copy`, `ObjectCreated:CompleteMultipartUpload` whose object
key starts with `uploaded/` will invoke the parser. Other prefixes are
ignored at the source.

## Event shape (relevant subset)

`event: S3Event` (from `aws-lambda` types):

```jsonc
{
  "Records": [
    {
      "eventVersion": "2.1",
      "eventSource": "aws:s3",
      "awsRegion": "eu-west-1",
      "eventTime": "2026-04-30T12:34:56.000Z",
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": {
          "name": "importservicestack-importproductsbucketabcdef-xyz",
          "arn":  "arn:aws:s3:::importservicestack-importproductsbucketabcdef-xyz"
        },
        "object": {
          "key": "uploaded/products.csv",
          "size": 12345,
          "eTag": "..."
        }
      }
    }
    // ... possibly more records (one event can batch several objects)
  ]
}
```

## Parser obligations

For each record:

1. Extract `bucket = record.s3.bucket.name` and
   `key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))`.
   (S3 URL-encodes spaces and special chars in keys.)
2. Call `importService.parseUploadedFile(bucket, key)` which:
   a. Issues `GetObjectCommand({ Bucket: bucket, Key: key })`.
   b. Treats `response.Body` as a Node `Readable`. Pipes through `csvParser()`.
   c. Iterates via `for await (const row of stream)` and `console.log('record', row)`.
   d. Copies the file from `uploaded/<name>` to `parsed/<name>` via `CopyObjectCommand`.
   e. Deletes the original from `uploaded/<name>` via `DeleteObjectCommand`.
3. Wrap each record's work in `try/catch`; on error, `console.error('parse failed', { bucket, key, err })` and continue to the next record. Do not rethrow — that would cause Lambda to retry the entire batch.

## Return value

`Promise<void>`. Lambda's success/failure to S3 is determined by promise resolution; we always resolve so S3 does not retry.

## What this Lambda does NOT do (out of scope)

- Persist rows to DynamoDB.
- Validate CSV column schema.
- Notify any downstream consumer (no SQS, no SNS).
