// Subscribers: audit trail, notifications and escalation policy
const fs = require("fs");
const path = require("path");
const bus = require("./incidentBus");
const { getDb } = require("../config/db");
const Incident = require("../models/incidentModel");

const AUDITED_EVENTS = [
  "incident:created", "incident:statusChanged", "incident:resolved",
  "sla:warning", "sla:breached", "incident:escalated", "import:completed"
];

let auditStream = null;

// Wrap async listeners so one failure never crashes the server
const safe = (name, fn) => async payload => {
  try { await fn(payload); }
  catch (err) { console.error(`✖ Listener "${name}" failed:`, err.message); }
};

const time = d => new Date(d).toLocaleTimeString("en-IN", { hour12: false });

function summarise(event, p) {
  switch (event) {
    case "incident:created":       return `Created: ${p.title}`;
    case "incident:statusChanged": return `Status ${p.from} → ${p.to}`;
    case "incident:resolved":      return p.withinSla ? "Resolved within SLA" : "Resolved after SLA breach";
    case "sla:warning":            return "Less than 25% of SLA time remaining";
    case "sla:breached":           return `SLA of ${p.slaMinutes} min exceeded`;
    case "incident:escalated":     return `Escalated to ${p.escalatedTo}`;
    case "import:completed":       return `${p.inserted} historical incidents imported`;
    default:                       return event;
  }
}

async function registerListeners() {
  const teams = await getDb().collection("teams").find().toArray();
  const teamLead = Object.fromEntries(teams.map(t => [t.code, t.lead]));

  auditStream = fs.createWriteStream(path.join(__dirname, "../../logs/audit.log"), { flags: "a" });

  // 1. AUDIT TRAIL — every event is written to MongoDB and to logs/audit.log
  for (const event of AUDITED_EVENTS) {
    bus.on(event, safe("audit", async payload => {
      const entry = {
        event,
        incidentId: payload.incidentId || null,
        priority: payload.priority || null,
        team: payload.team || null,
        details: summarise(event, payload),
        actor: "pulse_app",
        timestamp: new Date()
      };
      auditStream.write(JSON.stringify(entry) + "\n");
      await getDb().collection("audit_logs").insertOne(entry);
    }));
  }

  // 2. NOTIFICATIONS — console messages simulate alerts to the operations team
  bus.on("incident:created", safe("notify", i =>
    console.log(`🆕 ${i.incidentId} [${i.priority}/${i.team}] "${i.title}" — SLA due ${time(i.slaDueAt)}`)));
  bus.on("incident:statusChanged", safe("notify", i =>
    console.log(`🔄 ${i.incidentId} moved ${i.from} → ${i.to}`)));
  bus.on("incident:resolved", safe("notify", i =>
    console.log(`✅ ${i.incidentId} resolved ${i.withinSla ? "within SLA" : "AFTER SLA breach"}`)));
  bus.on("sla:warning", safe("notify", i =>
    console.log(`⏳ WARNING: ${i.incidentId} [${i.priority}] has <25% SLA time left (due ${time(i.slaDueAt)})`)));
  bus.on("import:completed", safe("notify", s =>
    console.log(`📥 Import finished: ${s.inserted} inserted, ${s.skippedDuplicates} duplicates skipped, ${s.rejected} rejected`)));

  // 3. ESCALATION POLICY — breached P1/P2 incidents are escalated to the team lead
  bus.on("sla:breached", safe("escalation", async i => {
    console.log(`🚨 SLA BREACHED: ${i.incidentId} [${i.priority}/${i.team}] "${i.title}"`);
    if (["P1", "P2"].includes(i.priority)) {
      const lead = teamLead[i.team] || "On-call manager";
      const updated = await Incident.markEscalated(i.incidentId, lead);
      bus.publish("incident:escalated", updated);
    }
  }));
  bus.on("incident:escalated", safe("notify", i =>
    console.log(`📟 ESCALATED: ${i.incidentId} paged to ${i.escalatedTo} (${i.team} team lead)`)));

  // once() — fires only on the first watcher run
  bus.once("watcher:tick", t =>
    console.log(`✔ SLA watcher first check done (${t.breached} breached, ${t.warnings} warnings)`));

  console.log(`✔ Event listeners registered (${AUDITED_EVENTS.length} audited events)`);
}

function closeAuditStream() {
  return new Promise(resolve => (auditStream ? auditStream.end(resolve) : resolve()));
}

module.exports = { registerListeners, closeAuditStream };