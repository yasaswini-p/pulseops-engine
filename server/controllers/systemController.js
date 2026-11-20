// CONTROLLER — health check and the HTML status view
const { getDb } = require("../config/db");
const Incident = require("../models/incidentModel");
const { sendJson, sendHtml } = require("../utils/http");
const { renderDashboard } = require("../views/statusPage");

async function health(req, res) {
  await getDb().command({ ping: 1 });
  sendJson(res, 200, { status: "ok", database: "connected", uptimeSeconds: Math.round(process.uptime()) });
}

async function dashboard(req, res) {
  const open = await Incident.findOpen();
  sendHtml(res, 200, renderDashboard(open));
}

module.exports = { health, dashboard };