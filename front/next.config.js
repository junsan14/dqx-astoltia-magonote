const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "api.dqx-tool.com",
        pathname: "/storage/**",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/tools/:path*",
        destination: "/ja/tools/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);