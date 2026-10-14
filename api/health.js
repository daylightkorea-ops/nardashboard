// GET /api/health — setup checker shown on the placeholder page.
// Never prints secret values: only their shape (length, prefix, problems).
import { env, admin, sheetTitle } from "../lib/server.js";

function jwtRole(v) {
  try { return JSON.parse(Buffer.from(v.split(".")[1], "base64url").toString()).role || ""; } catch { return ""; }
}
function shape(v) {
  const bad = [];
  if (/[^\x20-\x7E\n\r]/.test(v)) bad.push("한글이나 특수문자가 섞여 있어요");
  if (/\s/.test(v.replace(/\\n/g, "")) && !v.includes("PRIVATE KEY")) bad.push("값 중간에 공백이 있어요");
  if (v.includes("#")) bad.push("# 뒤 설명까지 같이 들어갔어요");
  return bad;
}
function checkVar(name) {
  const v = env(name);
  if (!v) return [false, "비어 있어요. Vercel → Settings → Environment Variables 에 추가 후 Redeploy"];
  const bad = shape(v);
  const info = "길이 " + v.length + "자, 시작: " + v.slice(0, 6) + "…";
  if (name === "SUPABASE_URL" && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v)) bad.push("https://xxxx.supabase.co 형식이 아니에요");
  if (name === "SUPABASE_ANON_KEY") {
    if (!/^(eyJ|sb_publishable_)/.test(v)) bad.push("anon 키는 eyJ 또는 sb_publishable_ 로 시작해요");
    else if (v.startsWith("eyJ") && jwtRole(v) !== "anon") bad.push("이건 anon 키가 아니라 '" + jwtRole(v) + "' 키예요");
  }
  if (name === "SUPABASE_SERVICE_ROLE_KEY") {
    if (!/^(eyJ|sb_secret_)/.test(v)) bad.push("service_role 키는 eyJ 또는 sb_secret_ 로 시작해요");
    else if (v.startsWith("eyJ") && jwtRole(v) !== "service_role") bad.push("이건 service_role 키가 아니라 '" + jwtRole(v) + "' 키예요. anon 키와 바뀌었는지 확인해주세요");
    if (v === env("SUPABASE_ANON_KEY")) bad.push("anon 키와 값이 똑같아요");
  }
  if (name === "GOOGLE_SERVICE_ACCOUNT_EMAIL" && !/\.iam\.gserviceaccount\.com$/.test(v)) bad.push("…@….iam.gserviceaccount.com 형식이어야 해요 (JSON의 client_email)");
  if (name === "GOOGLE_PRIVATE_KEY") {
    const k = v.replace(/\\n/g, "\n");
    if (!k.includes("-----BEGIN PRIVATE KEY-----") || !k.includes("-----END PRIVATE KEY-----")) bad.push("-----BEGIN PRIVATE KEY----- 부터 -----END PRIVATE KEY----- 까지 전부 들어가야 해요");
  }
  return bad.length ? [false, info + " · " + bad.join(" · ")] : [true, info];
}

export default async function handler(req, res) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"];
  const varOk = {};
  for (const v of vars) { const [ok, d] = checkVar(v); varOk[v] = ok; add("환경변수 " + v, ok, d); }

  let cfg = {};
  if (varOk.SUPABASE_URL && varOk.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await admin().from("docs").select("collection,id,data");
      if (error) throw error;
      const by = {}; for (const r of data) by[r.collection] = (by[r.collection] || 0) + 1;
      add("Supabase 데이터", data.length > 0, data.length ? Object.entries(by).map(([k, n]) => k + " " + n).join(", ") : "비어 있어요. 2_seed.sql 을 실행했나요?");
      cfg = Object.fromEntries(data.filter((r) => r.collection === "config").map((r) => [r.id, r.data]));
      const { data: ps, error: pe } = await admin().from("profiles").select("role");
      if (pe) throw pe;
      const roles = ps.map((p) => p.role);
      add("로그인 계정", roles.includes("owner") && roles.includes("staff"),
        "owner " + roles.filter((r) => r === "owner").length + "명, staff " + roles.filter((r) => r === "staff").length + "명" + (roles.includes("staff") && roles.includes("owner") ? "" : " · Users에서 계정을 만든 뒤 3_users.sql 을 다시 Run 해주세요"));
    } catch (e) {
      const m = (e && (e.message || e.msg)) || String(e);
      const hint = /relation .*docs.* does not exist|Could not find the table/i.test(m) ? " · 1_schema.sql 을 실행했는지 확인해주세요"
        : /Invalid API key|JWT|401/i.test(m) ? " · service_role 키가 이 프로젝트의 키가 맞는지 확인해주세요" : "";
      add("Supabase 연결", false, m + hint);
    }
  } else {
    add("Supabase 연결", false, "위의 SUPABASE 환경변수부터 고쳐주세요");
  }

  if (varOk.GOOGLE_SERVICE_ACCOUNT_EMAIL && varOk.GOOGLE_PRIVATE_KEY) {
    const sheets = [["NaR 작업표 (파이프라인)", cfg.pipeSheet], ["흠이 데일리 시트", cfg.heumiSheet], ["채널 성장 기록 시트", cfg.sheet]];
    for (const [label, s] of sheets) {
      if (!s || !s.id) { add(label, false, "Supabase 연결이 되면 같이 확인돼요"); continue; }
      try { add(label, true, "열림: " + (await sheetTitle(s.id))); }
      catch (e) {
        const m = e.message || String(e);
        add(label, false, (e.status === 403 || e.status === 404) ? "접근 불가. 이 시트를 " + env("GOOGLE_SERVICE_ACCOUNT_EMAIL") + " 에 편집자로 공유해주세요"
          : /invalid_grant|DECODER|PEM|private key/i.test(m) ? "Google 키를 읽지 못했어요 (" + m + ") · GOOGLE_PRIVATE_KEY 를 다시 붙여넣어 주세요"
          : /has not been used|disabled/i.test(m) ? "Google Sheets API 가 꺼져 있어요. 사용(Enable)을 눌러주세요" : m);
      }
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: checks.every((c) => c.ok), checks });
}
