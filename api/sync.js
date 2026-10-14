// POST /api/sync — mirror board data into Google Sheets.
// Body: { kind: "pipeline" | "heumi" | "stats" | "all", ids?: string[] }
//   pipeline ids = video ids, heumi ids = dates (YYYY-MM-DD). No ids = everything.
// Header: Authorization: Bearer <Supabase access token of the signed-in user>
import { caller, loadDocs, getValues, writeRanges } from "../lib/server.js";
import { pipelineRow, heumiRow, statsTable, placeRows } from "../lib/rows.js";

const STAFF_KINDS = ["heumi", "stats"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const who = await caller(req);
  if (!who) return res.status(401).json({ error: "로그인이 필요해요." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const kind = body.kind;
  const kinds = kind === "all" ? ["pipeline", "heumi", "stats"] : [kind];
  if (!kinds.every((k) => ["pipeline", "heumi", "stats"].includes(k))) return res.status(400).json({ error: "알 수 없는 kind: " + kind });
  if (who.role !== "owner" && !kinds.every((k) => STAFF_KINDS.includes(k))) return res.status(403).json({ error: "권한이 없어요." });

  const ids = Array.isArray(body.ids) ? body.ids.map(String) : null;
  const result = {};
  try {
    const D = await loadDocs(["config", "videos", "heumi", "stats", "channels", "brands"]);
    const cfg = Object.fromEntries(D.config.map((c) => [c.id, c._data]));

    for (const k of kinds) {
      if (k === "pipeline") {
        const s = cfg.pipeSheet; if (!s || !s.id) { result.pipeline = "skipped: no sheet"; continue; }
        const tab = "'" + (s.tab || "편집") + "'";
        const list = ids && kind !== "all" ? D.videos.filter((v) => ids.includes(v.id)) : D.videos;
        const rows = placeRows(await getValues(s.id, tab + "!A:M"), 12, list.map((v) => v.id));
        await writeRanges(s.id, list.map((v) => ({ range: `${tab}!A${rows[v.id]}:M${rows[v.id]}`, values: [pipelineRow(v)] })));
        result.pipeline = list.length;
      }
      if (k === "heumi") {
        const s = cfg.heumiSheet; if (!s || !s.id) { result.heumi = "skipped: no sheet"; continue; }
        const tab = "'" + (s.tab || "흠이 데일리") + "'";
        const byDate = Object.fromEntries(D.heumi.map((h) => [h.id, h]));
        const dates = ids && kind !== "all" ? ids
          : [...new Set([...Object.keys(byDate), ...D.videos.map((v) => v.stageAt && v.stageAt.detail).filter(Boolean)])].sort();
        const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        const rows = placeRows(await getValues(s.id, tab + "!A:L"), 11, valid);
        await writeRanges(s.id, valid.map((d) => ({ range: `${tab}!A${rows[d]}:L${rows[d]}`, values: [heumiRow(d, byDate[d], D.videos, rows[d])] })));
        result.heumi = valid.length;
      }
      if (k === "stats") {
        const s = cfg.sheet; if (!s || !s.id) { result.stats = "skipped: no sheet"; continue; }
        const table = statsTable(D.stats, D.channels, D.brands);
        await writeRanges(s.id, [{ range: "A1", values: table }]);
        result.stats = table.length - 1;
      }
    }
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    const hint = e.status === 403 ? " (시트를 서비스 계정 이메일에 '편집자'로 공유했는지 확인해주세요)" : "";
    return res.status(500).json({ error: e.message + hint });
  }
}
