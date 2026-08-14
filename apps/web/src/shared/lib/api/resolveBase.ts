/**
 * Resolve the API base URL for the browser client.
 * Extracted for unit testing without importing the full client (which needs window/supabase).
 */
export function resolveApiBase(
  url: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const isProd = nodeEnv === "production";
  const trimmed = url?.trim() || "";

  if (isProd) {
    if (!trimmed) {
      return "https://api.lead.ai";
    }

    if (trimmed.startsWith("http://")) {
      const isStrictProd =
        process.env.APP_ENV === "production" ||
        process.env.NEXT_PUBLIC_APP_ENV === "production" ||
        process.env.VERCEL_ENV === "production" ||
        process.env.RENDER === "true";

      if (isStrictProd || (!trimmed.includes("localhost") && !trimmed.includes("127.0.0.1"))) {
        throw new Error(
          "NEXT_PUBLIC_API_URL must be a non-localhost https URL in production.",
        );
      }
      return trimmed.replace(/\/$/, "");
    }

    if (trimmed.includes("localhost") || trimmed.includes("127.0.0.1")) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be a non-localhost https URL in production.",
      );
    }

    return trimmed.replace(/\/$/, "");
  }

  return (trimmed || "http://localhost:8000").replace(/\/$/, "");
}



