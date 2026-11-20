// ROUTER — maps HTTP method + URL pattern to a controller function
const incidents = require("../controllers/incidentController");
const system = require("../controllers/systemController");
const { sendJson } = require("../utils/http");

const routes = [
  { method: "GET",   pattern: /^\/$/,                                handler: system.dashboard },
  { method: "GET",   pattern: /^\/api\/health$/,                     handler: system.health },
  { method: "GET",   pattern: /^\/api\/incidents$/,                  handler: incidents.list },
  { method: "POST",  pattern: /^\/api\/incidents$/,                  handler: incidents.create },
  { method: "GET",   pattern: /^\/api\/incidents\/(INC-\d+)$/,        handler: incidents.getOne },
  { method: "PATCH", pattern: /^\/api\/incidents\/(INC-\d+)\/status$/, handler: incidents.updateStatus }
];

async function handle(req, res) {
  const started = Date.now();
  res.on("finish", () =>
    console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - started} ms)`));

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = routes.find(r => r.method === req.method && r.pattern.test(url.pathname));
  if (!route) return sendJson(res, 404, { error: `No route for ${req.method} ${url.pathname}` });

  try {
    const params = url.pathname.match(route.pattern).slice(1);
    const query = Object.fromEntries(url.searchParams);
    await route.handler(req, res, { params, query });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status === 500) console.error(err);
    sendJson(res, status, { error: status === 500 ? "Internal server error" : err.message, details: err.details });
  }
}

module.exports = { handle };