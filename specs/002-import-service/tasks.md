---
description: "Tasks for Import Service feature implementation"
---

# Tasks: Import Service

**Input**: Design documents from [specs/002-import-service/](.)
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts)

**Tests**: INCLUDED. The repository constitution (Principle IV) makes Jest tests mandatory at every layer. Task list reflects this.

**Organization**: Tasks grouped by user story (US1 / US2 / US3). Each story is independently demonstrable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3); omitted for Setup, Foundational, and Polish
- All file paths are repository-relative

## Path Conventions

Single-project serverless layout (per [plan.md](plan.md) §"Project Structure"):

- Infrastructure: `lib/stacks/`, `lib/constructs/`
- Lambdas: `src/lambdas/<name>/handler.ts` (+ `handler.test.ts`, optional `<name>.schema.ts`)
- Services: `src/services/<name>.ts` (+ `<name>.test.ts`)
- Contract: `openapi.yml` at repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new dependencies and confirm tooling still passes before touching code.

- [x] T001 Add runtime dependencies: run `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner csv-parser` and verify they appear in `package.json`
- [x] T002 [P] Add dev dependency: run `npm install --save-dev aws-sdk-client-mock` and verify it appears in `devDependencies` of `package.json`
- [x] T003 Run baseline checks `npm run build && npm run lint && npm test` to confirm a clean starting point on branch `task-5`

**Checkpoint**: Dependencies installed; existing test suite still green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting wiring that EVERY user story depends on (cross-stack API sharing + new stack scaffold + bin entry).

**⚠️ CRITICAL**: No user-story tasks may begin until this phase is complete.

- [x] T004 ~~Expose the API Gateway across stacks~~ **REVISED**: Each stack owns its own API Gateway. `ImportServiceStack` creates a separate `RestApi` (`ImportApi`). No cross-stack reference needed.
- [x] T005 Create empty stack scaffold `lib/stacks/import-stack.ts` exporting `ImportServiceStack extends cdk.Stack` with standard `cdk.StackProps`; constructor body empty (`super(scope, id, props)`) — this is the file all subsequent infra tasks will edit
- [x] T006 Wire the new stack in `bin/backend-aws-practitioner.ts`: instantiate `ImportServiceStack` after `ApiStack` with `{ env }`; verify `npx cdk synth` succeeds with both stacks listed

**Checkpoint**: `cdk synth` produces `ApiStack` and `ImportServiceStack` (the latter empty). User-story work can now begin.

---

## Phase 3: User Story 1 — Request a signed upload URL for a CSV (Priority: P1) 🎯 MVP

**Goal**: A client calling `GET /import?name=products.csv` receives a 5-minute pre-signed S3 PUT URL bound to `Content-Type: text/csv` for key `uploaded/products.csv`, and a browser PUT to that URL succeeds.

**Independent Test**: After deploy, `curl "$API/import?name=products.csv"` returns a JSON-string URL; `curl -X PUT -H 'Content-Type: text/csv' --data-binary @products.csv <url>` returns 2xx; the object appears at `s3://<import-bucket>/uploaded/products.csv`.

### Tests for User Story 1

> Write FIRST and confirm they FAIL before implementation.

- [x] T007 [P] [US1] Create `src/services/import.service.test.ts` covering: (a) `generateUploadUrl('products.csv')` calls `getSignedUrl` with a `PutObjectCommand` whose `Bucket = process.env.IMPORT_BUCKET_NAME`, `Key = 'uploaded/products.csv'`, `ContentType = 'text/csv'`; (b) `expiresIn` option is `300`; (c) returns the string the presigner returns. Use `aws-sdk-client-mock` to intercept `S3Client`.
- [x] T008 [P] [US1] Create `src/lambdas/import-products-file/handler.test.ts` covering the happy path: handler invoked with `queryStringParameters: { name: 'products.csv' }` calls `importService.generateUploadUrl('products.csv')` and returns `{ statusCode: 200, body: JSON.stringify(<url>) }`. Mock the service module.

### Implementation for User Story 1

- [x] T009 [US1] Create `src/services/import.service.ts` exporting `generateUploadUrl(name: string): Promise<string>` that builds a `PutObjectCommand` (`Bucket = env.IMPORT_BUCKET_NAME`, `Key = \`uploaded/${name}\``, `ContentType = 'text/csv'`) and returns `getSignedUrl(s3Client, command, { expiresIn: 300 })`. Module-scope singleton `s3Client = new S3Client({})` (per research R-004).
- [x] T010 [US1] Create `src/lambdas/import-products-file/import-products-file.schema.ts` exporting a Zod schema `importQuerySchema = z.object({ name: z.string().min(1).max(255).regex(/^[A-Za-z0-9._-]+$/).endsWith('.csv') })` (per research R-016). Export inferred type as well.
- [x] T011 [US1] Create `src/lambdas/import-products-file/handler.ts`: thin handler wrapped in `withMiddleware`. Validate `event.queryStringParameters` against `importQuerySchema` (reuse the validation pattern from `parse-body.ts`; for query parameters we can call `schema.parse(event.queryStringParameters ?? {})` and convert `ZodError` → `BadRequestError` inline OR add a `parseQuery` shared helper if the existing pattern requires it). Call `generateUploadUrl(name)` and return `ok(url)` (the bare URL string serialized via `JSON.stringify`).
- [x] T012 [US1] In `lib/stacks/import-stack.ts`, create `s3.Bucket` (`removalPolicy: DESTROY`, `autoDeleteObjects: true`, block all public access enabled) with CORS rule `{ allowedMethods: [PUT], allowedOrigins: ['*'], allowedHeaders: ['*'], exposedHeaders: ['ETag'] }` (per research R-011).
- [x] T013 [US1] In `lib/stacks/import-stack.ts`, instantiate the signer Lambda via the existing `ApiLambda` construct: `entry: 'import-products-file'`, `method: 'GET'`, `resource: props.restApi.root.addResource('import')`, `environment: { IMPORT_BUCKET_NAME: bucket.bucketName }`. Then `bucket.grantPut(signer.handler, 'uploaded/*')` (per research R-007).
- [x] T014 [US1] Add `GET /import` to `openapi.yml` by merging the contents of `specs/002-import-service/contracts/openapi.import.yml` into the root document (preserving the existing products paths and any shared components).
- [x] T015 [US1] Run `npm run build && npm run lint && npm test`; fix any failures. Tests from T007/T008 must now pass.

**Checkpoint**: US1 is fully functional in isolation. Deploying just `ApiStack` + `ImportServiceStack` at this point yields a working signing endpoint and bucket — no parser yet, but the MVP slice is shippable.

---

## Phase 4: User Story 2 — Automatic parsing of uploaded CSV files (Priority: P2)

**Goal**: Any object created under `uploaded/` triggers a Lambda that streams the object, parses it as CSV, and emits one `console.log` per row.

**Independent Test**: Place a 10-row CSV directly into `s3://<bucket>/uploaded/test.csv` (e.g., `aws s3 cp`); within ~10 s the parser's CloudWatch log group contains exactly 10 `record { ... }` log lines.

### Tests for User Story 2

- [x] T016 [P] [US2] Create `src/lambdas/import-file-parser/handler.test.ts` — **REVISED**: tests mock `import.service.parseUploadedFile` (service layer) instead of mocking S3 directly. Covers: (a) calls `parseUploadedFile` for each record; (b) decodes URL-encoded keys; (c) logs error and continues on failure.

### Implementation for User Story 2

- [x] T017 [US2] **REVISED**: `src/lambdas/import-file-parser/handler.ts` is a thin controller. Iterates `event.Records`, decodes key, calls `importService.parseUploadedFile(bucket, key)`. Per-record `try/catch` with `console.error`. All S3/CSV logic moved to `import.service.ts` → `parseUploadedFile()`.
- [x] T018 [US2] In `lib/stacks/import-stack.ts`, instantiate the parser as a `lambda_nodejs.NodejsFunction` directly (NOT via `ApiLambda`): `entry: 'src/lambdas/import-file-parser/handler.ts'`, `runtime: NODEJS_20_X`, `memorySize: 512`, `timeout: Duration.seconds(30)`, `environment: { IMPORT_BUCKET_NAME: bucket.bucketName }`, `bundling: { minify: true, sourceMap: true }` (consistent with existing `ApiLambda`).
- [x] T019 [US2] In `lib/stacks/import-stack.ts`, wire the trigger: `bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(parserFn), { prefix: 'uploaded/' })` (imports from `aws-cdk-lib/aws-s3` and `aws-cdk-lib/aws-s3-notifications`).
- [x] T020 [US2] **REVISED**: Grant `grantRead` + `grantDelete` on `uploaded/*` and `grantPut` on `parsed/*` (parser moves files from `uploaded/` → `parsed/` after processing).
- [x] T021 [US2] Run `npm run build && npm run lint && npm test`; fix any failures. Tests from T016 must now pass.

**Checkpoint**: US1 + US2 both work. The full import pipeline is operational end-to-end (sign → upload → parse → log).

---

## Phase 5: User Story 3 — Reject invalid import requests (Priority: P3)

**Goal**: `GET /import` with a missing, empty, non-`.csv`, or path-traversal `name` returns 400 with a clear error message and creates no objects.

**Independent Test**: Four `curl` calls (`?` absent, `?name=`, `?name=foo.txt`, `?name=../etc/passwd.csv`) all return 400 with the documented error messages; bucket listing shows no new objects.

### Tests for User Story 3

- [ ] T022 [P] [US3] Extend `src/lambdas/import-products-file/handler.test.ts` with negative-path cases: (a) `queryStringParameters: undefined` → 400 `{ message: 'name is required' }`; (b) `{ name: '' }` → 400 `{ message: 'name is required' }`; (c) `{ name: 'foo.txt' }` → 400 `{ message: 'name must end with .csv' }`; (d) `{ name: '../etc/passwd.csv' }` → 400 `{ message: 'name contains invalid characters' }`. Confirm `importService.generateUploadUrl` is NOT called in any of these cases.

### Implementation for User Story 3

- [ ] T023 [US3] In `src/lambdas/import-products-file/import-products-file.schema.ts` (or via the validation call site in `handler.ts`), customize each Zod constraint's error message to match the exact strings asserted in T022 (`'name is required'`, `'name must end with .csv'`, `'name contains invalid characters'`). Map the first emitted issue's message to the `BadRequestError` body so Middy renders it.
- [ ] T024 [US3] Verify negative paths via `npm test`; ensure the existing `withMiddleware` + `BadRequestError` chain produces `statusCode: 400` and `body: { message: <string> }` exactly as the OpenAPI fragment in `contracts/openapi.import.yml` documents.

**Checkpoint**: All three user stories independently functional. Quality gate complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation alignment, and operational hygiene before handoff.

- [ ] T025 Run `cdk synth ApiStack ImportServiceStack` and inspect the generated template: confirm cross-stack `Export` (in `ApiStack`) + `Fn::ImportValue` (in `ImportServiceStack`) for the API Gateway, and that bucket policies grant only `s3:PutObject` (signer) and `s3:GetObject` (parser) on `arn:.../uploaded/*`.
- [ ] T026 [P] Verify `openapi.yml` is consistent with the deployed surface: the `/import` path matches `contracts/openapi.import.yml` (response `200` is `type: string`, error envelope is `{ message }`).
- [ ] T027 Manual end-to-end smoke test following [quickstart.md](quickstart.md) §4–§6: deploy with `cdk deploy --all`, request a URL, upload a sample CSV, tail the parser log group, confirm row entries.
- [ ] T028 [P] Final quality gate: `npm run build && npm run lint && npm run test:coverage` all pass; coverage on new files (`import.service.ts`, both handlers) ≥ existing repository coverage targets.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies.
- **Phase 2 (Foundational)**: depends on Phase 1. **BLOCKS** Phases 3–5.
- **Phase 3 (US1)**: depends on Phase 2.
- **Phase 4 (US2)**: depends on Phase 2. **Independent of US1** — could run in parallel by a second developer (different lambdas, different files).
- **Phase 5 (US3)**: depends on Phase 3 (extends US1's handler test + schema).
- **Phase 6 (Polish)**: depends on Phases 3–5.

### User-Story Dependencies

- **US1** ↔ **US2**: independent. Both consume the bucket from T012 (US1 owns it). To enable US2 to start before US1 is fully done, T012 (bucket creation) is the only US1 task US2 needs; everything else in US1 (schema, handler, signer wiring, OpenAPI) is independent.
- **US3** depends on **US1** because it extends the same handler/schema files (T011, T010). US3 cannot start in parallel with US1.

### Within Each User Story

- Tests written first (T007/T008, T016, T022) and observed to FAIL.
- Service layer before handler that consumes it (T009 before T011).
- Schema before handler that imports it (T010 before T011).
- Bucket before any IAM/event wiring that references it (T012 before T013, T018, T019, T020).
- Lambda function exists before its IAM grant (T013 before its `grantPut`; T018 before T019 + T020).

### Parallel Opportunities

Marked with `[P]`:

- **Setup**: T001 and T002 (different commands, both touch `package.json` — run sequentially in practice; T002 can be parallelized only if `npm install` operations are serialized by the agent).
- **Within US1**: T007 and T008 (different test files).
- **Within US2**: T016 stands alone among tests; implementation tasks (T017–T020) all touch different files except T018/T019/T020 which all edit `import-stack.ts` — those must serialize.
- **Within US3**: T022 (test) is the only [P] candidate.
- **Cross-story**: once Phase 2 is done, a second developer can take **US2 (Phase 4)** in parallel with the first developer doing **US1 (Phase 3)**, provided T012 (bucket creation) is sequenced first or duplicated as a coordination point.
- **Polish**: T026 and T028 are independent of each other.

---

## Parallel Example: User Story 1

```text
# Once Phase 2 (foundational) is green, write US1 tests in parallel:
Task: "Create src/services/import.service.test.ts (T007)"
Task: "Create src/lambdas/import-products-file/handler.test.ts happy path (T008)"

# After tests fail, implement service + schema in parallel (different files):
Task: "Implement src/services/import.service.ts (T009)"
Task: "Implement src/lambdas/import-products-file/import-products-file.schema.ts (T010)"

# Then implement handler + stack wiring sequentially (handler imports schema; stack wiring depends on bucket existing):
Task: "Implement handler.ts (T011)"
Task: "Create bucket in import-stack.ts (T012)"
Task: "Wire signer Lambda + grantPut (T013)"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. **STOP and VALIDATE**: deploy, run quickstart §4 (sign + upload). Verify object lands in `uploaded/`.
3. Demo / merge MVP. Defer parsing until US2 is greenlit.

### Incremental Delivery

1. Setup + Foundational → Foundation ready (`cdk synth` clean).
2. US1 → MVP shippable.
3. US2 → full pipeline shippable.
4. US3 → API hardening shippable.
5. Polish → release-ready.

### Parallel Team Strategy

After Phase 2:

- Dev A: US1 (Phase 3) → US3 (Phase 5).
- Dev B: US2 (Phase 4) — start at T016 once T005 (empty stack scaffold) and T012 (bucket — coordinate with Dev A) are merged. Alternative: split T012 out into Foundational (move it before Phase 3) so US2 has zero US1 dependency.

> **Recommendation**: keep T012 in US1 (current structure). It's a one-line construct; the coordination cost is lower than splitting bucket ownership across phases.

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks.
- Every file path is repository-relative.
- All test tasks must be observed to FAIL before their corresponding implementation tasks are started (constitution IV + research R-015).
- Commit after each task or logical group; Spec Kit `after_tasks` git hook is available.
- Constitution gates (lint, build, test) re-run at the end of each phase (T003, T015, T021, T028).
- This task list intentionally omits: persistence of parsed rows, file movement to `parsed/`, authn/authz, CSV column-schema validation (all out of scope per spec).
