// Entry point — connects to MongoDB, then starts the HTTP server
const http = require("http");
const { connect, close } = require("./config/db");
const { handle } = require("./routes/router");

const PORT = process.env.PORT || 3000;

async function start() {
  await connect();
  console.log("✔ Connected to MongoDB as pulse_app");

  const server = http.createServer(handle);
  server.listen(PORT, () => console.log(`✔ PulseOps Engine running at http://localhost:${PORT}`));

  process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...");
    server.close();
    await close();
    process.exit(0);
  });
}

start().catch(err => {
  console.error("✖ Startup failed:", err.message);
  process.exit(1);
});