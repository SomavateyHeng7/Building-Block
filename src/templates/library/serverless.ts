import { buildDiagram, type CanvasSpec } from "../build";
import type { TemplateDefinition } from "../types";

/** What the Bookings Function is made of, so the template shows an internal design (L2). */
const BOOKINGS_FUNCTION: CanvasSpec = {
  columns: [
    [{ label: "Entry", components: [{ label: "Request Handler", colorKey: "microservice", technology: "Lambda handler" }] }],
    [
      {
        label: "Logic",
        components: [
          { label: "Validation", colorKey: "enhancement", description: "Rejects bad dates, party sizes and prices." },
          { label: "Booking Logic", colorKey: "microservice" },
        ],
      },
    ],
    [
      {
        label: "Clients",
        components: [
          { label: "DynamoDB Client", colorKey: "product", technology: "AWS SDK" },
          { label: "Queue Publisher", colorKey: "new", technology: "AWS SDK" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Request Handler", to: "Validation", label: "Raw request", protocol: "In-process" },
    { from: "Validation", to: "Booking Logic", label: "Valid booking", protocol: "In-process" },
    { from: "Booking Logic", to: "DynamoDB Client", label: "Saves booking", protocol: "In-process" },
    { from: "Booking Logic", to: "Queue Publisher", label: "Booking made", protocol: "In-process", dashed: true },
  ],
};

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
          { label: "Bookings Function", colorKey: "microservice", technology: "AWS Lambda", detail: BOOKINGS_FUNCTION },
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
  description: "An API on managed services: a CDN and an API gateway in front of functions, a key-value table, a queue that triggers a worker, and file storage. The Bookings Function has an internal design (L2) to open.",
  category: "Architecture",
  keywords: ["serverless","lambda","functions","api gateway","queue", "l2"],
  build: () => buildDiagram("Serverless API", [{ name: "Overview", canvas: CANVAS }]),
};
