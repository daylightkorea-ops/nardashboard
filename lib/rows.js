// Row builders for the Google Sheets mirrors. Pure functions: no network.

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const MODES = { edit: "편집일", shoot: "촬영일", off: "휴무" };
export const PS_STATUS = { shot: "소스모음", story: "스토리", rough: "가편 중", detail: "가편 완료", ready: "업로드 대기", uploaded: "완료" };
export const PS_FORMAT = { gs_long: "Longform", g_long: "Longform", nar: "Longform", other: "Longform", gs_short: "Shortform", g_interview: "Interview" };

export function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function sheetDate(s) { if (!s) return ""; const d = parseYmd(s); return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear(); }
const safeTxt = (s) => (/^[=+\-@]/.test(s) ? "'" + s : s);

export function defClient(v) {
  return v.kind && v.kind.startsWith("gs_") ? "감성복싱" : v.kind && v.kind.startsWith("g_") ? "G복싱" : "";
}

/** NaR 작업표 '편집' row, columns A..M */
export function pipelineRow(v) {
  const sa = v.stageAt || {};
  const start = sa.story || sa.rough || sa.detail || v.created || "";
  return [
    safeTxt(v.title || ""), v.client || defClient(v), v.priority || "", v.length || "",
    PS_FORMAT[v.kind] || "Longform", PS_STATUS[v.stage] || "",
    sheetDate(start), v.stage === "uploaded" ? sheetDate(sa.uploaded) : "",
    v.src || "", v.final || "", v.upload || "", safeTxt(v.note || ""), "'" + v.id,
  ];
}

export function roughDone(videos, d) {
  return videos.filter((v) => v.kind !== "gs_short" && v.stageAt && v.stageAt.detail === d).length;
}

export function defaultMode(d) { return [2, 4, 5].includes(parseYmd(d).getDay()) ? "edit" : "off"; }

/** '흠이 데일리' row, columns A..L, written at sheet row r */
export function heumiRow(d, doc, videos, r) {
  const h = doc || { mode: defaultMode(d), items: [] };
  const it = h.items || [];
  const dn = it.filter((x) => x.done);
  const done = [...dn.map((x) => "• " + x.text), ...(h.routinesDone || []).map((t) => "• [루틴] " + t)];
  return [
    sheetDate(d), DOW[parseYmd(d).getDay()], MODES[h.mode || defaultMode(d)] || "",
    it.length, dn.length, `=IF(D${r}=0,"",E${r}/D${r})`, roughDone(videos, d),
    done.join("\n"), it.filter((x) => !x.done).map((x) => "• " + x.text).join("\n"),
    safeTxt(h.memo || ""), `=A${r}-WEEKDAY(A${r},2)+1`, "'" + d,
  ];
}

export function channelLabel(c, brands) {
  const b = brands.find((x) => x.id === c.brand);
  const name = (b && b.name) || c.brandName || c.brand || "";
  return [name, c.platform, c.metric || "", c.label ? "(" + c.label + ")" : ""].filter(Boolean).join(" ");
}

/** Whole channel-growth table, written from A1 of the stats sheet's first tab */
export function statsTable(stats, channels, brands) {
  const chs = [...channels].sort((a, b) => (a.order || 0) - (b.order || 0));
  const head = ["날짜", ...chs.map((c) => channelLabel(c, brands))];
  const rows = [...stats].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => [s.date, ...chs.map((c) => (s.values && s.values[c.id] != null ? Number(s.values[c.id]) : ""))]);
  return [head, ...rows];
}

/** Assign sheet rows: existing rows found by id in column `idCol`, new ones after the last used row. */
export function placeRows(existing, idCol, ids) {
  const at = {};
  existing.forEach((row, i) => { const v = row[idCol]; if (v) at[String(v).replace(/^'/, "")] = i + 1; });
  let next = Math.max(existing.length, 1) + 1;
  const out = {};
  for (const id of ids) out[id] = at[id] || next++;
  return out;
}
