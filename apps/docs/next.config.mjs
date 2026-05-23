import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // Static export — produces a plain `out/` directory of HTML + assets
  // that CF Pages serves directly, no Workers runtime involved. This
  // sidesteps `fumadocs-mdx`'s `fs/promises` runtime import, which can't
  // be bundled for the Edge runtime that `@cloudflare/next-on-pages`
  // would require otherwise.
  output: "export",
  // Static export can't run image optimization (no server), so disable
  // the optimizer and serve raw image URLs.
  images: { unoptimized: true },
  // Trailing slashes generate `/<route>/index.html` instead of `<route>.html`,
  // which Cloudflare Pages prefers for cleaner URLs (no extension required).
  trailingSlash: true,
  // The fumadocs-mdx postinstall regenerates `source.generated.ts` with a
  // `/// <reference types="vite/client" />` directive (used for Vite HMR
  // types). vite isn't a docs-app dep, so Next's default typecheck step
  // would fail the build. Repo's own `pnpm typecheck` still runs against
  // this app, so disabling Next's redundant pass trades nothing.
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
};

export default withMDX(config);
