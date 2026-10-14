// Shared server helpers: Supabase admin client, caller check, Google Sheets REST.
import { createClient } from "@supabase/supabase-js";
import { JWT } from "google-auth-library";

export function env(name) { return process.env[name] || ""; }

let _admin = null;
export function admin() {
  if (!_admin) _admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  return _admin;
}

/** Who is calling? Returns {user, role} or null. Token = the signed-in user's access token. */
export async function caller(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data || !data.user) return null;
  const { data: p } = await admin().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!p) return null;
  return { user: data.user, role: p.role };
}

export async function loadDocs(collections) {
  const { data, error } = await admin().from("docs").select("collection,id,data").in("collection", collections);
  if (error) throw new Error("Supabase read failed: " + error.message);
  const out = Object.fromEntries(collections.map((c) => [c, []]));
  for (const r of data) out[r.collection].push({ ...r.data, id: r.id, _data: r.data });
  return out;
}

let _jwt = null;
async function googleToken() {
  if (!_jwt) {
    _jwt = new JWT({
      email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      key: env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  const { token } = await _jwt.getAccessToken();
  return token;
}

async function gfetch(url, opts = {}) {
  const token = await googleToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (body.error && body.error.message) || r.statusText;
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return body;
}

const BASE = "https://sheets.googleapis.com/v4/spreadsheets/";

export async function sheetTitle(id) {
  const b = await gfetch(BASE + id + "?fields=properties.title");
  return b.properties.title;
}

export async function getValues(id, range) {
  const b = await gfetch(BASE + id + "/values/" + encodeURIComponent(range));
  return b.values || [];
}

/** data: [{range, values}] — one round trip, parsed like typing in the Sheets UI */
export async function writeRanges(id, data) {
  if (!data.length) return;
  await gfetch(BASE + id + "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
}
