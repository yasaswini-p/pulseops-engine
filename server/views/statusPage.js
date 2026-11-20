// VIEW — renders open incidents as a live HTML status board (auto-refreshes every 10 s)

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatRemaining(dueAt) {
  const ms = new Date(dueAt) - Date.now();
  const abs = Math.abs(ms);
  let text;
  if (abs < 60000) text = `${Math.round(abs / 1000)}s`;
  else if (abs < 3600000) text = `${Math.round(abs / 60000)}m`;
  else text = `${Math.floor(abs / 3600000)}h ${Math.round((abs % 3600000) / 60000)}m`;
  return ms < 0 ? { text: `Breached ${text} ago`, breached: true } : { text: `${text} left`, breached: false };
}

function renderDashboard(incidents) {
  const breached = incidents.filter(i => new Date(i.slaDueAt) < Date.now()).length;
  const p1 = incidents.filter(i => i.priority === "P1").length;
  const escalated = incidents.filter(i => i.escalated).length;

  const rows = incidents.map(i => {
    const sla = formatRemaining(i.slaDueAt);
    return `<tr>
      <td><strong>${escapeHtml(i.incidentId)}</strong></td>
      <td>${escapeHtml(i.title)}</td>
      <td><span class="pill ${i.priority}">${i.priority}</span></td>
      <td>${i.team}</td>
      <td>${i.status.replace("_", " ")}</td>
      <td class="${sla.breached ? "bad" : "ok"}">${sla.text}</td>
      <td>${i.escalated ? "⚠ Yes" : "—"}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta http-equiv="refresh" content="10">
<title>PulseOps — Live Status</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; background: #f6f7f9; color: #1d2433; }
  h1 { margin: 0 0 .25rem; } .sub { color: #667; margin-bottom: 1.5rem; }
  .cards { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .card { background: #fff; border-radius: 10px; padding: 1rem 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); min-width: 140px; }
  .card .n { font-size: 2rem; font-weight: 700; } .card .l { color: #667; font-size: .85rem; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th, td { padding: .7rem 1rem; text-align: left; border-bottom: 1px solid #eef0f3; font-size: .92rem; }
  th { background: #1d2433; color: #fff; font-weight: 600; }
  .pill { padding: 2px 8px; border-radius: 999px; font-size: .78rem; font-weight: 700; color: #fff; }
  .P1 { background: #c62828; } .P2 { background: #ef6c00; } .P3 { background: #1565c0; } .P4 { background: #607d8b; }
  .bad { color: #c62828; font-weight: 600; } .ok { color: #2e7d32; }
  .empty { padding: 2rem; text-align: center; color: #667; }
</style></head>
<body>
  <h1>PulseOps Engine — Live Status</h1>
  <div class="sub">Open incidents ordered by SLA deadline · refreshed ${new Date().toLocaleTimeString()}</div>
  <div class="cards">
    <div class="card"><div class="n">${incidents.length}</div><div class="l">Open incidents</div></div>
    <div class="card"><div class="n">${p1}</div><div class="l">Critical (P1)</div></div>
    <div class="card"><div class="n" style="color:#c62828">${breached}</div><div class="l">SLA breached</div></div>
    <div class="card"><div class="n">${escalated}</div><div class="l">Escalated</div></div>
  </div>
  <table>
    <tr><th>ID</th><th>Title</th><th>Priority</th><th>Team</th><th>Status</th><th>SLA</th><th>Escalated</th></tr>
    ${rows || `<tr><td colspan="7" class="empty">No open incidents 🎉</td></tr>`}
  </table>
</body></html>`;
}

module.exports = { renderDashboard };