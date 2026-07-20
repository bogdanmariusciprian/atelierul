// =========================================================
// The teacher's dashboard — the first tab of the admin panel.
//
// Charts are hand-drawn SVG. No library: the project has no build step, and a
// charting bundle would be a few hundred kilobytes and its own visual language
// for five diagrams. Drawn here, they inherit the site's colours and type.
//
// They are also interactive WITHOUT JAVASCRIPT. Each day carries an invisible
// full-height hit area and its own tooltip, revealed by `:hover` in CSS. That
// matters more than it sounds: the admin panel re-renders wholesale on every
// state change, so anything wired with addEventListener would have to be wired
// again each time, and would leak listeners if anyone forgot. CSS survives
// re-rendering for free.
//
// Everything here takes data already fetched by dashboard-repo.js — which reads
// aggregates from the server and never private content.
// Content Romanian, identifiers English.
// =========================================================

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const nf = (n) => Number(n || 0).toLocaleString("ro-RO");

/** „acum 3 zile", „azi" — a date the eye reads without doing arithmetic. */
function ago(ms) {
  if (!ms) return "niciodată";
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return "azi";
  if (d === 1) return "ieri";
  if (d < 30) return `acum ${d} zile`;
  if (d < 60) return "acum o lună";
  return `acum ${Math.floor(d / 30)} luni`;
}

/** Minutes as something sayable: 47 min, 2 h 15 min. */
function dur(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"][d.getMonth()]}`;
};

// ---------- charts ----------

const W = 720, H = 180, PAD_L = 34, PAD_B = 22, PAD_T = 10;

/** A chart of one or more daily series. `defs` decides what each one looks
 *  like; everything in a single chart shares one vertical scale, because two
 *  scales on one grid is a lie told with a straight face. */
function chart(rows, defs, opts = {}) {
  if (!rows.length) return `<p class="cx-muted">Încă nu sunt date.</p>`;
  const max = Math.max(1, ...rows.flatMap((r) => defs.map((d) => r[d.key] || 0)));
  const iw = W - PAD_L - 6, ih = H - PAD_T - PAD_B;
  const x = (i) => PAD_L + (rows.length === 1 ? iw / 2 : (i * iw) / (rows.length - 1));
  const y = (v) => PAD_T + ih - (Math.max(0, v) / max) * ih;
  const colW = iw / Math.max(1, rows.length);

  // Three gridlines and their labels. More would be decoration.
  const grid = [0, 0.5, 1].map((f) => {
    const gy = PAD_T + ih - f * ih;
    return `<line class="dch__grid" x1="${PAD_L}" y1="${gy.toFixed(1)}" x2="${W - 6}" y2="${gy.toFixed(1)}"/>
      <text class="dch__ax" x="${PAD_L - 6}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end">${nf(Math.round(max * f))}</text>`;
  }).join("");

  const bars = defs.filter((d) => d.type === "bar").map((d) =>
    rows.map((r, i) => {
      const h = ((r[d.key] || 0) / max) * ih;
      return `<rect class="dch__bar" style="--c:${d.color}"
        x="${(x(i) - colW * 0.32).toFixed(1)}" y="${(PAD_T + ih - h).toFixed(1)}"
        width="${(colW * 0.64).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"/>`;
    }).join("")).join("");

  const lines = defs.filter((d) => d.type !== "bar").map((d) => {
    const pts = rows.map((r, i) => `${x(i).toFixed(1)},${y(r[d.key] || 0).toFixed(1)}`).join(" ");
    return `<polyline class="dch__line" style="--c:${d.color}" points="${pts}"/>`
      + rows.map((r, i) => `<circle class="dch__dot" style="--c:${d.color}" cx="${x(i).toFixed(1)}" cy="${y(r[d.key] || 0).toFixed(1)}" r="2.5"/>`).join("");
  }).join("");

  // One hit area per day, each carrying its own tooltip. Near the right edge the
  // tooltip flips to the other side so it never hangs off the chart.
  const hits = rows.map((r, i) => {
    const cx = x(i), flip = i > rows.length * 0.72;
    const tw = 132, th = 18 + defs.length * 15;
    const tx = flip ? cx - tw - 8 : cx + 8;
    const body = defs.map((d, k) => `<text class="dch__tipv" x="${tx + 9}" y="${PAD_T + 30 + k * 15}">
        <tspan class="dch__tipk" style="--c:${d.color}">■</tspan> ${esc(d.label)}: ${nf(r[d.key] || 0)}${d.unit || ""}</text>`).join("");
    return `<g class="dch__day">
      <rect class="dch__hit" x="${(cx - colW / 2).toFixed(1)}" y="${PAD_T}" width="${colW.toFixed(1)}" height="${ih}"/>
      <g class="dch__tip">
        <line class="dch__cursor" x1="${cx.toFixed(1)}" y1="${PAD_T}" x2="${cx.toFixed(1)}" y2="${PAD_T + ih}"/>
        <rect class="dch__tipbg" x="${tx}" y="${PAD_T + 4}" width="${tw}" height="${th}" rx="8"/>
        <text class="dch__tipd" x="${tx + 9}" y="${PAD_T + 18}">${esc(dayLabel(r.day))}</text>
        ${body}
      </g>
    </g>`;
  }).join("");

  // Date labels: first, last, and a few in between — never all thirty.
  const every = Math.max(1, Math.round(rows.length / 6));
  const xlab = rows.map((r, i) =>
    (i % every === 0 || i === rows.length - 1)
      ? `<text class="dch__ax" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(dayLabel(r.day))}</text>` : ""
  ).join("");

  const legend = defs.map((d) => `<span class="dch__lg"><i style="--c:${d.color}"></i>${esc(d.label)}</span>`).join("");

  return `<figure class="dch">
      <figcaption class="dch__head">
        <b>${esc(opts.title || "")}</b>
        <span class="dch__legend">${legend}</span>
      </figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || "grafic")}" preserveAspectRatio="none">
        ${grid}${bars}${lines}${xlab}${hits}
      </svg>
    </figure>`;
}

// ---------- pieces ----------

const kpi = (value, label, hint) => `
  <div class="dkpi">
    <b class="dkpi__v">${esc(value)}</b>
    <span class="dkpi__l">${esc(label)}</span>
    ${hint ? `<span class="dkpi__h">${esc(hint)}</span>` : ""}
  </div>`;

/** What's waiting for a decision. Only the non-zero ones — a row of zeros is
 *  noise, and it trains you to stop looking. */
function attention(q) {
  const items = [
    { n: q.reports_open, label: "rapoarte deschise", tab: "moderare" },
    { n: q.posts_held, label: "postări reținute", tab: "moderare" },
    { n: q.comments_held, label: "comentarii reținute", tab: "moderare" },
    { n: q.exercises_pending, label: "exerciții propuse", tab: "moderare" },
    { n: q.words_pending, label: "cuvinte propuse", tab: "moderare" },
    { n: q.msgs_unread, label: "mesaje necitite", tab: null },
  ].filter((i) => i.n > 0);
  if (!items.length) {
    return `<p class="cx-adminok"><b>✅ Totul e în regulă</b> — nimic în așteptare.</p>`;
  }
  return `<div class="dattn">
      <b class="dattn__t">Îți cer o decizie</b>
      <div class="dattn__row">${items.map((i) => `
        <a class="dattn__i" href="${i.tab ? `#admin/${i.tab}` : "#mesaje"}">
          <b>${nf(i.n)}</b> ${esc(i.label)}
        </a>`).join("")}</div>
    </div>`;
}

/** The members table. One row per member, everything the teacher might want to
 *  sort by. Sorting is a state field on the panel, so it survives a re-render. */
function membersTable(members, sort) {
  if (!members.length) return `<p class="cx-muted">Niciun membru încă.</p>`;
  const dir = sort.startsWith("-") ? -1 : 1;
  const key = sort.replace(/^-/, "");
  const rows = [...members].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (typeof va === "string") return dir * va.localeCompare(vb, "ro");
    return dir * ((va || 0) - (vb || 0));
  });
  const COLS = [
    { key: "name", label: "Membru" },
    { key: "joined", label: "Înscris" },
    { key: "lastSeen", label: "Ultima dată" },
    { key: "activeDays", label: "Zile active" },
    { key: "sessions", label: "Vizite" },
    { key: "minutesAvg", label: "Medie / vizită" },
    { key: "minutesTotal", label: "Total pe site" },
    { key: "points", label: "Puncte" },
    { key: "posts", label: "Postări" },
    { key: "lessons", label: "Lecții" },
  ];
  const head = COLS.map((c) => {
    const on = key === c.key;
    const next = on && dir === 1 ? `-${c.key}` : c.key;
    return `<th><button type="button" class="dtab__s${on ? " on" : ""}" data-action="dash-sort" data-id="${next}">
      ${esc(c.label)}${on ? (dir === 1 ? " ↑" : " ↓") : ""}</button></th>`;
  }).join("");
  const NEW_MS = 7 * 86400000;
  const body = rows.map((m) => {
    const isNew = m.joined && Date.now() - m.joined < NEW_MS;
    const online = m.lastSeen && Date.now() - m.lastSeen < 3 * 60000;
    const av = m.avatar
      ? `<span class="dtab__av" style="background-image:url('${esc(m.avatar)}')"></span>`
      : `<span class="dtab__av dtab__av--i" style="--a:${esc(m.color)}">${esc((m.name[0] || "?").toUpperCase())}</span>`;
    return `<tr>
      <td class="dtab__who">
        ${av}
        <span class="dtab__nm">
          <b>${esc(m.name)}</b>${isNew ? `<i class="dtab__new">nou</i>` : ""}
          ${m.grade || m.locality ? `<small>${esc([m.grade, m.locality].filter(Boolean).join(" · "))}</small>` : ""}
        </span>
        <i class="dtab__dot${online ? " on" : ""}" title="${online ? "activ acum" : "offline"}"></i>
      </td>
      <td>${esc(ago(m.joined))}</td>
      <td>${esc(ago(m.lastSeen))}</td>
      <td>${nf(m.activeDays)}</td>
      <td>${nf(m.sessions)}</td>
      <td>${esc(dur(m.minutesAvg))}</td>
      <td>${esc(dur(m.minutesTotal))}</td>
      <td>${nf(m.points)}</td>
      <td>${nf(m.posts)}</td>
      <td>${nf(m.lessons)}</td>
    </tr>`;
  }).join("");
  return `<div class="dtab__wrap"><table class="dtab"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ---------- the tab ----------

/** `data` is what dashboard-repo.fetchDashboard() returned; `sort` is the
 *  members-table sort key held in the panel's state. */
export function dashboardHtml(data, sort = "-joined") {
  if (!data) return `<p class="cx-muted">Se încarcă dashboardul…</p>`;
  const { counts: c = {}, queues: q = {}, series = [], members = [] } = data;

  const newest = [...members].sort((a, b) => b.joined - a.joined).slice(0, 5);

  return `
    ${attention(q)}

    <div class="dkpis">
      ${kpi(nf(c.members), "membri", c.members_new_7 ? `+${nf(c.members_new_7)} în 7 zile` : "niciunul nou săptămâna asta")}
      ${kpi(nf(c.online_now), "activi acum", `${nf(c.active_7)} în ultimele 7 zile`)}
      ${kpi(dur(c.session_minutes_avg), "medie / vizită", `${nf(c.sessions_total)} vizite în total`)}
      ${kpi(nf(c.posts), "postări", c.posts_7 ? `+${nf(c.posts_7)} în 7 zile` : "niciuna săptămâna asta")}
      ${kpi(nf(c.comments), "comentarii", c.comments_7 ? `+${nf(c.comments_7)} în 7 zile` : "niciunul săptămâna asta")}
      ${kpi(nf(c.lessons_done), "lecții terminate", `${nf(c.points_total)} puncte acordate`)}
    </div>

    <div class="cx-box">
      ${chart(series, [
        { key: "minutes", label: "minute pe site", color: "#0ea5e9", type: "bar", unit: " min" },
        { key: "sessions", label: "vizite", color: "#7c3aed" },
      ], { title: "Prezența, zi de zi" })}
      <p class="cx-muted dch__note">O vizită se închide după 5 minute fără semn de viață. Datele se șterg singure după 90 de zile.</p>
    </div>

    <div class="cx-box">
      ${chart(series, [
        { key: "posts", label: "postări", color: "#16a34a" },
        { key: "comments", label: "comentarii", color: "#ea580c" },
        { key: "lessons", label: "lecții", color: "#0891b2" },
      ], { title: "Ce se întâmplă în comunitate" })}
    </div>

    <div class="cx-box">
      ${chart(series, [{ key: "members", label: "membri noi", color: "#be185d", type: "bar" }],
        { title: "Cine ți se alătură" })}
    </div>

    <div class="cx-box">
      <div class="cx-admin__head"><h3>👋 Cei mai noi</h3></div>
      ${newest.length ? `<ul class="dnew">${newest.map((m) => `
        <li class="dnew__i">
          <b>${esc(m.name)}</b>
          <span>înscris ${esc(ago(m.joined))}</span>
          <span>${esc(ago(m.lastSeen))} pe site</span>
          <span>${nf(m.activeDays)} zile active</span>
        </li>`).join("")}</ul>` : `<p class="cx-muted">Niciun membru încă.</p>`}
    </div>

    <div class="cx-box">
      <div class="cx-admin__head"><h3>👥 Toți membrii</h3></div>
      <p class="cx-muted">Click pe capul de coloană ca să sortezi.</p>
      ${membersTable(members, sort)}
    </div>

    <div class="cx-box">
      <div class="cx-admin__head"><h3>🔔 Notificări și mesaje</h3></div>
      <div class="dkpis dkpis--sm">
        ${kpi(nf(c.notif_total), "notificări trimise", `${nf(c.notif_unread)} necitite`)}
        ${kpi(nf(c.msgs_total), "mesaje în total", "conținutul rămâne privat")}
        ${kpi(nf(c.msgs_to_admin), "mesaje către tine", `${nf(c.msgs_unread_admin)} necitite`)}
      </div>
      <p class="cx-muted dch__note">Mesajele dintre membri se numără, nu se citesc — nici de aici, nici de nicăieri.</p>
    </div>`;
}
