// SLA watcher — a timer-driven background job that detects warnings and breaches
const bus = require("../events/incidentBus");
const Incident = require("../models/incidentModel");

let startupTimer = null;
let intervalTimer = null;
let running = false;

async function checkSla() {
  if (running) return;          // skip if the previous check is still in progress
  running = true;
  try {
    const now = new Date();
    let breached = 0;
    let warnings = 0;

    for (const i of await Incident.findBreachCandidates(now)) {
      const claimed = await Incident.markBreached(i.incidentId);   // atomic: each breach handled once
      if (claimed) { breached++; bus.publish("sla:breached", claimed); }
    }

    for (const i of await Incident.findWarningCandidates(now)) {
      const claimed = await Incident.markWarned(i.incidentId);
      if (claimed) { warnings++; bus.publish("sla:warning", claimed); }
    }

    bus.publish("watcher:tick", { checkedAt: now, breached, warnings });
  } catch (err) {
    console.error("✖ SLA watcher error:", err.message);
  } finally {
    running = false;
  }
}

function start(intervalSeconds = 15) {
  // setTimeout: wait 2 s after startup, then setInterval: check repeatedly
  startupTimer = setTimeout(() => {
    checkSla();
    intervalTimer = setInterval(checkSla, intervalSeconds * 1000);
  }, 2000);
  console.log(`✔ SLA watcher scheduled every ${intervalSeconds}s`);
}

function stop() {
  clearTimeout(startupTimer);
  clearInterval(intervalTimer);
}

module.exports = { start, stop, checkSla };