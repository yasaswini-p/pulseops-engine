// PulseOps — Phase 1: users, custom roles and least-privilege access control
// Run ONCE, before authorization is enabled:  mongosh db/01-create-users.js

const DB_NAME = "pulseops";
const admin = db.getSiblingDB("admin");
const app = db.getSiblingDB(DB_NAME);

// Helpers so the script can be re-run safely
function resetUser(database, name) { if (database.getUser(name)) database.dropUser(name); }
function resetRole(database, name) { if (database.getRole(name)) database.dropRole(name); }

// 1. Platform administrator (lives in the admin database)
resetUser(admin, "pulse_admin");
admin.createUser({
  user: "pulse_admin",
  pwd: "Admin@123",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
});

// 2. Custom role for the application: create/update incidents, but never delete
resetRole(app, "incidentOperator");
app.createRole({
  role: "incidentOperator",
  privileges: [
    { resource: { db: DB_NAME, collection: "incidents" },    actions: ["find", "insert", "update"] },
    { resource: { db: DB_NAME, collection: "teams" },        actions: ["find"] },
    { resource: { db: DB_NAME, collection: "sla_policies" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "audit_logs" },   actions: ["insert"] }
  ],
  roles: []
});

// 3. Custom role for compliance: read the audit trail only
resetRole(app, "auditReader");
app.createRole({
  role: "auditReader",
  privileges: [
    { resource: { db: DB_NAME, collection: "audit_logs" }, actions: ["find"] }
  ],
  roles: []
});

// 4. Users for each persona
resetUser(app, "pulse_app");
app.createUser({ user: "pulse_app", pwd: "App@123", roles: [{ role: "incidentOperator", db: DB_NAME }] });

resetUser(app, "pulse_analyst");
app.createUser({ user: "pulse_analyst", pwd: "Analyst@123", roles: [{ role: "read", db: DB_NAME }] });

resetUser(app, "pulse_auditor");
app.createUser({ user: "pulse_auditor", pwd: "Auditor@123", roles: [{ role: "auditReader", db: DB_NAME }] });

print("✔ Users created:");
print("  admin DB    → pulse_admin   (platform administrator)");
print("  pulseops DB → pulse_app     (incidentOperator: find/insert/update, no delete)");
print("  pulseops DB → pulse_analyst (built-in read: read-only)");
print("  pulseops DB → pulse_auditor (auditReader: audit_logs only)");