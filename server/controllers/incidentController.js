// CONTROLLER — handles incident requests: read input, call the model, send the response
const Incident = require("../models/incidentModel");
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
}

async function updateStatus(req, res, { params }) {
  const body = await readJsonBody(req);
  const incident = await Incident.updateStatus(params[0], body.status);
  sendJson(res, 200, incident);
}

module.exports = { list, getOne, create, updateStatus };