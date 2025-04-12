import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // aliyun api key
  env: {
    DASHSCOPE_API_KEY: 'your api key',
  },
  
  webpack: (config) => {
    // pdf worker loader
    config.module.rules.push({
      test: /pdf\.worker\.(min\.)?js/,
      type: 'asset/resource',
    });

    // fallback config, ensure front-end code does not use nodejs modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      http: false,
      https: false,
      stream: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;