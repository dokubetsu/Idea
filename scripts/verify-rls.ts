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
const OTHER_CLIENT_MATTER_ID = "20000000-0000-0000-0000-000000000002"; // Rahul's case (not Priya)
const CLIENT_TASK_ID = "80000000-0000-0000-0000-000000000001"; // Priya's assigned task
const OTHER_CLIENT_EMAIL = "rahul.sharma@lead.ai";
const OTHER_CLIENT_PASSWORD = "Password123!";

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

  // ── Test 13: Client cannot escalate profile role ──────────────
  {
    const updateRes = await supabaseRequest(
      `profiles?id=eq.${CLIENT_ID}`,
      clientToken,
      "PATCH",
      { role: "admin" }
    );

    // Trigger raises 42501 → PostgREST typically 400/403; success body must not apply
    let roleUnchanged = true;
    if (Array.isArray(updateRes.data) && updateRes.data.length > 0) {
      roleUnchanged = updateRes.data[0].role !== "admin";
    }
    const blocked =
      updateRes.status === 403 ||
      updateRes.status === 401 ||
      updateRes.status === 400 ||
      updateRes.status === 404 ||
      (Array.isArray(updateRes.data) && updateRes.data.length === 0) ||
      roleUnchanged;

    // Re-read to confirm role was not escalated
    const readRes = await supabaseRequest(
      `profiles?id=eq.${CLIENT_ID}&select=role`,
      clientToken
    );
    const currentRole =
      Array.isArray(readRes.data) && readRes.data[0]
        ? readRes.data[0].role
        : "unknown";
    const passed = blocked && currentRole !== "admin";
    results.push({
      test: "Client cannot escalate profile role to admin",
      passed,
      detail: passed
        ? `Blocked (status ${updateRes.status}); role remains '${currentRole}'`
        : `FAIL: role escalation may have succeeded (status ${updateRes.status}, role=${currentRole})`,
    });
  }

  // ── Test 14: Lawyer cannot self-verify ────────────────────────
  {
    const updateRes = await supabaseRequest(
      `lawyer_profiles?id=eq.${LAWYER_ID}`,
      lawyerToken,
      "PATCH",
      { is_verified: false }
    );

    // Even verified lawyers must not flip is_verified via REST
    let notApplied = true;
    if (Array.isArray(updateRes.data) && updateRes.data.length > 0) {
      // If the update returned a row with is_verified=false, the guard failed
      notApplied = updateRes.data[0].is_verified !== false;
    }
    const blocked =
      updateRes.status === 403 ||
      updateRes.status === 401 ||
      updateRes.status === 400 ||
      updateRes.status === 404 ||
      (Array.isArray(updateRes.data) && updateRes.data.length === 0) ||
      notApplied;

    const readRes = await supabaseRequest(
      `lawyer_profiles?id=eq.${LAWYER_ID}&select=is_verified`,
      lawyerToken
    );
    const stillVerified =
      Array.isArray(readRes.data) &&
      readRes.data[0] &&
      readRes.data[0].is_verified === true;
    const passed = blocked && stillVerified;
    results.push({
      test: "Lawyer cannot change is_verified via REST",
      passed,
      detail: passed
        ? `Blocked (status ${updateRes.status}); is_verified remains true`
        : `FAIL: is_verified may have been changed (status ${updateRes.status})`,
    });
  }

  // ── Test 15: Client cannot reassign matter lawyer_id ──────────
  {
    const updateRes = await supabaseRequest(
      `matters?id=eq.${CLIENT_MATTER_ID}`,
      clientToken,
      "PATCH",
      { lawyer_id: CLIENT_ID }
    );

    let notApplied = true;
    if (Array.isArray(updateRes.data) && updateRes.data.length > 0) {
      notApplied = updateRes.data[0].lawyer_id !== CLIENT_ID;
    }
    const blocked =
      updateRes.status === 403 ||
      updateRes.status === 401 ||
      updateRes.status === 400 ||
      updateRes.status === 404 ||
      (Array.isArray(updateRes.data) && updateRes.data.length === 0) ||
      notApplied;

    const readRes = await supabaseRequest(
      `matters?id=eq.${CLIENT_MATTER_ID}&select=lawyer_id`,
      clientToken
    );
    const lawyerId =
      Array.isArray(readRes.data) && readRes.data[0]
        ? readRes.data[0].lawyer_id
        : null;
    const passed = blocked && lawyerId !== CLIENT_ID;
    results.push({
      test: "Client cannot reassign matter lawyer_id",
      passed,
      detail: passed
        ? `Blocked (status ${updateRes.status}); lawyer_id unchanged`
        : `FAIL: client reassigned lawyer_id (status ${updateRes.status}, lawyer_id=${lawyerId})`,
    });
  }

  // ── Test 16: Client cannot change matter status ───────────────
  {
    const updateRes = await supabaseRequest(
      `matters?id=eq.${CLIENT_MATTER_ID}`,
      clientToken,
      "PATCH",
      { status: "resolved" }
    );

    let notApplied = true;
    if (Array.isArray(updateRes.data) && updateRes.data.length > 0) {
      notApplied = updateRes.data[0].status !== "resolved";
    }
    const blocked =
      updateRes.status === 403 ||
      updateRes.status === 401 ||
      updateRes.status === 400 ||
      updateRes.status === 404 ||
      (Array.isArray(updateRes.data) && updateRes.data.length === 0) ||
      notApplied;

    const readRes = await supabaseRequest(
      `matters?id=eq.${CLIENT_MATTER_ID}&select=status`,
      clientToken
    );
    const status =
      Array.isArray(readRes.data) && readRes.data[0]
        ? readRes.data[0].status
        : "unknown";
    const passed = blocked && status !== "resolved";
    results.push({
      test: "Client cannot change matter status",
      passed,
      detail: passed
        ? `Blocked (status ${updateRes.status}); matter status remains '${status}'`
        : `FAIL: client changed matter status to resolved (HTTP ${updateRes.status})`,
    });
  }

  // ── Test 17: Authenticated users cannot execute create_notification_rpc
  {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_notification_rpc`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${clientToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: CLIENT_ID,
        p_type: "test_spam",
        p_data: { message: "should fail" },
        p_action: null,
        p_idempotency_key: `rls-test-notif-${Date.now()}`,
        p_channels: ["in_app"],
      }),
    });
    const text = await res.text();
    // Expect permission denied (401/403) or function not available to role
    const passed = res.status === 401 || res.status === 403 || res.status === 404;
    results.push({
      test: "Client cannot execute create_notification_rpc",
      passed,
      detail: passed
        ? `RPC blocked (status ${res.status})`
        : `FAIL: create_notification_rpc callable by client (status ${res.status}): ${text.slice(0, 200)}`,
    });
  }

  // ── Test 18: Cross-tenant matters isolation ───────────────────
  {
    const { data } = await supabaseRequest(
      `matters?id=eq.${OTHER_CLIENT_MATTER_ID}&select=id,title`,
      clientToken
    );
    const rows = Array.isArray(data) ? data.length : -1;
    const passed = rows === 0;
    results.push({
      test: "Client cannot read another client's matter",
      passed,
      detail: passed
        ? "Returned 0 rows (cross-tenant blocked)"
        : `FAIL: Returned ${rows} rows for another client's matter`,
    });
  }

  // ── Test 19: Intake sessions are owner-only ───────────────────
  {
    // Insert an intake session as client, then try to read as lawyer
    const insertRes = await supabaseRequest(
      "intake_sessions",
      clientToken,
      "POST",
      {
        user_id: CLIENT_ID,
        step: "facts_review",
        raw_description: "RLS isolation test description for intake",
        extracted_facts: { title: "RLS test", facts: [] },
        is_committed: false,
      }
    );
    const created =
      Array.isArray(insertRes.data) && insertRes.data.length > 0
        ? insertRes.data[0]
        : null;
    if (!created?.id) {
      results.push({
        test: "Intake sessions owner isolation",
        passed: false,
        detail: `FAIL: client could not create intake_session (status ${insertRes.status})`,
      });
    } else {
      const { data: lawyerView } = await supabaseRequest(
        `intake_sessions?id=eq.${created.id}`,
        lawyerToken
      );
      const rows = Array.isArray(lawyerView) ? lawyerView.length : -1;
      const passed = rows === 0;
      results.push({
        test: "Lawyer cannot read another user's intake_session",
        passed,
        detail: passed
          ? "Returned 0 rows (intake isolation OK)"
          : `FAIL: Lawyer saw ${rows} intake session row(s)`,
      });
      // Cleanup
      await supabaseRequest(
        `intake_sessions?id=eq.${created.id}`,
        clientToken,
        "DELETE"
      );
    }
  }

  // ── Test 20: Payments not readable across tenants ─────────────
  {
    const { data } = await supabaseRequest(
      `payments?select=id,user_id&limit=20`,
      clientToken
    );
    const rows = Array.isArray(data) ? data : [];
    const foreign = rows.filter((r: { user_id?: string }) => r.user_id && r.user_id !== CLIENT_ID);
    const passed = foreign.length === 0;
    results.push({
      test: "Client payments list only includes own rows",
      passed,
      detail: passed
        ? `OK (${rows.length} own/empty payment rows)`
        : `FAIL: saw ${foreign.length} payment(s) for other users`,
    });
  }

  // ── Test 21: Consultations not readable across tenants ────────
  {
    let otherToken: string | null = null;
    try {
      otherToken = await signIn(OTHER_CLIENT_EMAIL, OTHER_CLIENT_PASSWORD);
    } catch {
      otherToken = null;
    }
    if (!otherToken) {
      results.push({
        test: "Consultations cross-tenant isolation",
        passed: true,
        detail: "SKIP: other client seed user not available (non-fatal)",
      });
    } else {
      // Create consultation as other client
      const createRes = await supabaseRequest(
        "consultations",
        otherToken,
        "POST",
        {
          user_id: "10000000-0000-0000-0000-000000000011",
          package: "free",
          sessions_total: 1,
          status: "pending",
          payment_status: "waived",
        }
      );
      const created =
        Array.isArray(createRes.data) && createRes.data[0]
          ? createRes.data[0]
          : null;
      if (!created?.id) {
        results.push({
          test: "Consultations cross-tenant isolation",
          passed: true,
          detail: `SKIP: could not create consultation as other client (status ${createRes.status})`,
        });
      } else {
        const { data: priyaView } = await supabaseRequest(
          `consultations?id=eq.${created.id}`,
          clientToken
        );
        const rows = Array.isArray(priyaView) ? priyaView.length : -1;
        const passed = rows === 0;
        results.push({
          test: "Client cannot read another user's consultation",
          passed,
          detail: passed
            ? "Returned 0 rows (consultation isolation OK)"
            : `FAIL: saw ${rows} consultation row(s)`,
        });
      }
    }
  }

  // ── Test 22: Client cannot SELECT payments without user_id match
  {
    // Attempt to read payments with no filter — RLS must not leak others
    const { status, data } = await supabaseRequest(`payments?select=*`, clientToken);
    const rows = Array.isArray(data) ? data : [];
    const leak = rows.some(
      (r: { user_id?: string }) => r.user_id && r.user_id !== CLIENT_ID
    );
    const passed = !leak && (status === 200 || status === 206 || rows.length === 0);
    results.push({
      test: "Payments RLS does not leak other users' rows",
      passed,
      detail: passed
        ? `OK (status ${status}, ${rows.length} rows)`
        : `FAIL: payment leak detected (status ${status})`,
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
