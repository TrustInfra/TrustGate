/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Optional peer deps pulled in transitively by @metamask/sdk and pino.
    // We don't use them at runtime in the browser, so mark them external
    // to stop webpack from trying to resolve and bundle them on Vercel.
    config.externals.push(
      "pino-pretty",
      "@react-native-async-storage/async-storage"
    );
    return config;
  },
};

module.exports = nextConfig;
