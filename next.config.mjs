/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["node:sqlite", "pg", "tesseract.js", "pdfjs-dist"],
  experimental: {
    serverActions: { bodySizeLimit: "1024mb" },
    middlewareClientMaxBodySize: "1024mb",
  },
  devIndicators: false,
};

export default nextConfig;
