# Phase 0 Research: Import Service

All open questions raised during plan drafting are resolved here. No `NEEDS CLARIFICATION` markers remain.

---

## R-001 — Pre-signed URL: PUT vs. POST policy

**Decision**: Use `PutObjectCommand` + `getSignedUrl` from `@aws-sdk/s3-request-presigner` to issue a single-method **PUT** signed URL.

**Rationale**:
- Single object, single key, single content type → PUT is the simplest and most widely supported pattern in browsers (`fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': 'text/csv' }})`).
- POST policy (browser form upload) is more flexible (size limits, key prefix matching) but adds complexity (multipart form data, policy JSON, signature v4 form fields) we don't need for an admin-only flow with a known file name.
- The `s3-request-presigner` package is the AWS-recommended SDK v3 path; the old `s3.getSignedUrlPromise` from SDK v2 is irrelevant here.

**Alternatives considered**:
- **POST policy form upload** — rejected: more code in both Lambda and FE for no current gain.
- **Direct `PutObject` from Lambda after FE uploads through API Gateway** — rejected by spec ("no file bytes flow through the application backend"); also blocked by API Gateway 10 MB request limit.

---

## R-002 — Pre-signed URL TTL

**Decision**: 300 seconds (5 minutes), passed as `{ expiresIn: 300 }` to `getSignedUrl`.

**Rationale**: Long enough that a user can click "upload" and complete a typical CSV upload over residential bandwidth; short enough that a leaked URL window is small. Matches industry default for direct-upload patterns (S3 console default is 15 min; 5 min is the conservative end of "still usable").

**Alternatives considered**:
- **60 s** — too aggressive; users on slow links may fail.
- **3600 s (1 h)** — unnecessarily wide replay window.
- **Caller-configurable via query param** — premature flexibility; adds attack surface (DoS via huge `expiresIn`).

---

## R-003 — Content-Type binding to the signature

**Decision**: Pass `ContentType: 'text/csv'` into the `PutObjectCommand` when generating the signed URL. The browser MUST send the same `Content-Type: text/csv` header on the PUT.

**Rationale**: Pre-signed URLs sign the headers that were present on the underlying command. If the browser sends a different `Content-Type` than what was signed, S3 returns `SignatureDoesNotMatch`. Binding the content type prevents accidentally accepting non-CSV uploads under a CSV key (cheap weak validation).

**Alternatives considered**:
- **Don't sign Content-Type** — works, but loses the integrity hint.
- **Sign Content-Length** — would require knowing the exact size at sign time; we don't.

---

## R-004 — S3 client lifecycle in Lambda

**Decision**: Module-scope singleton `s3Client = new S3Client({})` instantiated outside the handler. Region picked up automatically from the Lambda execution environment (`AWS_REGION`).

**Rationale**: Reuses the underlying HTTP connection pool across invocations on the same warm container; avoids per-invocation TLS handshake. Standard AWS SDK v3 best practice.

**Alternatives considered**:
- **Per-invocation client** — rejected: cold/warm performance penalty.
- **Pass region explicitly** — unnecessary; Lambda always sets `AWS_REGION`.

---

## R-005 — CSV streaming pattern (parser Lambda)

**Decision**: `GetObjectCommand` → `response.Body` is a Node.js `Readable` (in the Lambda runtime). Pipe it through `csvParser()` and consume rows via `for await (const record of stream)`. Log each record with `console.log` (CloudWatch).

**Rationale**:
- `for await` keeps the function's memory footprint ~constant in file size.
- `csv-parser` is a `Transform` stream; native `pipe()` + async iteration is idiomatic and survives back-pressure.
- `console.log` is the canonical CloudWatch sink; no extra logger dependency needed for this feature.

**Reference shape**:

```ts
const { Body } = await s3.send(new GetObjectCommand({ Bucket, Key }));
if (!(Body instanceof Readable)) throw new Error('Expected Readable body');
for await (const row of Body.pipe(csvParser())) {
  console.log('record', row);
}
```

**Alternatives considered**:
- **`Body.transformToString()` then parse** — rejected: loads entire file in memory.
- **`stream.pipeline` with promisify** — works but more verbose than `for await`.
- **Custom logger (pino, etc.)** — premature; constitution V (operational simplicity).

---

## R-006 — S3 → Lambda event wiring

**Decision**: `bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(parserFn), { prefix: 'uploaded/' })` from `aws-cdk-lib/aws-s3` + `aws-cdk-lib/aws-s3-notifications`.

**Rationale**: Native S3 → Lambda push integration (no SQS/SNS in between). Prefix filter keeps the parser oblivious to any other prefix (e.g., a future `parsed/` prefix won't re-trigger it).

**Alternatives considered**:
- **EventBridge rule on S3 events** — useful for fan-out across multiple consumers; overkill for one consumer.
- **S3 → SQS → Lambda** — adds buffering/retry decoupling but also operational surface; not justified at current scale.

---

## R-007 — IAM scoping

**Decision**:
- Signer Lambda: `bucket.grantPut(signerFn, 'uploaded/*')`
- Parser Lambda: `bucket.grantRead(parserFn, 'uploaded/*')` + `bucket.grantDelete(parserFn, 'uploaded/*')` + `bucket.grantPut(parserFn, 'parsed/*')`

`bucket.grantPut` / `grantRead` / `grantDelete` accept an `objectsKeyPattern` second argument and emit a policy whose `Resource` is the bucket ARN suffixed with the prefix.

**Rationale**: Constitution V + explicit spec FR-013. Parser needs read+delete on `uploaded/*` to fetch and remove the original file, and put on `parsed/*` to copy it to the destination. Avoid `grantReadWrite` which inadvertently grants full-bucket access.

**Alternatives considered**:
- **Custom inline policy statements** — verbose duplication of what `grant*` already produces.
- **`grantReadWrite`** — violates least privilege.

---

## R-008 — ~~Cross-stack API Gateway sharing~~ Separate API Gateways

**Decision (REVISED)**: Each stack owns its own API Gateway. `ImportServiceStack` creates a `RestApi` named `ImportApi`. No cross-stack references.

```ts
// bin/backend-aws-practitioner.ts
new ApiStack(app, 'ApiStack', { env });
new ImportServiceStack(app, 'ImportServiceStack', { env });
```

**Rationale**: Hard requirement from the course/assignment mandate. Each service domain gets its own API Gateway.

**Trade-offs**:
- Frontend needs two separate base URLs.
- CORS and throttling configured independently per gateway.
- Stacks are fully independent — can be deployed/destroyed in any order.

---

## R-009 — `ApiLambda` reuse vs. inlining `NodejsFunction` for the signer

**Decision**: Reuse `lib/constructs/api-lambda.ts` for `GET /import`. No changes to the construct.

**Rationale**: The construct already covers exactly this case (NodejsFunction + API Gateway method + integration). Reusing it preserves consistency with the three product endpoints and keeps the new stack code small.

**Alternatives considered**:
- **Inline `NodejsFunction` + `addMethod`** — duplicates the construct's logic.
- **Generalize the construct** — no new requirement justifies a refactor.

---

## R-010 — Parser Lambda construct

**Decision**: Instantiate `aws_lambda_nodejs.NodejsFunction` directly inside `ImportServiceStack`. **Do not** introduce a new `EventLambda` construct.

**Rationale**: Constitution V — only one event-driven Lambda exists today. Premature abstraction is worse than the duplication of ~10 lines of `NodejsFunction` setup. Extract a construct when the *second* such Lambda appears.

**Alternatives considered**:
- **Force-fit `ApiLambda`** — rejected; coupling an API integration to an S3 trigger pollutes the construct's contract.

---

## R-011 — Bucket CORS

**Decision**: Configure bucket CORS with:
- `allowedMethods`: `[s3.HttpMethods.PUT]`
- `allowedOrigins`: `['*']` for now (matches existing API Gateway `Cors.ALL_ORIGINS`).
- `allowedHeaders`: `['*']`
- `exposedHeaders`: `['ETag']` (so the FE can read the upload's ETag if needed).

**Rationale**: The browser's pre-flight to S3 (triggered by setting a non-simple header like `Content-Type: text/csv`) will fail without bucket-level CORS. Matches the existing API CORS posture; tighten later when a real FE origin is known.

**Alternatives considered**:
- **No bucket CORS** — uploads from a browser will fail with a CORS error before S3 even sees the PUT.

---

## R-012 — `uploaded/` "folder" creation

**Decision**: Do **not** create a placeholder zero-byte object. The prefix exists implicitly the moment the first object is uploaded under it.

**Rationale**: S3 has no real folders; placeholder objects are visual sugar for the AWS console only and add a (tiny) maintenance / IaC ownership concern.

**Alternatives considered**:
- **`BucketDeployment` of a placeholder file** — adds a custom resource, a bundled Lambda, and noise in CloudFormation for zero functional benefit.

---

## R-013 — Parser timeout & memory

**Decision**: `timeout: Duration.seconds(30)`, `memorySize: 512` (one step up from the API Lambda default).

**Rationale**:
- Streaming throughput in Node.js scales sub-linearly with memory (which also scales CPU). 512 MB is a known sweet spot for I/O + light parsing workloads.
- 30 s comfortably covers ~100 MB CSVs at typical rates while staying well below the 15 min Lambda ceiling.

**Alternatives considered**:
- **Default 256 MB / 10 s** — risky for files near the 100 MB scope cap.
- **2048 MB / 5 min** — over-provisioned for current scope.

---

## R-014 — Bundling `csv-parser`

**Decision**: Let esbuild bundle `csv-parser` normally. Do not list it in `nodeModules` / `bundling.externalModules`.

**Rationale**: `csv-parser` is pure JS with no native bindings. Bundling avoids an extra `node_modules` layer.

**Verification step**: After first `cdk synth`, confirm Lambda bundle size is reasonable (< 1 MB expected).

---

## R-015 — Test doubles for S3

**Decision**: Add `aws-sdk-client-mock` as a dev dependency. Use `mockClient(S3Client)` in tests.

**Rationale**: Official-pattern mock for AWS SDK v3 client. Avoids the need to inject a custom interface around the SDK; tests stay close to production wiring.

**Alternatives considered**:
- **Hand-rolled fake client** — works but duplicates what `aws-sdk-client-mock` already does well.
- **Integration test against MinIO/LocalStack** — overkill for unit tests; useful in a future e2e layer (out of scope).

---

## R-016 — Filename validation rules

**Decision**: Zod schema for the `name` query parameter:

```ts
z.string()
  .min(1, 'name is required')
  .max(255)
  .regex(/^[A-Za-z0-9._-]+$/, 'name contains invalid characters')
  .endsWith('.csv', 'name must end with .csv');
```

This excludes `/`, `\`, whitespace, `..`, and any unicode/path-traversal escapes.

**Rationale**: Spec FR-007 (no escaping the `uploaded/` prefix). Whitelisting is safer than blacklisting. ASCII-only file names are an acceptable constraint for an admin tool ingesting catalog data.

**Alternatives considered**:
- **`path.basename()`-based sanitization** — silently mutates user input; harder to debug.
- **Allow any UTF-8** — opens encoding/normalization edge cases (`é` vs. `é`) we don't need.

---

## Summary — all unknowns resolved

| Topic | Resolution |
|---|---|
| Signed URL flavor | PUT, SDK v3 presigner |
| TTL | 300 s |
| Content-Type | Signed as `text/csv`, FE must match |
| S3 client | Module-scope singleton |
| CSV streaming | `for await` over `Body.pipe(csvParser())` |
| S3 → Lambda wiring | `addEventNotification` with `prefix: 'uploaded/'` |
| IAM | `grantPut`/`grantRead`/`grantDelete` with prefix scoping |
| Cross-stack API | Separate API Gateways (no cross-stack reference) |
| Signer construct | Reuse `ApiLambda` |
| Parser construct | Inline `NodejsFunction` |
| Bucket CORS | PUT, `*` origins, `ETag` exposed |
| `uploaded/` placeholder | None |
| Parser limits | 512 MB / 30 s |
| Bundling | Default esbuild |
| S3 test mock | `aws-sdk-client-mock` |
| Filename validation | Zod whitelist regex + `.csv` suffix |
