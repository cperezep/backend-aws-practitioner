# Backend AWS Practitioner

REST API built with AWS CDK, API Gateway, Lambda (Node.js 20), and DynamoDB. Implements a Products service with full persistence backed by two DynamoDB tables (`products` and `stock`).

## API Documentation

OpenAPI spec: [`openapi.yml`](./openapi.yml)

To browse interactively, open [editor.swagger.io](https://editor.swagger.io) and go to **File → Import URL**:

```
https://raw.githubusercontent.com/cperezep/backend-aws-practitioner/main/openapi.yml
```

To re-export the spec from the deployed API and overwrite `openapi.yml`:

```bash
npm run spec:export
```

## Technologies

| Layer | Technology |
|---|---|
| IaC | [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html) v2 (TypeScript) |
| Runtime | AWS Lambda — Node.js 20.x |
| API | Amazon API Gateway (REST) |
| Database | Amazon DynamoDB (two tables: `products`, `stock`) |
| Middleware | [Middy](https://middy.js.org/) v7 (`core`, `http-error-handler`, `http-event-normalizer`, `http-json-body-parser`) |
| Language | TypeScript 5 |
| Testing | Jest 30 + ts-jest |
| Linting / Formatting | Biome |
| Bundling | esbuild (via `aws-cdk-lib/aws-lambda-nodejs`) |

## API Endpoints

Base URL: `https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod`

| Method | Path | Description |
|---|---|---|
| GET | `/products` | Returns all products with stock counts |
| GET | `/products/{productId}` | Returns a single product by ID with stock count |
| POST | `/products` | Creates a new product and initial stock record |

### Examples

```bash
# Get all products
curl https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod/products

# Get a product by ID
curl https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod/products/f47ac10b-58cc-4372-a567-0e02b2c3d479

# Create a product
curl -X POST https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod/products \
  -H 'Content-Type: application/json' \
  -d '{"title":"New Book","price":29.99,"count":10}'
```

## DynamoDB Setup

Two tables are provisioned automatically by `npm run deploy`:

| Table | Partition Key | Description |
|---|---|---|
| `products` | `id` (String) | Product catalog items |
| `stock` | `product_id` (String) | Inventory count per product |

Table names are CDK-generated and injected into each Lambda as `PRODUCTS_TABLE_NAME` and `STOCK_TABLE_NAME` environment variables — no hardcoded names anywhere in application code.

### Seeding test data

After deploying, populate the tables with sample data:

```bash
# Option 1 – capture table names from CDK outputs automatically
npm run deploy -- --outputs-file cdk-outputs.json
export PRODUCTS_TABLE_NAME=$(jq -r '.ApiStack.ProductsTableName' cdk-outputs.json)
export STOCK_TABLE_NAME=$(jq -r '.ApiStack.StockTableName' cdk-outputs.json)
npm run seed

# Option 2 – pass table names as CLI flags
npm run seed -- --products-table <ProductsTableName> --stock-table <StockTableName>
```

Table names are also printed to the terminal at the end of every `npm run deploy` under `Outputs`.
```

## Useful commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript to JS |
| `npm run watch` | Watch for changes and recompile |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint source files |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format source files |
| `npm run synth` | Emit the synthesized CloudFormation template |
| `npm run deploy` | Deploy this stack to your default AWS account/region |
| `npm run seed` | Seed DynamoDB tables with sample data (requires deployed stack) |
| `npm run destroy` | Destroy the deployed stack |
