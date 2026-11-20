// CONTROLLER — triggers the historical CSV import
const path = require("path");
const bus = require("../events/incidentBus");
const { importCsv } = require("../services/csvImporter");
const { sendJson } = require("../utils/http");

const CSV_PATH = path.join(__dirname, "../../data/historical_incidents.csv");

function importHistorical(req, res) {
  return new Promise(resolve => {
    importCsv(CSV_PATH, (err, summary) => {
      if (err) {
        sendJson(res, err.statusCode || 500, { error: err.message });
      } else {
        bus.publish("import:completed", summary);
        sendJson(res, 200, summary);
      }
      resolve();
    });
  });
}

module.exports = { importHistorical };

