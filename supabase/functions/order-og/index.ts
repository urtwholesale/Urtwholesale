// ============================================================================
// Supabase Edge Function: order-og
// Returns server-side HTML with dynamic Open Graph meta tags for WhatsApp & social crawlers.
// Requires unguessable public_token; HTML-escapes all parameters; outputs only generic code and status.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRAWLER_USER_AGENTS = [
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "telegrambot",
  "slackbot",
  "linkedinbot",
  "discordbot",
];

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const orderId = (url.searchParams.get("orderId") || url.pathname.split("/").pop() || "").trim();
  const token = (url.searchParams.get("t") || url.searchParams.get("token") || "").trim();
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();

  const isCrawler = CRAWLER_USER_AGENTS.some((crawler) => userAgent.includes(crawler));

  const siteOrigin = Deno.env.get("SITE_ORIGIN") || "https://store.urbanrat.in";
  const defaultImage = `${siteOrigin}/logo.png`;

  let safeTitle = "URT Wholesale – Order Tracking";
  let safeDesc = "Wholesale shipment status and tracking timeline • Urbanrat Wholesale";
  let targetUrl = `${siteOrigin}/order/${encodeURIComponent(orderId)}`;

  if (token) {
    targetUrl += `?t=${encodeURIComponent(token)}`;
  }

  // Initialize Supabase client strictly with the anon key
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (orderId && token && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: orderData } = await supabase.rpc("get_order_by_id", {
        p_order_id: orderId,
        p_token: token,
      });

      if (orderData && orderData.id) {
        const statusLabel = orderData.status
          ? String(orderData.status).charAt(0).toUpperCase() + String(orderData.status).slice(1)
          : "Verified";
        safeTitle = `URT Wholesale – Order #${orderData.id}`;
        safeDesc = `Order Status: ${statusLabel} • Urbanrat Wholesale Tracking`;
      }
    } catch (err) {
      console.warn("Failed to query order in Edge Function:", err);
    }
  }

  const escapedTitle = escapeHtml(safeTitle);
  const escapedDesc = escapeHtml(safeDesc);
  const escapedTargetUrl = escapeHtml(targetUrl);
  const escapedImage = escapeHtml(defaultImage);

  // For human browsers, redirect to the client-side SPA route
  if (!isCrawler) {
    return Response.redirect(targetUrl, 302);
  }

  // For social crawlers, return HTML with escaped OG tags
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDesc}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDesc}" />
    <meta property="og:image" content="${escapedImage}" />
    <meta property="og:url" content="${escapedTargetUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedImage}" />
    <meta http-equiv="refresh" content="0;url=${escapedTargetUrl}" />
  </head>
  <body>
    <p>Redirecting to order... <a href="${escapedTargetUrl}">Click here</a>.</p>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
    },
  });
});
