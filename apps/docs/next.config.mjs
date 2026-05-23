import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // The fumadocs-mdx postinstall regenerates `source.generated.ts` with a
  // `/// <reference types="vite/client" />` directive (used for Vite HMR
  // types). vite isn't a docs-app dep, so Next's default typecheck step
  // fails the build. The repo's own typecheck (`pnpm typecheck`) still
  // runs against this app, so disabling Next's redundant pass here trades
  // nothing meaningful. Remove once fumadocs-mdx stops emitting that
  // directive or vite is added as an explicit dep.
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
  // No `basePath` — the docs app is deployed to its own subdomain
  // (docs.agenthost.pro on Cloudflare Pages). The legacy "/docs" basePath
  // belonged to the previous slash-route topology where this app sat
  // behind the main web app's rewrite proxy.
};

export default withMDX(config);
