/// <reference path="../deno.d.ts" />

// ============================================================================
// Supabase Edge Function: order-og
// Returns server-side HTML with dynamic Open Graph meta tags for WhatsApp & social crawlers
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

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") || url.pathname.split("/").pop() || "";
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();

  const isCrawler = CRAWLER_USER_AGENTS.some((crawler) => userAgent.includes(crawler));

  // Initialize Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  let orderTitle = `URT Wholesale – Order #${orderId}`;
  let orderDesc = "Order details • Free shipping • Urbanrat Wholesale";
  let orderImage = "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=1200&h=630&auto=format&fit=crop&q=80";

  if (orderId) {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("id, items, total, subtotal")
        .eq("id", orderId)
        .maybeSingle();

      if (order) {
        const itemCount = Array.isArray(order.items)
          ? order.items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
          : 1;
        const totalAmount = Number(order.total || 0).toLocaleString("en-IN");
        orderTitle = `URT Wholesale – Order #${order.id} (₹${totalAmount})`;
        orderDesc = `${itemCount} ${itemCount === 1 ? "item" : "items"} • ₹${totalAmount} • Free shipping`;

        if (Array.isArray(order.items) && order.items[0]?.image) {
          orderImage = order.items[0].image;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch order in Edge Function:", err);
    }
  }

  const siteOrigin = Deno.env.get("SITE_ORIGIN") || "https://urbanrat.in";
  const targetUrl = `${siteOrigin}/order/${orderId}`;

  // For human browsers, redirect to the client-side SPA route
  if (!isCrawler) {
    return Response.redirect(targetUrl, 302);
  }

  // For social crawlers, return HTML with OG tags
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${orderTitle}</title>
    <meta name="description" content="${orderDesc}" />
    <meta property="og:title" content="${orderTitle}" />
    <meta property="og:description" content="${orderDesc}" />
    <meta property="og:image" content="${orderImage}" />
    <meta property="og:url" content="${targetUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${orderTitle}" />
    <meta name="twitter:description" content="${orderDesc}" />
    <meta name="twitter:image" content="${orderImage}" />
    <meta http-equiv="refresh" content="0;url=${targetUrl}" />
  </head>
  <body>
    <p>Redirecting to order #${orderId}... <a href="${targetUrl}">Click here</a>.</p>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
});
