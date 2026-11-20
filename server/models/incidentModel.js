// MODEL — all incident data access and business rules live here
const { getDb } = require("../config/db");
const { HttpError } = require("../utils/http");

const PRIORITIES = ["P1", "P2", "P3", "P4"];
const TEAMS = ["NET", "DB", "APP", "SEC"];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"];

// Allowed lifecycle transitions (a resolved incident cannot be reopened)
const TRANSITIONS = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: []
};

const incidents = () => getDb().collection("incidents");
const slaPolicies = () => getDb().collection("sla_policies");
const HIDE_ID = { projection: { _id: 0 } };

function validateNew(data) {
  const errors = [];
  if (typeof data.title !== "string" || data.title.trim().length < 3)
    errors.push("title must be at least 3 characters");
  if (!PRIORITIES.includes(data.priority))
    errors.push(`priority must be one of ${PRIORITIES.join(", ")}`);
  if (!TEAMS.includes(data.team))
    errors.push(`team must be one of ${TEAMS.join(", ")}`);
  return errors;
}

async function nextIncidentId() {
  const last = await incidents()
    .find({}, { projection: { incidentId: 1 } })
    .sort({ incidentId: -1 })
    .limit(1)
    .toArray();
  const lastNum = last.length ? parseInt(last[0].incidentId.split("-")[1], 10) : NaN;
  return `INC-${(Number.isNaN(lastNum) || lastNum < 1000 ? 1000 : lastNum) + 1}`;
}

async function create(data) {
  const policy = await slaPolicies().findOne({ priority: data.priority });
  const scale = Number(process.env.SLA_TIME_SCALE) || 1;
  const now = new Date();

  const doc = {
    incidentId: await nextIncidentId(),
    title: data.title.trim(),
    description: (data.description || "").trim(),
    priority: data.priority,
    team: data.team,
    status: "OPEN",
    escalated: false,
    slaMinutes: policy.resolveMinutes,
    slaDueAt: new Date(now.getTime() + (policy.resolveMinutes * 60000) / scale),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    history: [{ status: "OPEN", at: now }]
  };

  await incidents().insertOne(doc);
  delete doc._id;
  return doc;
}

async function findAll(filters = {}) {
  const query = {};
  for (const key of ["status", "priority", "team"]) {
    if (filters[key]) query[key] = filters[key].toUpperCase();
  }
  return incidents().find(query, HIDE_ID).sort({ createdAt: -1 }).limit(100).toArray();
}

async function findById(incidentId) {
  return incidents().findOne({ incidentId }, HIDE_ID);
}

async function findOpen() {
  return incidents().find({ status: { $ne: "RESOLVED" } }, HIDE_ID).sort({ slaDueAt: 1 }).toArray();
}

async function updateStatus(incidentId, newStatus) {
  if (!STATUSES.includes(newStatus))
    throw new HttpError(400, `status must be one of ${STATUSES.join(", ")}`);

  const current = await findById(incidentId);
  if (!current) throw new HttpError(404, `Incident ${incidentId} not found`);
  if (!TRANSITIONS[current.status].includes(newStatus))
    throw new HttpError(409, `Cannot move ${incidentId} from ${current.status} to ${newStatus}`);

  const now = new Date();
  const set = { status: newStatus, updatedAt: now };
  if (newStatus === "RESOLVED") set.resolvedAt = now;

  return incidents().findOneAndUpdate(
    { incidentId },
    { $set: set, $push: { history: { status: newStatus, at: now } } },
    { returnDocument: "after", projection: { _id: 0 } }
  );
}

module.exports = { validateNew, create, findAll, findById, findOpen, updateStatus, PRIORITIES, TEAMS, STATUSES };
