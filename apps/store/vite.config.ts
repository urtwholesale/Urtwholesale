/// <reference types="node" />
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeAttr(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Injects Open Graph and Twitter meta tags directly into initial HTML
 * for social crawlers (WhatsApp, Facebook, Twitter) requesting /order/:orderId.
 * Strictly escapes all attributes and validates format.
 */
function orderOgPlugin(): Plugin {
  return {
    name: "order-og-plugin",
    transformIndexHtml(html, ctx) {
      const url = ctx.originalUrl || ctx.path || "";
      const match = url.match(/\/order\/([a-zA-Z0-9_-]{1,32})/);
      if (match && match[1]) {
        const orderId = escapeAttr(match[1]);
        const siteOrigin = escapeAttr(process.env.VITE_PUBLIC_SITE_URL || "https://urbanrat.in");
        const title = escapeAttr(`URT Wholesale – Order #${orderId}`);
        const description = escapeAttr("Wholesale order details • Free shipping • Urbanrat Wholesale");
        const image = escapeAttr("https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=1200&h=630&auto=format&fit=crop&q=80");
        const orderUrl = escapeAttr(`${siteOrigin}/order/${orderId}`);

        const ogTags = [
          `<meta property="og:title" content="${title}" />`,
          `<meta property="og:description" content="${description}" />`,
          `<meta property="og:image" content="${image}" />`,
          `<meta property="og:url" content="${orderUrl}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:title" content="${title}" />`,
          `<meta name="twitter:description" content="${description}" />`,
          `<meta name="twitter:image" content="${image}" />`,
        ].join("\n    ");

        return html.replace(
          "</head>",
          `    ${ogTags}\n  </head>`
        );
      }
      return html;
    },
  };
}


export default defineConfig({
  plugins: [tailwindcss(), orderOgPlugin()],
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@urbanrat/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  envDir: path.resolve(__dirname, "../../"),
  server: {
    port: 5173,
    strictPort: false,
  },
});
