// CSV importer — streams a historical ticket export line by line (callback style)
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const Incident = require("../models/incidentModel");
const { HttpError } = require("../utils/http");

const EXPECTED_HEADER = "incidentId,title,priority,team,createdAt,resolvedAt";

function importCsv(filePath, callback) {
  const started = Date.now();

  // Classic Node callback: fs.access(path, mode, (err) => ...)
  fs.access(filePath, fs.constants.R_OK, accessErr => {
    if (accessErr) {
      return callback(new HttpError(404, `CSV not found at ${filePath}. Run: npm run generate-data`));
    }

    const rows = [];
    const rejected = [];
    let lineNo = 0;

    const input = fs.createReadStream(filePath, { encoding: "utf8" });
    input.on("error", err => callback(err));
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    rl.on("line", line => {
      lineNo++;
      if (lineNo === 1) {
        if (line.trim() !== EXPECTED_HEADER) rejected.push({ line: 1, reason: "Unexpected header" });
        return;
      }
      if (!line.trim()) return;

      const [incidentId, title, priority, team, createdAt, resolvedAt] = line.split(",");
      const errors = Incident.validateNew({ title, priority, team });
      const created = new Date(createdAt);
      const resolved = new Date(resolvedAt);
      if (!/^INC-\d+$/.test(incidentId || "")) errors.push("invalid incidentId");
      if (isNaN(created) || isNaN(resolved) || resolved < created) errors.push("invalid dates");

      if (errors.length) rejected.push({ line: lineNo, reason: errors.join("; ") });
      else rows.push({ incidentId, title, priority, team, createdAt: created, resolvedAt: resolved });
    });

    rl.on("close", () => {
      Incident.insertHistorical(rows)
        .then(result => callback(null, {
          file: path.basename(filePath),
          linesRead: Math.max(lineNo - 1, 0),
          valid: rows.length,
          rejected: rejected.length,
          rejectedSample: rejected.slice(0, 5),
          inserted: result.inserted,
          skippedDuplicates: result.skipped,
          durationMs: Date.now() - started
        }))
        .catch(err => callback(err));
    });
  });
}

module.exports = { importCsv };
