// supabase/functions/checkout-gate/index.ts
// Secure Guest Checkout Gateway with Cloudflare Turnstile & Table-Backed IP Rate Limiting
// Enforces proxy-appended IP inspection & calls create_verified_order_guest via service_role

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const configuredOrigins = [
  Deno.env.get("SITE_ORIGIN"),
  Deno.env.get("VITE_PUBLIC_SITE_URL"),
  "https://urtwholesale.com",
  "https://www.urtwholesale.com",
  "https://store.urbanrat.in",
  "http://localhost:5173",
].filter((o): o is string => Boolean(o && typeof o === "string" && o.trim() !== ""));

function buildCorsHeaders(req: Request) {
  const reqOrigin = req.headers.get("origin") || "";
  const matchedOrigin = configuredOrigins.find(
    (o) => o.toLowerCase() === reqOrigin.toLowerCase()
  );
  return {
    "Access-Control-Allow-Origin": matchedOrigin || (configuredOrigins[0] || "*"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Enforce payload size limit (max 64 KB) by reading raw text body
    const rawText = await req.text();
    const byteLength = new TextEncoder().encode(rawText).length;
    if (byteLength > 65536) {
      return new Response(
        JSON.stringify({ error: "Payload too large. Maximum allowed size is 64 KB." }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON request body." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Log incoming IP headers for proxy inspection on staging
    const xForwardedFor = req.headers.get("x-forwarded-for");
    const xRealIp = req.headers.get("x-real-ip");
    const cfConnectingIp = req.headers.get("cf-connecting-ip");

    console.log("[checkout-gate] Incoming request IP headers:", {
      "cf-connecting-ip": cfConnectingIp,
      "x-real-ip": xRealIp,
      "x-forwarded-for": xForwardedFor,
    });

    // Derive client IP: prefer cf-connecting-ip if Cloudflare proxy is active,
    // otherwise take the proxy-appended (last) entry in x-forwarded-for to prevent client spoofing.
    let clientIp: string | null = cfConnectingIp ? cfConnectingIp.trim() : null;
    if (!clientIp && xForwardedFor) {
      const parts = xForwardedFor.split(",").map((s: string) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        clientIp = parts[parts.length - 1];
      }
    }
    if (!clientIp && xRealIp) {
      clientIp = xRealIp.trim();
    }
    const finalIp = clientIp || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 3. Dedicated service-role client for guest rate-limiting and order execution
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // If client IP is unknown, do not block (rely on per-phone SQL limit in create_verified_order_guest)
    if (finalIp !== "unknown") {
      const { data: isAllowed, error: rateLimitErr } = await adminClient.rpc(
        "check_and_record_checkout_rate_limit",
        {
          p_ip: finalIp,
          p_max_requests: 5,
          p_window_minutes: 10,
        }
      );

      if (rateLimitErr) {
        console.warn("[checkout-gate] Rate limit check error:", rateLimitErr);
      } else if (isAllowed === false) {
        return new Response(
          JSON.stringify({
            error: "Too many checkout requests from this network. Please wait 10 minutes before retrying.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const {
      customer,
      items,
      whatsapp_message,
      honeypot,
      turnstile_token,
      promo_code,
      coupon_code,
      couponCode,
    } = body || {};

    // Validate optional couponCode format (1-32 alphanumeric, uppercase, dashes, underscores)
    const rawCoupon = couponCode !== undefined ? couponCode : coupon_code;
    let cleanCoupon: string | null = null;
    if (rawCoupon !== undefined && rawCoupon !== null && String(rawCoupon).trim() !== "") {
      if (typeof rawCoupon !== "string") {
        return new Response(
          JSON.stringify({
            error: "Coupon code must be a string.",
            code: "COUPON_INVALID",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      cleanCoupon = rawCoupon.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{1,32}$/.test(cleanCoupon)) {
        return new Response(
          JSON.stringify({
            error: "Invalid coupon code format. Code must be 1-32 alphanumeric characters, dashes, or underscores.",
            code: "COUPON_INVALID",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Honeypot Bot Trap
    if (honeypot && String(honeypot).trim() !== "") {
      return new Response(
        JSON.stringify({ error: "Invalid submission detected." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Cloudflare Turnstile Verification (Secret stored exclusively in environment)
    const turnstileSecret =
      Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY") ||
      Deno.env.get("TURNSTILE_SECRET_KEY");

    if (!turnstileSecret) {
      console.error("[checkout-gate] CLOUDFLARE_TURNSTILE_SECRET_KEY missing from environment!");
      return new Response(
        JSON.stringify({ error: "Checkout security service misconfigured. Contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!turnstile_token || String(turnstile_token).trim() === "") {
      return new Response(
        JSON.stringify({
          error: "Security verification token missing. Please complete the verification challenge.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const verifyFormData = new FormData();
    verifyFormData.append("secret", turnstileSecret);
    verifyFormData.append("response", turnstile_token);
    if (finalIp !== "unknown") {
      verifyFormData.append("remoteip", finalIp);
    }

    const turnstileRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: verifyFormData,
      }
    );
    const turnstileOutcome = await turnstileRes.json();
    if (!turnstileOutcome.success) {
      console.warn("[checkout-gate] Turnstile validation failed:", turnstileOutcome);
      return new Response(
        JSON.stringify({
          error: "Security verification failed. Please complete the challenge and retry.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Execute create_verified_order_guest exclusively via service_role:
    // Guarantees user_id = null and enforces per-phone unconfirmed order velocity in SQL
    const { data, error } = await adminClient.rpc("create_verified_order_guest", {
      p_customer: customer,
      p_items: items,
      p_whatsapp_message: whatsapp_message || null,
      p_honeypot: honeypot || null,
      p_promo_code: promo_code || null,
      p_coupon_code: cleanCoupon || null,
    });

    if (error) {
      const isCouponInvalid =
        (typeof error.message === "string" && error.message.includes("COUPON_INVALID")) ||
        error.code === "COUPON_INVALID";
      return new Response(
        JSON.stringify({
          error: error.message,
          code: isCouponInvalid ? "COUPON_INVALID" : (error.code || "ORDER_ERROR"),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const e = err as Error;
    return new Response(
      JSON.stringify({ error: e.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
