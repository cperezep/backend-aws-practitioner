# Backend AWS Practitioner

REST API built with AWS CDK, API Gateway, and Lambda (Node.js 20). Implements a simple Products service with an in-memory repository.

## Technologies

| Layer | Technology |
|---|---|
| IaC | [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html) v2 (TypeScript) |
| Runtime | AWS Lambda — Node.js 20.x |
| API | Amazon API Gateway (REST) |
| Middleware | [Middy](https://middy.js.org/) v7 (`core`, `http-error-handler`, `http-event-normalizer`, `http-json-body-parser`) |
| Language | TypeScript 5 |
| Testing | Jest 30 + ts-jest |
| Linting / Formatting | Biome |
| Bundling | esbuild (via `aws-cdk-lib/aws-lambda-nodejs`) |

## API Endpoints

Base URL: `https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod`

| Method | Path | Description |
|---|---|---|
| GET | `/products` | Returns all products |
| GET | `/products/{productId}` | Returns a single product by ID |

### Examples

```bash
# Get all products
curl https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod/products

# Get a product by ID
curl https://44hcac7j89.execute-api.us-east-1.amazonaws.com/prod/products/abc-123
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
| `npm run destroy` | Destroy the deployed stack |
