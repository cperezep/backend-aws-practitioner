# Quickstart: Import Service

End-to-end walkthrough for a developer picking up this feature after the plan is approved.

---

## 1. Install dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner csv-parser
npm install --save-dev aws-sdk-client-mock
```

> `csv-parser` has no native bindings — esbuild bundles it. No `bundling.externalModules` entry needed.

## 2. Project layout to create

```
lib/stacks/import-stack.ts
src/lambdas/import-products-file/handler.ts
src/lambdas/import-products-file/import-products-file.schema.ts
src/lambdas/import-products-file/handler.test.ts
src/lambdas/import-file-parser/handler.ts
src/lambdas/import-file-parser/handler.test.ts
src/services/import.service.ts
src/services/import.service.test.ts
```

Modify:

```
bin/backend-aws-practitioner.ts (instantiate ImportServiceStack independently)
openapi.yml                   (add /import path — copy from contracts/openapi.import.yml)
```

## 3. Build, lint, test, deploy

```bash
npm run build
npm run lint
npm test
npx cdk synth ImportServiceStack
npx cdk deploy --all
```

`--all` deploys both stacks. They are independent (no cross-stack references).

## 4. Smoke test deployed endpoint

```bash
# Use the ImportApiUrl CfnOutput from ImportServiceStack
IMPORT_API=$(aws cloudformation describe-stacks --stack-name ImportServiceStack \
  --query "Stacks[0].Outputs[?OutputKey=='ImportApiUrl'].OutputValue" --output text)

# Get a signed URL
URL=$(curl -s "${IMPORT_API}import?name=products.csv" | jq -r .)
echo "$URL"

# Upload a CSV directly to S3
echo 'id,title,price
p1,Widget,9.99
p2,Gadget,19.99' > /tmp/products.csv

curl -X PUT -H 'Content-Type: text/csv' --data-binary @/tmp/products.csv "$URL"
```

## 5. Verify parser ran

```bash
# Find the parser log group
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/ImportServiceStack-ImportFileParser \
  --query "logGroups[].logGroupName" --output text

# Tail it
aws logs tail /aws/lambda/<that-name> --since 2m --follow
```

Expected: two `record { id: 'p1', title: 'Widget', price: '9.99' }` style log lines.

## 5b. Verify file was moved

```bash
# Find the bucket name
BUCKET_NAME=$(aws s3 ls | grep importservicestack | awk '{print $3}')

# uploaded/ should be empty (file was moved)
aws s3 ls s3://${BUCKET_NAME}/uploaded/

# parsed/ should have the file
aws s3 ls s3://${BUCKET_NAME}/parsed/
# Expected: products.csv
```

## 6. Failure paths to verify manually

| Request | Expected |
|---|---|
| `GET /import` (no `name`) | 400 `{ "message": "name is required" }` |
| `GET /import?name=` | 400 `{ "message": "name is required" }` |
| `GET /import?name=foo.txt` | 400 `{ "message": "name must end with .csv" }` |
| `GET /import?name=../etc/passwd.csv` | 400 `{ "message": "name contains invalid characters" }` |
| Upload empty file (`uploaded/empty.csv`, 0 bytes) | Parser logs zero records, file moved to `parsed/` |
| Upload corrupt CSV | Parser logs `parse failed { ... }` and exits cleanly (Lambda success — no retry). File stays in `uploaded/` (not moved) |

## 7. Teardown

```bash
npx cdk destroy ImportServiceStack ApiStack
```

`autoDeleteObjects: true` on the import bucket will purge any uploaded files first.

## 8. Where things live (cheat sheet)

| Concern | File |
|---|---|
| Signed URL generation | [src/services/import.service.ts](../../src/services/import.service.ts) |
| Signer Lambda entrypoint | [src/lambdas/import-products-file/handler.ts](../../src/lambdas/import-products-file/handler.ts) |
| Parser Lambda entrypoint | [src/lambdas/import-file-parser/handler.ts](../../src/lambdas/import-file-parser/handler.ts) |
| Bucket + IAM + S3→Lambda wiring | [lib/stacks/import-stack.ts](../../lib/stacks/import-stack.ts) |
| API Gateway sharing | [lib/stacks/api-stack.ts](../../lib/stacks/api-stack.ts) (public `restApi`) |
| OpenAPI surface | [openapi.yml](../../openapi.yml) |
