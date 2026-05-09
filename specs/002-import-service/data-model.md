# Data Model: Import Service

This feature is mostly stateless infrastructure plumbing — there is no persistent domain entity introduced. The "data" involved is transient (HTTP payloads, S3 objects in flight, parsed-row log entries). What follows are the contracts of the values that flow between components.

---

## Entities (transient)

### `ImportFileRequest`

Inbound to the signer Lambda.

| Field | Source | Type | Validation | Notes |
|---|---|---|---|---|
| `name` | `event.queryStringParameters.name` | `string` | Required, 1–255 chars, regex `^[A-Za-z0-9._-]+$`, must end with `.csv` (case-insensitive after `.toLowerCase()`) | The basename only. No paths. |

Failure mapping:

| Validation failure | HTTP status | Body |
|---|---|---|
| `name` missing | 400 | `{ "message": "name is required" }` |
| `name` empty | 400 | `{ "message": "name is required" }` |
| `name` not `.csv` | 400 | `{ "message": "name must end with .csv" }` |
| `name` contains forbidden chars | 400 | `{ "message": "name contains invalid characters" }` |

### `SignedUploadUrl`

Outbound from the signer Lambda.

| Field | Type | Description |
|---|---|---|
| (whole body) | `string` | The pre-signed URL itself, returned as a JSON string (i.e., `JSON.stringify(url)`). |

> Returning the URL as a bare JSON string matches the AWS Cloud Practitioner course's reference frontend, which does `await response.json()` and uses the result directly. If we wrap it as `{ url: "..." }`, the FE breaks.

Response headers:

| Header | Value | Source |
|---|---|---|
| `Content-Type` | `application/json` | Middy http response |
| CORS headers | `Access-Control-Allow-Origin: *`, etc. | API Gateway proxy integration via existing CORS config |

### `S3PutObjectIntent` (internal to `import.service.ts`)

What the service hands to `getSignedUrl`.

| Field | Value |
|---|---|
| `Bucket` | `process.env.IMPORT_BUCKET_NAME` |
| `Key` | `` `uploaded/${name}` `` |
| `ContentType` | `'text/csv'` |

Signing options: `{ expiresIn: 300 }`.

### `S3ObjectCreatedEvent` (parser inbound)

Standard `S3Event` from `aws-lambda` types. The parser cares about each `event.Records[i].s3`:

| Field | Used as |
|---|---|
| `s3.bucket.name` | `Bucket` for `GetObjectCommand` |
| `s3.object.key` | `Key` for `GetObjectCommand`. URL-decoded with `decodeURIComponent(key.replace(/\+/g, ' '))` (S3 quirk). |

### `ParsedCsvRecord`

Whatever shape `csv-parser` produces — a plain object keyed by the CSV header row. Schema is **not** validated by this feature.

```ts
type ParsedCsvRecord = Record<string, string>;
```

Per spec FR-011 / SC-004, the parser MUST emit one log entry per record:

```ts
console.log('record', record);
```

---

## Infrastructure resources

These are the CDK-defined resources, listed for clarity (not "data" in the domain sense, but they're what the plan creates):

| Resource | Type | Owner | Notes |
|---|---|---|---|
| `ImportApi` | `apigateway.RestApi` | `ImportServiceStack` | Separate API Gateway for the import domain. CORS: ALL_ORIGINS, ALL_METHODS. |
| `ImportProductsBucket` | `s3.Bucket` | `ImportServiceStack` | Auto-named. CORS: `[PUT]`, origins `*`, headers `*`, expose `ETag`. `removalPolicy: DESTROY` + `autoDeleteObjects: true` for dev. Block public access enabled. |
| `ImportProductsFile` (signer) | `lambda_nodejs.NodejsFunction` via `ApiLambda` | `ImportServiceStack` | `entry: 'import-products-file'`. Method `GET` on resource `/import` of own `ImportApi`. |
| `ImportFileParser` | `lambda_nodejs.NodejsFunction` | `ImportServiceStack` | Direct instantiation. Memory 512 MB, timeout 30 s. |
| Notification | `bucket.addEventNotification` | `ImportServiceStack` | `OBJECT_CREATED` → `LambdaDestination(parserFn)`, filter `prefix: 'uploaded/'`. |
| IAM (signer) | `bucket.grantPut(signer, 'uploaded/*')` | `ImportServiceStack` | Adds `IMPORT_BUCKET_NAME` env var. |
| IAM (parser) | `bucket.grantRead(parser, 'uploaded/*')` + `bucket.grantDelete(parser, 'uploaded/*')` + `bucket.grantPut(parser, 'parsed/*')` | `ImportServiceStack` | Read + delete on source prefix, put on destination prefix for file-move. |

---

## State transitions

```
client                   GET /import        signer Lambda          S3
  | --------- name ---------> |                 |                   |
  |                            | --- validate -->|                   |
  |                            | <-- 400 (bad)   |                   |   (terminal on invalid input)
  |                            |                 |                   |
  |                            | -- presign PUT->|                   |
  |                            |                 | -- presigned url->|   (no actual S3 call yet)
  |                            | <-- url --------|                   |
  | <----- 200 "url" ----------|                 |                   |
  |                                                                   |
  | --------- PUT csv (Content-Type: text/csv) ---------------------->|
  |                                                                   |   (object created at uploaded/<name>)
  |                                                                   |
  |                            S3 OBJECT_CREATED ------------------- parser Lambda
  |                                                                          |
  |                                                                          | -- GetObject --> S3
  |                                                                          | <- Readable -----
  |                                                                          | for-await: console.log(row)
  |                                                                          |
  |                                                                          | -- CopyObject --> S3
  |                                                                          |    uploaded/<name> → parsed/<name>
  |                                                                          | -- DeleteObject --> S3
  |                                                                          |    uploaded/<name> deleted
  |                                                                          | done.
```

No back-channel from parser to client; observability is via CloudWatch logs only (per spec).
After parsing, the file is moved from `uploaded/` to `parsed/` (copy then delete).

---

## Validation rules (consolidated)

| Rule | Where enforced | Reference |
|---|---|---|
| `name` required, non-empty | Zod schema in signer | FR-005 |
| `name` ends with `.csv` (case-insensitive) | Zod schema in signer | FR-006 |
| `name` has no path separators / control chars | Zod regex `^[A-Za-z0-9._-]+$` | FR-007 |
| Object key always begins with `uploaded/` | `import.service.ts` builds key from validated name | FR-002, FR-007 |
| Signed URL TTL ≤ 300 s | `import.service.ts` constant | R-002, FR-004 |
| Signed URL bound to `Content-Type: text/csv` | `PutObjectCommand` field | R-003, FR-003 |
| Parser only reacts to `uploaded/` prefix | `addEventNotification` filter | FR-010 |
| Parser logs one entry per row | `for await` loop in parser handler | FR-011, SC-004 |
| Parser swallows per-file errors (logs, doesn't rethrow) | `try/catch` around the `for await` | FR-012, SC-006 |
| Signer IAM: `s3:PutObject` only on `uploaded/*` | `grantPut(fn, 'uploaded/*')` | FR-013 |
| Parser IAM: `s3:GetObject` only on `uploaded/*` | `grantRead(fn, 'uploaded/*')` | FR-013 |
