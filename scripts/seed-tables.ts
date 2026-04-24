/**
 * Seed script: populates the DynamoDB `products` and `stock` tables with
 * sample data that mirrors the in-memory fixture in product.data.ts.
 *
 * Usage (after `npm run deploy`):
 *   PRODUCTS_TABLE_NAME=<name> STOCK_TABLE_NAME=<name> npm run seed
 *
 * Or with explicit CLI flags:
 *   npm run seed -- --products-table <name> --stock-table <name>
 *
 * AWS credentials are read from the standard credential chain
 * (~/.aws/credentials, env vars, instance profile, etc.).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Config – env vars take precedence; CLI flags are a fallback
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name: string) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const PRODUCTS_TABLE = flag('--products-table') ?? process.env.PRODUCTS_TABLE_NAME;
const STOCK_TABLE = flag('--stock-table') ?? process.env.STOCK_TABLE_NAME;

if (!PRODUCTS_TABLE || !STOCK_TABLE) {
  console.error(
    'Error: table names are required.\n' +
    'Set PRODUCTS_TABLE_NAME and STOCK_TABLE_NAME env vars, or pass\n' +
    '--products-table <name> --stock-table <name>',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Seed data (same UUIDs as product.data.ts so local tests stay in sync)
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', title: 'AWS CDK in Practice',          description: 'Learn CDK fundamentals',                         price: 29.99 },
  { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', title: 'Serverless Patterns',           description: 'Common Lambda patterns',                         price: 34.99 },
  { id: '550e8400-e29b-41d4-a716-446655440000', title: 'DynamoDB Deep Dive',             description: 'NoSQL data modeling',                            price: 39.99 },
  { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', title: 'Lambda in Action',               description: 'Serverless computing with AWS Lambda',           price: 24.99 },
  { id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', title: 'API Gateway Essentials',         description: 'Building APIs with AWS API Gateway',             price: 19.99 },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'CloudFormation Mastery',         description: 'Infrastructure as Code with AWS CloudFormation', price: 29.99 },
  { id: 'b3d7e9a1-5c2f-4b8a-9d6e-1a2b3c4d5e6f', title: 'AWS Security Best Practices',   description: 'Securing your AWS environment',                  price: 34.99 },
  { id: 'c4e8f2b5-6d3a-4c9b-8e7f-2b3c4d5e6f7a', title: 'Monitoring with CloudWatch',    description: 'Observability and monitoring in AWS',            price: 24.99 },
  { id: 'd5f9a3c6-7e4b-4d0c-9f8a-3c4d5e6f7a8b', title: 'AWS Cost Optimization',          description: 'Strategies to reduce AWS costs',                price: 19.99 },
];

const STOCK = [
  { product_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', count: 4  },
  { product_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', count: 6  },
  { product_id: '550e8400-e29b-41d4-a716-446655440000', count: 12 },
  { product_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', count: 8  },
  { product_id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', count: 3  },
  { product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', count: 5  },
  { product_id: 'b3d7e9a1-5c2f-4b8a-9d6e-1a2b3c4d5e6f', count: 7  },
  { product_id: 'c4e8f2b5-6d3a-4c9b-8e7f-2b3c4d5e6f7a', count: 10 },
  { product_id: 'd5f9a3c6-7e4b-4d0c-9f8a-3c4d5e6f7a8b', count: 2  },
];

// ---------------------------------------------------------------------------
// DynamoDB client
// ---------------------------------------------------------------------------
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ---------------------------------------------------------------------------
// Seed – TransactWriteCommand supports up to 100 items per call.
// Each product requires 2 items (product + stock), so 9 products = 18 items.
// ---------------------------------------------------------------------------
async function seed(): Promise<void> {
  console.log(`Seeding products table: ${PRODUCTS_TABLE}`);
  console.log(`Seeding stock table:    ${STOCK_TABLE}`);

  const transactItems = PRODUCTS.flatMap((product, i) => [
    {
      Put: {
        TableName: PRODUCTS_TABLE as string,
        Item: product,
      },
    },
    {
      Put: {
        TableName: STOCK_TABLE as string,
        Item: STOCK[i],
      },
    },
  ]);

  await client.send(new TransactWriteCommand({ TransactItems: transactItems }));

  console.log(`✓ Seeded ${PRODUCTS.length} products and ${STOCK.length} stock records.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
