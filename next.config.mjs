import { PHASE_PRODUCTION_BUILD } from "next/constants.js"
import { assertPublicEnv } from "./lib/portal/env-check.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000" },
      ],
    }]
  },
}

export default (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD) assertPublicEnv(process.env)
  return nextConfig
}
