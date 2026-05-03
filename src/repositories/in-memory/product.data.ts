import type { Product, Stock } from '@/common/types';

export const PRODUCTS: Product[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'AWS CDK in Practice',
    description: 'Learn CDK fundamentals',
    price: 29.99,
  },
  {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    title: 'Serverless Patterns',
    description: 'Common Lambda patterns',
    price: 34.99,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'DynamoDB Deep Dive',
    description: 'NoSQL data modeling',
    price: 39.99,
  },
  {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    title: 'Lambda in Action',
    description: 'Serverless computing with AWS Lambda',
    price: 24.99,
  },
  {
    id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    title: 'API Gateway Essentials',
    description: 'Building APIs with AWS API Gateway',
    price: 19.99,
  },
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'CloudFormation Mastery',
    description: 'Infrastructure as Code with AWS CloudFormation',
    price: 29.99,
  },
  {
    id: 'b3d7e9a1-5c2f-4b8a-9d6e-1a2b3c4d5e6f',
    title: 'AWS Security Best Practices',
    description: 'Securing your AWS environment',
    price: 34.99,
  },
  {
    id: 'c4e8f2b5-6d3a-4c9b-8e7f-2b3c4d5e6f7a',
    title: 'Monitoring with CloudWatch',
    description: 'Observability and monitoring in AWS',
    price: 24.99,
  },
  {
    id: 'd5f9a3c6-7e4b-4d0c-9f8a-3c4d5e6f7a8b',
    title: 'AWS Cost Optimization',
    description: 'Strategies to reduce AWS costs',
    price: 19.99,
  },
];

export const STOCK: Stock[] = [
  { product_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', count: 4 },
  { product_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', count: 6 },
  { product_id: '550e8400-e29b-41d4-a716-446655440000', count: 12 },
  { product_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', count: 8 },
  { product_id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', count: 3 },
  { product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', count: 5 },
  { product_id: 'b3d7e9a1-5c2f-4b8a-9d6e-1a2b3c4d5e6f', count: 7 },
  { product_id: 'c4e8f2b5-6d3a-4c9b-8e7f-2b3c4d5e6f7a', count: 10 },
  { product_id: 'd5f9a3c6-7e4b-4d0c-9f8a-3c4d5e6f7a8b', count: 2 },
];
