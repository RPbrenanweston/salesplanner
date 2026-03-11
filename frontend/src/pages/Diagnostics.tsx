/**
 * @crumb diagnostics
 * @id salesblock-diagnostics
 * @area Debug
 * @intent Runtime diagnostic page to identify why list creation fails silently
 * @responsibilities Run sequential auth/user/org/RLS/INSERT/SELECT tests; report pass/fail with details
 */
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warn';
  detail: string;
  data?: unknown;
}

export default function Diagnostics() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const updateResult = (index: number, update: Partial<TestResult>) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, ...update } : r));
  };

  const runDiagnostics = async () => {
    setRunning(true);
    const tests: TestResult[] = [
      { name: '1. Auth Session', status: 'pending', detail: '' },
      { name: '2. Auth User (getUser)', status: 'pending', detail: '' },
      { name: '3. Users Table Row', status: 'pending', detail: '' },
      { name: '4. Organization Row', status: 'pending', detail: '' },
      { name: '5. RPC get_user_org_id()', status: 'pending', detail: '' },
      { name: '6. Existing Lists (SELECT)', status: 'pending', detail: '' },
      { name: '7. Test INSERT into lists', status: 'pending', detail: '' },
      { name: '8. Read-back test list', status: 'pending', detail: '' },
      { name: '9. Cleanup test list', status: 'pending', detail: '' },
      { name: '10. Final Lists Count', status: 'pending', detail: '' },
    ];
    setResults([...tests]);

    let authUid: string | null = null;
    let orgId: string | null = null;
    let testListId: string | null = null;

    // ─── Test 1: Auth Session ───
    updateResult(0, { status: 'running', detail: 'Checking session...' });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        updateResult(0, { status: 'fail', detail: `getSession error: ${error.message}`, data: error });
      } else if (!session) {
        updateResult(0, { status: 'fail', detail: 'No active session — not logged in' });
      } else {
        updateResult(0, {
          status: 'pass',
          detail: `Session active. User: ${session.user.email}. Expires: ${new Date(session.expires_at! * 1000).toISOString()}`,
          data: { email: session.user.email, expires_at: session.expires_at, role: session.user.role },
        });
        authUid = session.user.id;
      }
    } catch (e) {
      updateResult(0, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 2: Auth User ───
    updateResult(1, { status: 'running', detail: 'Calling getUser()...' });
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        updateResult(1, { status: 'fail', detail: `getUser error: ${error.message}`, data: error });
      } else if (!user) {
        updateResult(1, { status: 'fail', detail: 'getUser returned null' });
      } else {
        updateResult(1, {
          status: 'pass',
          detail: `auth.uid() = ${user.id}`,
          data: { id: user.id, email: user.email, role: user.role },
        });
        authUid = user.id;
      }
    } catch (e) {
      updateResult(1, { status: 'fail', detail: `Exception: ${e}` });
    }

    if (!authUid) {
      updateResult(2, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(3, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(4, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(5, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(6, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(7, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(8, { status: 'fail', detail: 'Skipped — no auth user' });
      updateResult(9, { status: 'fail', detail: 'Skipped — no auth user' });
      setRunning(false);
      return;
    }

    // ─── Test 3: Users Table Row ───
    updateResult(2, { status: 'running', detail: 'Querying users table...' });
    try {
      const { data, error, status, statusText } = await supabase
        .from('users')
        .select('id, org_id, email, display_name, role, subscription_status')
        .eq('id', authUid)
        .single();

      if (error) {
        updateResult(2, {
          status: 'fail',
          detail: `Users query failed (HTTP ${status} ${statusText}): ${error.message} | code: ${error.code} | hint: ${error.hint || 'none'}`,
          data: error,
        });
      } else if (!data) {
        updateResult(2, { status: 'fail', detail: 'No row returned — user row missing from public.users!' });
      } else {
        const orgIdVal = data.org_id;
        orgId = orgIdVal;
        const orgIdStatus = orgIdVal ? 'pass' : 'fail';
        updateResult(2, {
          status: orgIdStatus,
          detail: orgIdVal
            ? `User found. org_id = ${orgIdVal}, role = ${data.role}, subscription = ${data.subscription_status}`
            : `User found BUT org_id is NULL! This will cause RLS INSERT to fail (NULL = NULL is false in SQL)`,
          data,
        });
      }
    } catch (e) {
      updateResult(2, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 4: Organization Row ───
    updateResult(3, { status: 'running', detail: 'Querying organizations...' });
    try {
      if (!orgId) {
        updateResult(3, { status: 'fail', detail: 'Skipped — org_id is NULL on user row' });
      } else {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, created_at')
          .eq('id', orgId)
          .single();

        if (error) {
          updateResult(3, { status: 'fail', detail: `Org query error: ${error.message}`, data: error });
        } else if (!data) {
          updateResult(3, { status: 'fail', detail: `No org found with id ${orgId} — orphan reference!` });
        } else {
          updateResult(3, {
            status: 'pass',
            detail: `Org found: "${data.name}" (${data.id})`,
            data,
          });
        }
      }
    } catch (e) {
      updateResult(3, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 5: RPC get_user_org_id() ───
    updateResult(4, { status: 'running', detail: 'Calling get_user_org_id() RPC...' });
    try {
      const { data, error } = await supabase.rpc('get_user_org_id');
      if (error) {
        updateResult(4, {
          status: 'fail',
          detail: `RPC error: ${error.message} | code: ${error.code}`,
          data: error,
        });
      } else {
        const rpcOrgId = data;
        const matches = rpcOrgId === orgId;
        updateResult(4, {
          status: rpcOrgId ? (matches ? 'pass' : 'warn') : 'fail',
          detail: rpcOrgId
            ? `RPC returned: ${rpcOrgId}${matches ? ' (matches users table)' : ` — MISMATCH! users.org_id=${orgId}`}`
            : 'RPC returned NULL — RLS INSERT will fail!',
          data: { rpc_result: rpcOrgId, users_org_id: orgId, matches },
        });
      }
    } catch (e) {
      updateResult(4, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 6: Existing Lists (SELECT) ───
    updateResult(5, { status: 'running', detail: 'Fetching existing lists...' });
    try {
      const { data, error, count } = await supabase
        .from('lists')
        .select('id, name, org_id, owner_id, is_shared, created_at', { count: 'exact' });

      if (error) {
        updateResult(5, { status: 'fail', detail: `Lists SELECT error: ${error.message}`, data: error });
      } else {
        updateResult(5, {
          status: 'pass',
          detail: `Found ${data?.length ?? 0} lists (count=${count})`,
          data: data?.map(l => ({ id: l.id, name: l.name, org_id: l.org_id, owner_id: l.owner_id })),
        });
      }
    } catch (e) {
      updateResult(5, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 7: Test INSERT ───
    updateResult(6, { status: 'running', detail: 'Inserting test list...' });
    try {
      const insertPayload = {
        org_id: orgId,
        owner_id: authUid,
        name: `__DIAG_TEST_${Date.now()}`,
        description: 'Diagnostic test list — safe to delete',
        filter_criteria: { filters: [], autoRefresh: false },
        is_shared: false,
      };

      console.log('[DIAG] INSERT payload:', JSON.stringify(insertPayload, null, 2));

      const { data, error, status, statusText } = await supabase
        .from('lists')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        updateResult(6, {
          status: 'fail',
          detail: `INSERT FAILED (HTTP ${status} ${statusText}): ${error.message} | code: ${error.code} | hint: ${error.hint || 'none'} | details: ${error.details || 'none'}`,
          data: { error, payload: insertPayload },
        });
      } else if (!data) {
        updateResult(6, {
          status: 'fail',
          detail: 'INSERT returned no data — .select().single() returned null despite no error!',
          data: { payload: insertPayload },
        });
      } else {
        testListId = data.id;
        updateResult(6, {
          status: 'pass',
          detail: `INSERT succeeded! List ID: ${data.id}, name: ${data.name}`,
          data,
        });
      }
    } catch (e) {
      updateResult(6, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 8: Read-back ───
    updateResult(7, { status: 'running', detail: 'Reading back test list...' });
    try {
      if (!testListId) {
        updateResult(7, { status: 'fail', detail: 'Skipped — INSERT did not return a list ID' });
      } else {
        const { data, error } = await supabase
          .from('lists')
          .select('*')
          .eq('id', testListId)
          .single();

        if (error) {
          updateResult(7, {
            status: 'fail',
            detail: `Read-back FAILED: ${error.message} | code: ${error.code} — list was inserted but cannot be read back (RLS SELECT issue?)`,
            data: error,
          });
        } else if (!data) {
          updateResult(7, { status: 'fail', detail: 'Read-back returned null — list does not exist after INSERT!' });
        } else {
          updateResult(7, {
            status: 'pass',
            detail: `Read-back succeeded. List exists with id=${data.id}, name=${data.name}`,
            data,
          });
        }
      }
    } catch (e) {
      updateResult(7, { status: 'fail', detail: `Exception: ${e}` });
    }

    // ─── Test 9: Cleanup ───
    updateResult(8, { status: 'running', detail: 'Cleaning up test list...' });
    try {
      if (!testListId) {
        updateResult(8, { status: 'warn', detail: 'No test list to clean up' });
      } else {
        const { error } = await supabase
          .from('lists')
          .delete()
          .eq('id', testListId);

        if (error) {
          updateResult(8, {
            status: 'warn',
            detail: `Cleanup failed: ${error.message} — test list "${testListId}" remains in DB, delete manually`,
            data: error,
          });
        } else {
          updateResult(8, { status: 'pass', detail: `Test list deleted successfully` });
        }
      }
    } catch (e) {
      updateResult(8, { status: 'warn', detail: `Cleanup exception: ${e}` });
    }

    // ─── Test 10: Final Count ───
    updateResult(9, { status: 'running', detail: 'Final list count...' });
    try {
      const { count, error } = await supabase
        .from('lists')
        .select('*', { count: 'exact', head: true });

      if (error) {
        updateResult(9, { status: 'fail', detail: `Count error: ${error.message}`, data: error });
      } else {
        updateResult(9, {
          status: 'pass',
          detail: `Total lists in DB (visible to this user): ${count}`,
          data: { count },
        });
      }
    } catch (e) {
      updateResult(9, { status: 'fail', detail: `Exception: ${e}` });
    }

    setRunning(false);
  };

  const statusIcon = (s: TestResult['status']) => {
    switch (s) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warn': return '⚠️';
      case 'running': return '⏳';
      default: return '⬜';
    }
  };

  const statusColor = (s: TestResult['status']) => {
    switch (s) {
      case 'pass': return 'text-green-600 dark:text-green-400';
      case 'fail': return 'text-red-600 dark:text-red-400';
      case 'warn': return 'text-yellow-600 dark:text-yellow-400';
      case 'running': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-void-950 text-gray-900 dark:text-white p-8 font-mono">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">SalesBlock Diagnostics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Tests the full list creation pipeline: auth → user → org → RLS → INSERT → read-back
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={running}
          className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
            running
              ? 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-indigo-electric hover:bg-indigo-electric/80 text-white'
          }`}
        >
          {running ? 'Running diagnostics...' : 'Run Diagnostics'}
        </button>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  r.status === 'fail'
                    ? 'border-red-500/40 bg-red-50 dark:bg-red-950/30'
                    : r.status === 'pass'
                    ? 'border-green-500/20 bg-green-50 dark:bg-green-950/20'
                    : r.status === 'warn'
                    ? 'border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20'
                    : 'border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{statusIcon(r.status)}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm ${statusColor(r.status)}`}>
                      {r.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 break-all whitespace-pre-wrap">
                      {r.detail}
                    </div>
                    {r.data !== undefined && r.data !== null && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                          Raw data
                        </summary>
                        <pre className="mt-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 p-2 rounded overflow-auto max-h-48">
                          {JSON.stringify(r.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-8 space-y-1">
          <p>This page tests the exact same Supabase client and auth context as the ListBuilderModal.</p>
          <p>If Test 7 (INSERT) fails, the error message will reveal the exact RLS or schema violation.</p>
          <p>Test list is auto-cleaned in Test 9. If cleanup fails, look for lists named "__DIAG_TEST_*".</p>
        </div>
      </div>
    </div>
  );
}
