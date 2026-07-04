/**
 * RLS Verification Script
 *
 * Tests that the client (user role) CANNOT access:
 * 1. time_entries (lawyer-only)
 * 2. internal_notes (lawyer-only)
 * 3. timeline_events with null client_description
 *
 * And CAN access:
 * 4. invoices on their own matter
 * 5. case_tasks on their own matter
 * 6. timeline_events with non-null client_description
 *
 * Usage:
 *   Set SUPABASE_URL and SUPABASE_ANON_KEY env vars, then:
 *   npx tsx scripts/verify-rls.ts
 *
 * Requires: the seed_docket.sql data to be loaded.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

// Client credentials from seed
const CLIENT_EMAIL = "priya.patel@lead.ai";
const CLIENT_PASSWORD = "Password123!";

// IDs from seed
const CLIENT_MATTER_ID = "20000000-0000-0000-0000-000000000001"; // Priya's case
const LAWYER_ID = "10000000-0000-0000-0000-000000000001";

interface TestResult {
  test: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

async function supabaseRequest(path: string, token: string, method = "GET", body?: unknown) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: res.status, data: await res.json().catch(() => null) };
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function runTests() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  LeAd RLS Verification — Client (Priya Patel)");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
    process.exit(1);
  }

  // Sign in as client
  console.log("Signing in as client (priya.patel@lead.ai)...");
  let token: string;
  try {
    token = await signIn(CLIENT_EMAIL, CLIENT_PASSWORD);
    console.log("✓ Signed in successfully\n");
  } catch (err) {
    console.error("✗ Failed to sign in:", err);
    process.exit(1);
  }

  // ── Test 1: Client CANNOT read time_entries ──────────────────
  {
    const { status, data } = await supabaseRequest(
      `time_entries?matter_id=eq.${CLIENT_MATTER_ID}`,
      token
    );
    const rows = Array.isArray(data) ? data.length : -1;
    const passed = rows === 0;
    results.push({
      test: "Client cannot read time_entries",
      passed,
      detail: passed
        ? "Returned 0 rows (RLS blocked)"
        : `FAIL: Returned ${rows} rows — time entries are exposed!`,
    });
  }

  // ── Test 2: Client CANNOT read internal_notes ────────────────
  {
    const { status, data } = await supabaseRequest(
      `internal_notes?matter_id=eq.${CLIENT_MATTER_ID}`,
      token
    );
    const rows = Array.isArray(data) ? data.length : -1;
    const passed = rows === 0;
    results.push({
      test: "Client cannot read internal_notes",
      passed,
      detail: passed
        ? "Returned 0 rows (RLS blocked)"
        : `FAIL: Returned ${rows} rows — internal notes are exposed!`,
    });
  }

  // ── Test 3: Client cannot see timeline events without client_description
  {
    const { status, data } = await supabaseRequest(
      `timeline_events?matter_id=eq.${CLIENT_MATTER_ID}&client_description=is.null`,
      token
    );
    const rows = Array.isArray(data) ? data.length : -1;
    const passed = rows === 0;
    results.push({
      test: "Client cannot see timeline events with null client_description",
      passed,
      detail: passed
        ? "Returned 0 rows (RLS filtered correctly)"
        : `FAIL: Returned ${rows} rows — lawyer-only timeline events are exposed!`,
    });
  }

  // ── Test 4: Client CAN read invoices on their matter ─────────
  {
    const { status, data } = await supabaseRequest(
      `invoices?matter_id=eq.${CLIENT_MATTER_ID}`,
      token
    );
    const rows = Array.isArray(data) ? data.length : 0;
    const passed = rows > 0;
    results.push({
      test: "Client can read invoices on their matter",
      passed,
      detail: passed
        ? `Returned ${rows} invoices (access granted)`
        : "FAIL: Client cannot access their own invoices",
    });
  }

  // ── Test 5: Client CAN read case_tasks on their matter ───────
  {
    const { status, data } = await supabaseRequest(
      `case_tasks?matter_id=eq.${CLIENT_MATTER_ID}`,
      token
    );
    const rows = Array.isArray(data) ? data.length : 0;
    const passed = rows > 0;
    results.push({
      test: "Client can read case_tasks on their matter",
      passed,
      detail: passed
        ? `Returned ${rows} tasks (access granted)`
        : "FAIL: Client cannot access their own tasks",
    });
  }

  // ── Test 6: Client CAN see timeline events with client_description
  {
    const { status, data } = await supabaseRequest(
      `timeline_events?matter_id=eq.${CLIENT_MATTER_ID}&client_description=not.is.null`,
      token
    );
    const rows = Array.isArray(data) ? data.length : 0;
    const passed = rows > 0;
    results.push({
      test: "Client can see timeline events with client_description",
      passed,
      detail: passed
        ? `Returned ${rows} events (filtered correctly)`
        : "FAIL: Client cannot see any timeline events",
    });
  }

  // ── Test 7: Client CANNOT write to internal_notes ────────────
  {
    const { status, data } = await supabaseRequest(
      "internal_notes",
      token,
      "POST",
      { matter_id: CLIENT_MATTER_ID, author_id: LAWYER_ID, content: "Should not work" }
    );
    // Expect 403 or empty/error response
    const passed = status === 403 || status === 401 || (Array.isArray(data) && data.length === 0);
    results.push({
      test: "Client cannot write to internal_notes",
      passed,
      detail: passed
        ? `Request blocked (status ${status})`
        : `FAIL: Request returned status ${status} — write may have succeeded!`,
    });
  }

  // ── Test 8: Client CANNOT write to time_entries ──────────────
  {
    const { status, data } = await supabaseRequest(
      "time_entries",
      token,
      "POST",
      { matter_id: CLIENT_MATTER_ID, lawyer_id: LAWYER_ID, activity: "Hack", hours: 1, entry_date: "2024-01-01" }
    );
    const passed = status === 403 || status === 401 || (Array.isArray(data) && data.length === 0);
    results.push({
      test: "Client cannot write to time_entries",
      passed,
      detail: passed
        ? `Request blocked (status ${status})`
        : `FAIL: Request returned status ${status} — write may have succeeded!`,
    });
  }

  // ── Print Results ────────────────────────────────────────────
  console.log("───────────────────────────────────────────────────────────");
  console.log("  RESULTS");
  console.log("───────────────────────────────────────────────────────────\n");

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const color = r.passed ? "\x1b[32m" : "\x1b[31m";
    console.log(`${color}${icon}\x1b[0m ${r.test}`);
    console.log(`  ${r.detail}\n`);
    if (!r.passed) allPassed = false;
  }

  console.log("═══════════════════════════════════════════════════════════");
  if (allPassed) {
    console.log("\x1b[32m  ALL TESTS PASSED — RLS is correctly enforced.\x1b[0m");
  } else {
    console.log("\x1b[31m  SOME TESTS FAILED — RLS has gaps!\x1b[0m");
  }
  console.log("═══════════════════════════════════════════════════════════");

  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
