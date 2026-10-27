import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

// Rows line up across columns so most connections run straight across.
const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Clients",
        components: [
          { label: "Single-page App", colorKey: "product", technology: "React" },
          { label: "Partner Systems", colorKey: "third-party" },
        ],
      },
    ],
    [
      {
        label: "Edge",
        components: [
          { label: "CDN", colorKey: "third-party", technology: "CloudFront" },
          { label: "API Gateway", colorKey: "rest-api", technology: "API Gateway, JWT authoriser" },
        ],
      },
    ],
    [
      {
        label: "Functions",
        components: [
          { label: "Search Function", colorKey: "microservice", technology: "AWS Lambda" },
          { label: "Bookings Function", colorKey: "microservice", technology: "AWS Lambda" },
          { label: "Receipt Worker", colorKey: "microservice", technology: "AWS Lambda" },
        ],
      },
    ],
    [
      {
        label: "Managed Services",
        components: [
          { label: "Bookings Table", colorKey: "product", technology: "DynamoDB" },
          { label: "Work Queue", colorKey: "rest-api", technology: "SQS" },
          { label: "Receipts Bucket", colorKey: "product", technology: "S3" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Single-page App", to: "CDN", label: "Static files", protocol: "HTTPS" },
    { from: "Single-page App", to: "API Gateway", label: "API calls", protocol: "HTTPS" },
    { from: "Partner Systems", to: "API Gateway", label: "Bookings", protocol: "REST" },
    { from: "API Gateway", to: "Search Function", label: "Searches", protocol: "Invoke" },
    { from: "API Gateway", to: "Bookings Function", label: "Bookings", protocol: "Invoke" },
    { from: "Search Function", to: "Bookings Table", label: "Queries", protocol: "DynamoDB API" },
    { from: "Bookings Function", to: "Bookings Table", label: "Bookings", protocol: "DynamoDB API" },
    { from: "Bookings Function", to: "Work Queue", label: "Booking made", protocol: "SQS", dashed: true },
    { from: "Work Queue", to: "Receipt Worker", label: "Booking made", protocol: "SQS trigger", dashed: true },
    { from: "Receipt Worker", to: "Receipts Bucket", label: "PDF receipts", protocol: "S3 API" },
  ],
};

export const serverlessTemplate: TemplateDefinition = {
  id: "serverless",
  name: "Serverless API",
  description: "An API on managed services: a CDN and an API gateway in front of functions, a key-value table, a queue that triggers a worker, and file storage.",
  build: () => buildDiagram("Serverless API", [{ name: "Overview", canvas: CANVAS }]),
};
