import type { NextConfig } from "next";

// The backend runs in the same sandbox as the frontend.
// In production, set BACKEND_URL env var to your FastAPI host.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// When NEXT_PUBLIC_API_URL is set (e.g. on Netlify static deploy),
// we skip rewrites and let the browser call the backend directly.
const isStatic = Boolean(process.env.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  // Static export for Netlify/CDN deployments
  ...(isStatic ? { output: "export" } : {}),

  allowedDevOrigins: [
    "preview-chat-b087ca74-8d0c-4bdc-bb51-b47dd7c4acd0.space-z.ai",
    "*.space-z.ai",
    "localhost:3000",
    "127.0.0.1:3000",
  ],

  // Proxy all /api/* requests from the browser to the FastAPI backend.
  // Only used in server-mode (no NEXT_PUBLIC_API_URL set).
  ...(!isStatic
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${BACKEND_URL}/api/:path*`,
            },
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
      }
    : {}),
};

export default nextConfig;
