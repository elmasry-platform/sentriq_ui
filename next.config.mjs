import { PHASE_PRODUCTION_BUILD } from "next/constants.js"
import { assertPublicEnv } from "./lib/portal/env-check.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Response headers live in public/_headers (Cloudflare Pages); headers() is ignored on a static export.
}

export default (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD) assertPublicEnv(process.env)
  return nextConfig
}
