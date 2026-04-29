import type { NextConfig } from "next";

const isTossBuild = process.env.TOSS_BUILD === '1';

const nextConfig: NextConfig = {
  ...(isTossBuild && {
    output: 'export',
    basePath: '/web',
  }),
};

export default nextConfig;
