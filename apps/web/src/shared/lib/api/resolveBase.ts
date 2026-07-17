/**
 * Resolve the API base URL for the browser client.
 * Extracted for unit testing without importing the full client (which needs window/supabase).
 */
export function resolveApiBase(
  url: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const isProd = nodeEnv === "production";
  if (isProd) {
    if (!url || !url.trim()) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be set in production. Refusing to default to localhost.",
      );
    }
    const trimmed = url.trim();
    if (
      trimmed.includes("localhost") ||
      trimmed.includes("127.0.0.1") ||
      trimmed.startsWith("http://")
    ) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be a non-localhost https URL in production.",
      );
    }
    return trimmed.replace(/\/$/, "");
  }
  return (url?.trim() || "http://localhost:8000").replace(/\/$/, "");
}
