import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // Gate standalone tracing on STANDALONE=true so `pnpm dev` and
  // `pnpm typecheck` skip the extra cost. The Dockerfile.docs build
  // sets the env var; everything else gets a normal output.
  ...(process.env.STANDALONE === "true" ? { output: "standalone" } : {}),
  reactStrictMode: true,
  basePath: "/docs",
  // Visiting http://host/ (outside basePath) would otherwise 404 — redirect
  // to the docs root. basePath: false makes the source and destination
  // literal (not re-prefixed with `/docs`), so the redirect runs before
  // basePath routing kicks in.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/docs",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default withMDX(config);
