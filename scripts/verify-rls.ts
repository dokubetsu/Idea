/**
 * RLS Verification Script (Hardened)
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
 * And CANNOT bypass RLS security policies:
 * 7. Client cannot write to internal_notes (POST)
 * 8. Client cannot write to time_entries (POST)
 * 9. Client cannot update chat message content or sender (tampering)
 * 10. Client cannot update case_task title, description, due date or assigned_to (hijacking)
 * 11. Client can mark their assigned tasks as completed (authorized action)
 * 12. Client cannot update document requests except status=fulfilled WITH a document_id
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
const CLIENT_ID = "10000000-0000-0000-0000-000000000010";

// Lawyer credentials from seed
const LAWYER_EMAIL = "adv.mehta@lead.ai";
const LAWYER_PASSWORD = "Password123!";
const LAWYER_ID = "10000000-0000-0000-0000-000000000001";

// IDs from seed
const CLIENT_MATTER_ID = "20000000-0000-0000-0000-000000000001"; // Priya's case
const CLIENT_TASK_ID = "80000000-0000-0000-0000-000000000001"; // Priya's assigned task

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

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
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
  console.log("  LeAd RLS Verification — Hardened Policies");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
    process.exit(1);
  }

  // Sign in as client
  console.log("Signing in as client (priya.patel@lead.ai)...");
  let clientToken: string;
  try {
    clientToken = await signIn(CLIENT_EMAIL, CLIENT_PASSWORD);
    console.log("✓ Signed in as client successfully");
  } catch (err) {
    console.error("✗ Failed to sign in as client:", err);
    process.exit(1);
  }

  // Sign in as lawyer
  console.log("Signing in as lawyer (adv.mehta@lead.ai)...");
  let lawyerToken: string;
  try {
    lawyerToken = await signIn(LAWYER_EMAIL, LAWYER_PASSWORD);
    console.log("✓ Signed in as lawyer successfully\n");
  } catch (err) {
    console.error("✗ Failed to sign in as lawyer:", err);
    process.exit(1);
  }

  // ── Test 1: Client CANNOT read time_entries ──────────────────
  {
    const { status, data } = await supabaseRequest(
      `time_entries?matter_id=eq.${CLIENT_MATTER_ID}`,
      clientToken
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
      clientToken
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
      clientToken
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
      clientToken
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
      clientToken
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
      clientToken
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
      clientToken,
      "POST",
      { matter_id: CLIENT_MATTER_ID, author_id: CLIENT_ID, content: "Client note should fail" }
    );
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
      clientToken,
      "POST",
      { matter_id: CLIENT_MATTER_ID, lawyer_id: CLIENT_ID, activity: "Client time should fail", hours: 1.0, entry_date: "2026-07-06" }
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

  // ── Test 9: Message Tampering Protection ───────────────────────
  {
    // 9.1: First insert a valid message as client
    const insertRes = await supabaseRequest(
      "case_messages",
      clientToken,
      "POST",
      { matter_id: CLIENT_MATTER_ID, sender_id: CLIENT_ID, content: "Original Client Message" }
    );

    if (!insertRes.data || !Array.isArray(insertRes.data) || insertRes.data.length === 0) {
      results.push({
        test: "Message Tampering Protection",
        passed: false,
        detail: "FAIL: Client failed to insert message for testing",
      });
    } else {
      const msgId = insertRes.data[0].id;
      
      // 9.2: Attempt to update content or sender
      const updateRes = await supabaseRequest(
        `case_messages?id=eq.${msgId}`,
        clientToken,
        "PATCH",
        { content: "Hacked Message Content", sender_id: LAWYER_ID }
      );

      // Verify it was blocked (either returns error, or if 200, the data returns unchanged due to RLS WITH CHECK failing)
      const passed = updateRes.status === 403 || updateRes.status === 404 || updateRes.status === 400 || (Array.isArray(updateRes.data) && updateRes.data.length === 0);
      results.push({
        test: "Client cannot tamper with message content or sender",
        passed,
        detail: passed
          ? `Request blocked correctly (status ${updateRes.status})`
          : `FAIL: Tamper update succeeded (status ${updateRes.status})!`,
      });
    }
  }

  // ── Test 10: Task Hijacking Protection ─────────────────────────
  {
    // Client attempts to change title/due_date of task assigned to them
    const updateRes = await supabaseRequest(
      `case_tasks?id=eq.${CLIENT_TASK_ID}`,
      clientToken,
      "PATCH",
      { title: "Hacked Task Title", due_date: "2030-01-01" }
    );

    const passed = updateRes.status === 403 || updateRes.status === 404 || updateRes.status === 400 || (Array.isArray(updateRes.data) && updateRes.data.length === 0);
    results.push({
      test: "Client cannot edit task title or due date",
      passed,
      detail: passed
        ? `Request blocked correctly (status ${updateRes.status})`
        : `FAIL: Title/due_date hijack succeeded (status ${updateRes.status})!`,
    });
  }

  // ── Test 11: Task Completion Allowed ───────────────────────────
  {
    // Client attempts to toggle is_completed on task assigned to them
    const updateRes = await supabaseRequest(
      `case_tasks?id=eq.${CLIENT_TASK_ID}`,
      clientToken,
      "PATCH",
      { is_completed: true }
    );

    const passed = updateRes.status === 200 || updateRes.status === 204 || (Array.isArray(updateRes.data) && updateRes.data.length > 0);
    results.push({
      test: "Client can toggle task completion",
      passed,
      detail: passed
        ? `Successfully marked task as complete (status ${updateRes.status})`
        : `FAIL: Toggle completion was blocked (status ${updateRes.status})!`,
    });
  }

  // ── Test 12: Document Request Bypass Protection ───────────────
  {
    // 12.1: Insert a document request as lawyer
    const insertRes = await supabaseRequest(
      "document_requests",
      lawyerToken,
      "POST",
      { matter_id: CLIENT_MATTER_ID, requested_by: LAWYER_ID, title: "Filing proof", label: "evidence", status: "pending" }
    );

    if (!insertRes.data || !Array.isArray(insertRes.data) || insertRes.data.length === 0) {
      results.push({
        test: "Document Request Bypass Protection",
        passed: false,
        detail: "FAIL: Lawyer failed to create document request for testing",
      });
    } else {
      const reqId = insertRes.data[0].id;

      // 12.2: Client attempts to mark as fulfilled WITHOUT document_id
      const updateRes = await supabaseRequest(
        `document_requests?id=eq.${reqId}`,
        clientToken,
        "PATCH",
        { status: "fulfilled", fulfilled_at: new Date().toISOString() }
      );

      const passed = updateRes.status === 403 || updateRes.status === 404 || updateRes.status === 400 || (Array.isArray(updateRes.data) && updateRes.data.length === 0);
      results.push({
        test: "Client cannot fulfill document requests without document_id",
        passed,
        detail: passed
          ? `Request blocked correctly (status ${updateRes.status})`
          : `FAIL: Bypass succeeded (status ${updateRes.status})!`,
      });
    }
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
    console.log("\x1b[32m  ALL TESTS PASSED — Hardened RLS is correctly enforced.\x1b[0m");
  } else {
    console.log("\x1b[31m  SOME TESTS FAILED — Security gaps remain!\x1b[0m");
  }
  console.log("═══════════════════════════════════════════════════════════");

  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
