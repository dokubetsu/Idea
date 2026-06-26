import { createClient } from "@/shared/lib/supabase/client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const V    = "/api/v1";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function token() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init: RequestInit = {}, retries = 2): Promise<T> {
  const t   = await token();
  
  // Timeout handling using AbortController (default 15 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE}${V}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...init.headers,
      },
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      // FastAPI validation errors return detail as an array of {loc, msg, type} objects
      const detail = Array.isArray(err.detail)
        ? err.detail.map((e: { loc?: string[]; msg?: string }) =>
            e.loc ? `${e.loc.slice(-1)[0]}: ${e.msg}` : e.msg
          ).join(" · ")
        : (err.detail ?? "API error");
      throw new ApiError(res.status, detail);
    }
    
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    const errName = error instanceof Error ? error.name : "";
    if (errName === "AbortError") {
      throw new ApiError(408, "Request timeout");
    }

    // Auto-retry for 5xx server errors and network fetch errors (TypeError)
    const isServerError = error instanceof ApiError && error.status >= 500;
    const isNetworkError = error instanceof TypeError;
    
    if (retries > 0 && (isServerError || isNetworkError)) {
      // Exponential backoff delay (300ms, then 600ms)
      await new Promise(resolve => setTimeout(resolve, (3 - retries) * 300));
      return request<T>(path, init, retries - 1);
    }
    
    throw error;
  }

}

export const apiClient = {
  get:    <T>(p: string, init?: RequestInit)             => request<T>(p, init),
  post:   <T>(p: string, b: unknown, init?: RequestInit) => request<T>(p, { ...init, method: "POST",  body: JSON.stringify(b) }),
  patch:  <T>(p: string, b: unknown, init?: RequestInit) => request<T>(p, { ...init, method: "PATCH", body: JSON.stringify(b) }),
  delete: <T>(p: string, init?: RequestInit)             => request<T>(p, { ...init, method: "DELETE" }),
};
