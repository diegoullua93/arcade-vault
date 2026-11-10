import type { NextConfig } from "next";

// SPEC 13: cabeceras de seguridad básicas para todas las rutas.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  /* config options here */
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
  // Alias habitual: /login no existe, el acceso vive en /auth (con sesión, /auth redirige en proxy.ts).
  redirects: async () => [{ source: "/login", destination: "/auth", permanent: false }],
  experimental: {
    agentFeedback: true,
  },
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()) ?? [],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
