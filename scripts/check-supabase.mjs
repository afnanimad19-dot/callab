// Supabase connection self-test.
//
// Verifies that the app can actually read and write every table it needs,
// using the SAME REST path the app uses at runtime (src/lib/db.ts).
//
// Your keys are read from the environment and never printed. Run it as:
//
//   SUPABASE_URL="https://<ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<service_role key>" \
//   node scripts/check-supabase.mjs
//
// A green run means Netlify will work once the same two variables are set there.

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("\n✗ Missing env vars.\n");
  console.error("  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, e.g.:\n");
  console.error('  SUPABASE_URL="https://xxxx.supabase.co" \\');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \\');
  console.error("  node scripts/check-supabase.mjs\n");
  process.exit(1);
}

// Every table the app touches, with the column shape from supabase/schema.sql.
const TABLES = [
  "users",
  "agents",
  "calls",
  "campaigns",
  "contacts",
  "phone_numbers",
  "webhooks",
  "knowledge_bases",
];

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(pathAndQuery, init) {
  return fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
}

function explain(status) {
  if (status === 401 || status === 403)
    return "auth rejected — are you using the SERVICE_ROLE key (not the anon key)?";
  if (status === 404)
    return "table not found — has supabase/schema.sql been run in this project?";
  return `unexpected HTTP ${status}`;
}

let allOk = true;

console.log(`\nChecking ${URL}\n`);

for (const table of TABLES) {
  const id = `test_${Math.random().toString(36).slice(2, 12)}`;
  const row = { id, probe: true, at: new Date().toISOString() };

  try {
    // 1) INSERT
    const ins = await rest(table, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id, user_id: "self-test", data: row }),
    });
    if (!ins.ok) {
      console.log(`✗ ${table.padEnd(16)} insert failed — ${explain(ins.status)}`);
      allOk = false;
      continue;
    }

    // 2) SELECT it back
    const sel = await rest(`${table}?select=data&id=eq.${id}`);
    const rows = sel.ok ? await sel.json() : [];
    const readOk = sel.ok && rows.length === 1 && rows[0].data?.id === id;

    // 3) DELETE (clean up the probe row)
    const del = await rest(`${table}?id=eq.${id}`, { method: "DELETE" });

    if (readOk && del.ok) {
      console.log(`✓ ${table.padEnd(16)} read + write OK`);
    } else if (!readOk) {
      console.log(`✗ ${table.padEnd(16)} wrote but could not read back — ${explain(sel.status)}`);
      allOk = false;
    } else {
      console.log(`✗ ${table.padEnd(16)} wrote but cleanup delete failed — ${explain(del.status)}`);
      allOk = false;
    }
  } catch (e) {
    console.log(`✗ ${table.padEnd(16)} network error — ${e.message}`);
    allOk = false;
  }
}

console.log(
  allOk
    ? "\n✓ All tables working. Set these same two variables in Netlify and the live app will persist to Supabase.\n"
    : "\n✗ Some checks failed — see the notes above.\n"
);
process.exit(allOk ? 0 : 1);
