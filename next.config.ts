import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint es un chequeo de desarrollo; no debe frenar el build de producción
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
