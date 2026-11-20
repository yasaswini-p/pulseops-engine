// Entry point — connects to MongoDB, registers event listeners, starts the SLA watcher and HTTP server
const http = require("http");
const { connect, close } = require("./config/db");
const { handle } = require("./routes/router");
const { registerListeners, closeAuditStream } = require("./events/listeners");
const slaWatcher = require("./services/slaWatcher");

const PORT = process.env.PORT || 3000;

async function start() {
  await connect();
  console.log("✔ Connected to MongoDB as pulse_app");

  await registerListeners();
  slaWatcher.start(Number(process.env.SLA_CHECK_SECONDS) || 15);

  const server = http.createServer(handle);
  server.listen(PORT, () => console.log(`✔ PulseOps Engine running at http://localhost:${PORT}`));

  process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...");
    slaWatcher.stop();
    server.close();
    await closeAuditStream();
    await close();
    process.exit(0);
  });
}

start().catch(err => {
  console.error("✖ Startup failed:", err.message);
  process.exit(1);
});