# Implementation Plan: Import Service

**Branch**: `task-5` | **Date**: 2026-04-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-import-service/spec.md`

## Summary

Add a second business domain — **Import Service** — to the backend that lets the admin UI upload product CSV files **directly to S3 via pre-signed URLs** and then **automatically parses** each uploaded file row by row to CloudWatch logs.

Technical approach:

1. New stack `ImportServiceStack` that owns a dedicated S3 bucket, its own API Gateway, the signing Lambda, and the parser Lambda. Deployed alongside (not inside) the existing `ApiStack`.
2. **Separate API Gateways**: `ImportServiceStack` creates its own `RestApi` (`ImportApi`). No cross-stack reference. Two independent base URLs (one for products, one for import).
3. Reuse the existing `ApiLambda` construct for `GET /import`. The S3-event-driven parser is *not* an API Lambda — wired with `NodejsFunction` + `bucket.addEventNotification(OBJECT_CREATED, LambdaDestination, { prefix: 'uploaded/' })`.
4. Hexagonal split kept: `handler → service → AWS SDK`. Both signed URL generation and CSV parsing/file-move logic live in `import.service.ts` with the S3 client as a module-scope singleton for testability (`aws-sdk-client-mock`).
5. IAM least privilege: `s3:PutObject` on `arn:.../uploaded/*` for the signer; `s3:GetObject` + `s3:DeleteObject` on `arn:.../uploaded/*` and `s3:PutObject` on `arn:.../parsed/*` for the parser. No `grantReadWrite` on the whole bucket.
6. After parsing, the file is **moved** from `uploaded/` to `parsed/` (copy then delete) to signal processing completion.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20.x (Lambda runtime)

**Primary Dependencies (new)**:
- `@aws-sdk/client-s3` v3 — S3 client (`PutObjectCommand`, `GetObjectCommand`)
- `@aws-sdk/s3-request-presigner` v3 — `getSignedUrl` for `PutObjectCommand`
- `csv-parser` ^3 — streaming CSV → object transform
- `aws-sdk-client-mock` (dev) — mock S3 client at SDK boundary in unit tests

**Primary Dependencies (existing, reused)**:
- `aws-cdk-lib` v2, `constructs` v10
- `@middy/core` + standard chain (for the API Lambda)
- `zod` v4 — query string validation
- `aws-lambda` types — `APIGatewayProxyEvent`, `APIGatewayProxyResult`, `S3Event`, `S3EventRecord`

**Dev tooling (existing, reused)**: `jest` v30 + `ts-jest`, `@biomejs/biome` v2, `esbuild` (via `aws-cdk-lib/aws-lambda-nodejs`).

**Storage**:
- S3 bucket (new). `bucketName` left auto-generated to keep the stack destroyable.
- No DynamoDB involvement.

**Testing**: Jest, co-located test files. `aws-sdk-client-mock` for S3 mocks. Streaming parser tested with an in-memory `Readable` fixture.

**Target Platform**: AWS — API Gateway REST API + Lambda (Node.js 20.x) + S3.

**Project Type**: Serverless multi-stack (REST API + event-driven import pipeline).

**Performance Goals**:
- Signed URL response < 200 ms (signature computation only, no I/O).
- Parser begins processing within 10 s of object creation (`SC-003`).
- Parser streams the object — never buffers the full body.

**Constraints**:
- Lambda runtime Node.js 20.x (constitution).
- Lambda memory: 256 MB default.
- Lambda timeout: 10 s for signer; 30 s for parser (CSV streaming may exceed 10 s for files in the upper end of scope).
- TypeScript strict mode, no `any` without justification.
- Biome lint + tsc + jest must pass.
- Pre-signed URL TTL: **300 s (5 minutes)** — short enough to limit replay risk, long enough for typical UX.
- Parser tolerates malformed input per file (constitution III; spec FR-012).

**Scale/Scope**: Single account/region. Files up to ~100 MB. Independent invocations per upload.

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| **I. Contract-First API Evolution** | `openapi.yml` updated to add `GET /import`. Contract fragment in `contracts/openapi.import.yml`. | ✅ Phase 1 |
| **II. Layered Serverless Boundaries** | Signer handler thin: validate `name` via Zod, call `importService.generateUploadUrl(name)`, return JSON. Service owns S3 client + presigner. Parser handler thin: iterate `event.Records`, call `importService.parseUploadedFile(bucket, key)`. | ✅ |
| **III. Deterministic Error Semantics** | Missing/invalid `name` → `BadRequestError` (400) via Middy. SDK failures bubble as 500. Parser logs per-file errors and continues — does not throw to retry storm. | ✅ |
| **IV. Test Coverage Mandatory** | Tests planned: `import.service.test.ts`, `import-products-file/handler.test.ts`, `import-file-parser/handler.test.ts`. Coverage of success + every failure branch. | ✅ |
| **V. Operational Simplicity** | Reuse `ApiLambda`. No new abstraction for parser (one-off `NodejsFunction`). No bucket-event construct. `csv-parser` is pure JS — esbuild bundles it; no `nodeModules` externals. | ✅ |

**Result**: PASS. Complexity Tracking section unused.

**Re-check after Phase 1 design**: PASS — see `/contracts` and `data-model.md`; no new abstractions introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-import-service/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.import.yml
│   └── s3-event.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
bin/
└── backend-aws-practitioner.ts          # MODIFIED: instantiate ImportServiceStack after ApiStack (independent stacks)

lib/
├── constructs/
│   ├── api-lambda.ts                    # REUSED unchanged
│   └── dynamodb-tables.ts               # unchanged
└── stacks/
    ├── api-stack.ts                     # unchanged (no cross-stack reference)
    └── import-stack.ts                  # NEW (owns its own RestApi)

src/
├── common/                              # unchanged
├── lambdas/
│   ├── shared/                          # parse-body.ts renamed to parse-schema.ts
│   ├── import-products-file/            # NEW — GET /import (signing)
│   │   ├── handler.ts
│   │   ├── handler.test.ts
│   │   └── import-products-file.schema.ts
│   └── import-file-parser/              # NEW — S3 ObjectCreated trigger
│       ├── handler.ts
│       └── handler.test.ts
└── services/
    ├── import.service.ts                # NEW (generateUploadUrl + parseUploadedFile)
    └── import.service.test.ts           # NEW

openapi.yml                              # MODIFIED: add /import path
package.json                             # MODIFIED: + 3 runtime deps, + 1 dev dep
```

**Structure Decision**: Two CDK stacks deployed by one CDK app with separate API Gateways. Source layout unchanged — new lambdas slot into the existing `src/lambdas/<name>/` pattern.

## API Gateway Architecture (decision recap)

Each stack owns its own API Gateway — `ApiStack` has `ProductsApi` and `ImportServiceStack` has `ImportApi`. The stacks are fully independent with no cross-stack references.

```ts
// bin/backend-aws-practitioner.ts
new ApiStack(app, 'ApiStack', { env });
new ImportServiceStack(app, 'ImportServiceStack', { env });
```

This was chosen as a hard requirement. The frontend must use two separate base URLs (one per API Gateway).

## Complexity Tracking

> Empty — no Constitution violations to justify.
