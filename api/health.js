// GET /api/health — setup checker shown on the placeholder page.
import { env, admin, sheetTitle } from "../lib/server.js";

export default async function handler(req, res) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"];
  for (const v of vars) add("환경변수 " + v, !!env(v), env(v) ? "있음" : "Vercel → Settings → Environment Variables 에 추가 후 Redeploy");

  let cfg = {};
  if (env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")) {
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
        "owner " + roles.filter((r) => r === "owner").length + "명, staff " + roles.filter((r) => r === "staff").length + "명" + (roles.includes("staff") ? "" : " · 3_users.sql 을 확인해주세요"));
    } catch (e) { add("Supabase 연결", false, e.message || String(e)); }
  }

  if (env("GOOGLE_SERVICE_ACCOUNT_EMAIL") && env("GOOGLE_PRIVATE_KEY")) {
    const sheets = [["NaR 작업표 (파이프라인)", cfg.pipeSheet], ["흠이 데일리 시트", cfg.heumiSheet], ["채널 성장 기록 시트", cfg.sheet]];
    for (const [label, s] of sheets) {
      if (!s || !s.id) { add(label, false, "연결된 시트 정보가 없어요"); continue; }
      try { add(label, true, "열림: " + (await sheetTitle(s.id))); }
      catch (e) { add(label, false, (e.status === 403 || e.status === 404 ? "접근 불가. 이 시트를 " + env("GOOGLE_SERVICE_ACCOUNT_EMAIL") + " 에 편집자로 공유해주세요" : e.message)); }
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: checks.every((c) => c.ok), checks });
}
