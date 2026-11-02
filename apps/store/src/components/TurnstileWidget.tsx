import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (error: unknown) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (err?: unknown) => void;
  onExpire?: () => void;
  className?: string;
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className = "",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Cloudflare Turnstile Site Key:
  // Fallbacks to Cloudflare's official always-passing testing sitekey for development
  const siteKey =
    import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  useEffect(() => {
    let isCancelled = false;

    const renderWidget = () => {
      if (isCancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token: string) => {
            if (!isCancelled) onVerify(token);
          },
          "error-callback": (err: unknown) => {
            if (!isCancelled && onError) onError(err);
          },
          "expired-callback": () => {
            if (!isCancelled && onExpire) onExpire();
          },
        });
      } catch (err) {
        console.warn("[Turnstile] Render error:", err);
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const scriptId = "cf-turnstile-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => renderWidget();
        document.head.appendChild(script);
      } else {
        const checkInterval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(checkInterval);
            renderWidget();
          }
        }, 100);
        return () => clearInterval(checkInterval);
      }
    }

    return () => {
      isCancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup issues
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onError, onExpire]);

  return <div ref={containerRef} className={`my-2 min-h-[65px] ${className}`} />;
}
