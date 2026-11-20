// CONTROLLER — handles incident requests: read input, call the model, publish events, respond
const Incident = require("../models/incidentModel");
const bus = require("../events/incidentBus");
const { sendJson, readJsonBody, HttpError } = require("../utils/http");

async function list(req, res, { query }) {
  const items = await Incident.findAll(query);
  sendJson(res, 200, { count: items.length, incidents: items });
}

async function getOne(req, res, { params }) {
  const incident = await Incident.findById(params[0]);
  if (!incident) throw new HttpError(404, `Incident ${params[0]} not found`);
  sendJson(res, 200, incident);
}

async function create(req, res) {
  const body = await readJsonBody(req);
  const errors = Incident.validateNew(body);
  if (errors.length) throw new HttpError(400, "Validation failed", errors);

  const incident = await Incident.create(body);
  sendJson(res, 201, incident);
  bus.publish("incident:created", incident);
}

async function updateStatus(req, res, { params }) {
  const body = await readJsonBody(req);
  const incident = await Incident.updateStatus(params[0], body.status);
  sendJson(res, 200, incident);

  const from = incident.history.at(-2)?.status;
  bus.publish("incident:statusChanged", { ...incident, from, to: incident.status });

  if (incident.status === "RESOLVED") {
    const withinSla = new Date(incident.resolvedAt) <= new Date(incident.slaDueAt);
    bus.publish("incident:resolved", { ...incident, withinSla });
  }
}

module.exports = { list, getOne, create, updateStatus };