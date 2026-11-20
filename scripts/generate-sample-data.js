// Generates a realistic 5-week historical ticket export (120 incidents) using a write stream.
// A seeded random generator makes the dataset reproducible.
const fs = require("fs");
const path = require("path");

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2027);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + rand() * (max - min);

const SLA_MINUTES = { P1: 240, P2: 480, P3: 1440, P4: 4320 };
// Each team has a different underlying breach tendency — the analytics in Phase 4 should reveal this
const BREACH_RATE = { NET: 0.38, DB: 0.14, APP: 0.24, SEC: 0.08 };
const TITLES = {
  NET: ["VPN tunnel dropping", "Office Wi-Fi outage", "DNS resolution failures", "Packet loss on core switch", "Firewall rule blocking API", "Branch office link down"],
  DB:  ["Slow report queries", "Replication lag on replica", "Disk space alert on DB server", "Deadlocks in order table", "Backup job failed", "Connection pool exhausted"],
  APP: ["Payment gateway timeout", "Login page error 500", "Checkout page slow", "Mobile app crash on launch", "Email notifications delayed", "Search returning no results"],
  SEC: ["Phishing email reported", "Suspicious login from new country", "Expired SSL certificate", "Malware alert on laptop", "Unauthorised access attempt", "Password reset abuse"]
};

function pickPriority() {
  const r = rand();
  if (r < 0.10) return "P1";
  if (r < 0.35) return "P2";
  if (r < 0.75) return "P3";
  return "P4";
}

const COUNT = 120;
const DAY = 86400000;
const now = Date.now();
const rows = [];

for (let i = 0; i < COUNT; i++) {
  const team = pick(Object.keys(TITLES));
  const priority = pickPriority();
  const createdAt = now - between(7, 42) * DAY;
  const breach = rand() < BREACH_RATE[team];
  const factor = breach ? between(1.05, 2.2) : between(0.15, 0.95);
  const resolvedAt = createdAt + SLA_MINUTES[priority] * factor * 60000;
  rows.push({ team, priority, title: pick(TITLES[team]), createdAt, resolvedAt });
}

rows.sort((a, b) => a.createdAt - b.createdAt);

const outPath = path.join(__dirname, "../data/historical_incidents.csv");
const out = fs.createWriteStream(outPath);
out.write("incidentId,title,priority,team,createdAt,resolvedAt\n");
rows.forEach((r, idx) => {
  const id = `INC-${String(idx + 1).padStart(4, "0")}`;
  out.write(`${id},${r.title},${r.priority},${r.team},${new Date(r.createdAt).toISOString()},${new Date(r.resolvedAt).toISOString()}\n`);
});
out.end();
out.on("finish", () => console.log(`✔ Wrote ${rows.length} historical incidents to data/historical_incidents.csv`));
