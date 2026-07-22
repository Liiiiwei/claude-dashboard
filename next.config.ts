import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本機工具的基本安全標頭：降低被內嵌 / 內容型別混淆 / referrer 外洩的風險
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
