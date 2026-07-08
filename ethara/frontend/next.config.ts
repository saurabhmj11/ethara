import type { NextConfig } from "next";

// The backend runs in the same sandbox as the frontend.
// In production, set BACKEND_URL env var to your FastAPI host.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  // Allow the preview proxy host to access Next.js dev resources.
  // Without this, Next.js blocks cross-origin requests from the preview URL
  // with "Blocked cross-origin request to Next.js dev resource".
  allowedDevOrigins: [
    "preview-chat-b087ca74-8d0c-4bdc-bb51-b47dd7c4acd0.space-z.ai",
    "*.space-z.ai",
    "localhost:3000",
    "127.0.0.1:3000",
  ],

  // Proxy all /api/* requests from the browser to the FastAPI backend.
  // This avoids CORS issues and makes the backend reachable from
  // preview environments where port 8000 isn't directly exposed.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Also proxy /docs, /redoc, /health so the Swagger link in the sidebar works
      {
        source: "/docs",
        destination: `${BACKEND_URL}/docs`,
      },
      {
        source: "/redoc",
        destination: `${BACKEND_URL}/redoc`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: "/openapi.json",
        destination: `${BACKEND_URL}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
