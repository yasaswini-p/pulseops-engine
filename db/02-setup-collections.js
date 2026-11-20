// PulseOps — Phase 1: collections, schema validation, indexes and reference data
// Run before enabling auth:  mongosh db/02-setup-collections.js
// WARNING: re-running drops and recreates the collections.

const app = db.getSiblingDB("pulseops");

["incidents", "teams", "sla_policies", "audit_logs"].forEach(name => {
  if (app.getCollectionNames().includes(name)) app.getCollection(name).drop();
});

// Incidents — schema validation enforces data quality at the database level
app.createCollection("incidents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["incidentId", "title", "priority", "status", "team", "createdAt"],
      properties: {
        incidentId: { bsonType: "string", description: "e.g. INC-1001" },
        title:      { bsonType: "string", minLength: 3 },
        priority:   { enum: ["P1", "P2", "P3", "P4"] },
        status:     { enum: ["OPEN", "IN_PROGRESS", "RESOLVED"] },
        team:       { enum: ["NET", "DB", "APP", "SEC"] },
        createdAt:  { bsonType: "date" }
      }
    }
  }
});
app.incidents.createIndex({ incidentId: 1 }, { unique: true });
app.incidents.createIndex({ status: 1, priority: 1 });
app.incidents.createIndex({ team: 1 });

app.createCollection("teams");
app.teams.insertMany([
  { code: "NET", name: "Network Operations",   lead: "R. Menon" },
  { code: "DB",  name: "Database Services",    lead: "S. Iyer" },
  { code: "APP", name: "Application Support",  lead: "A. Khan" },
  { code: "SEC", name: "Security Operations",  lead: "P. Das" }
]);

// SLA policies (minutes) — the contract each priority must meet
app.createCollection("sla_policies");
app.sla_policies.insertMany([
  { priority: "P1", label: "Critical", responseMinutes: 15,  resolveMinutes: 240 },
  { priority: "P2", label: "High",     responseMinutes: 60,  resolveMinutes: 480 },
  { priority: "P3", label: "Medium",   responseMinutes: 240, resolveMinutes: 1440 },
  { priority: "P4", label: "Low",      responseMinutes: 480, resolveMinutes: 4320 }
]);

app.createCollection("audit_logs");
app.audit_logs.createIndex({ timestamp: -1 });

print("✔ Collections ready: " + app.getCollectionNames().sort().join(", "));
print("  teams: " + app.teams.countDocuments() + ", sla_policies: " + app.sla_policies.countDocuments());