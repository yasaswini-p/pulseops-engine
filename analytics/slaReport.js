// PulseOps — Phase 4: SLA performance analytics (decision-support report)
// Connects as the READ-ONLY analyst user and uses MongoDB aggregation pipelines.
// Run: npm run report   → prints to console and writes docs/sla-report.md
const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");

// ---------- Aggregation building blocks ----------

const resolvedOnly = { $match: { status: "RESOLVED", resolvedAt: { $ne: null } } };

const addMetrics = {
  $addFields: {
    resolutionHrs: { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000] },
    // How much of the SLA window was used (100% = resolved exactly on the deadline)
    slaUsedPct: {
      $multiply: [
        { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, { $subtract: ["$slaDueAt", "$createdAt"] }] },
        100
      ]
    },
    breached: { $cond: [{ $gt: ["$resolvedAt", "$slaDueAt"] }, 1, 0] }
  }
};

const groupStats = idExpr => ({
  $group: {
    _id: idExpr,
    total: { $sum: 1 },
    breaches: { $sum: "$breached" },
    escalations: { $sum: { $cond: [{ $eq: ["$escalated", true] }, 1, 0] } },
    avgResolutionHrs: { $avg: "$resolutionHrs" },
    avgSlaUsedPct: { $avg: "$slaUsedPct" }
  }
});

const shape = {
  $project: {
    _id: 0,
    key: "$_id",
    total: 1,
    breaches: 1,
    escalations: 1,
    compliancePct: {
      $round: [{ $multiply: [{ $divide: [{ $subtract: ["$total", "$breaches"] }, "$total"] }, 100] }, 1]
    },
    avgResolutionHrs: { $round: ["$avgResolutionHrs", 1] },
    avgSlaUsedPct: { $round: ["$avgSlaUsedPct", 0] }
  }
};

const pipeline = (idExpr, sort, limit) => {
  const stages = [resolvedOnly, addMetrics, groupStats(idExpr), shape, { $sort: sort }];
  if (limit) stages.push({ $limit: limit });
  return stages;
};

// ---------- Insight engine (rule-based recommendations) ----------

function buildInsights({ overall, byTeam, byPriority, weekly, recurring }, teamName) {
  const insights = [];
  const worst = byTeam[0];
  const best = byTeam[byTeam.length - 1];

  if (overall.breaches > 0) {
    const share = Math.round((worst.breaches / overall.breaches) * 100);
    insights.push(`**${teamName(worst.key)}** has the lowest SLA compliance (${worst.compliancePct}%) and accounts for ${share}% of all breaches. Recommendation: review on-call staffing, runbooks and handover practices for this team.`);
  }
  insights.push(`**${teamName(best.key)}** leads with ${best.compliancePct}% compliance and can serve as the internal benchmark for incident-handling practices.`);

  const worstPriority = [...byPriority].sort((a, b) => a.compliancePct - b.compliancePct)[0];
  insights.push(`**${worstPriority.key}** incidents have the weakest compliance (${worstPriority.compliancePct}%), using on average ${worstPriority.avgSlaUsedPct}% of their SLA window.`);

  const p1 = byPriority.find(p => p.key === "P1");
  if (p1 && p1.compliancePct < 90) {
    insights.push(`Critical (P1) compliance is ${p1.compliancePct}%, below a 90% target. Recommendation: page the team lead at the warning stage (75% of SLA used) instead of waiting for the breach.`);
  }

  if (recurring.length) {
    const top = recurring[0];
    insights.push(`"${top.key}" is the most frequent incident (${top.total} occurrences, ${top.breaches} breached). Recurring incidents signal an underlying problem; a root-cause analysis (ITIL problem management) could prevent repeats.`);
  }

  const solidWeeks = weekly.filter(w => w.total >= 5);
  if (solidWeeks.length >= 2) {
    const first = solidWeeks[0];
    const last = solidWeeks[solidWeeks.length - 1];
    const diff = Math.round((last.compliancePct - first.compliancePct) * 10) / 10;
    const trend = diff > 0 ? `improved by ${diff} points` : diff < 0 ? `declined by ${Math.abs(diff)} points` : "remained flat";
    insights.push(`Weekly compliance ${trend} between ${first.key} (${first.compliancePct}%) and ${last.key} (${last.compliancePct}%).`);
  }

  return insights;
}

// ---------- Output helpers ----------

const bar = pct => "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map(r => `| ${r.join(" | ")} |`)
  ].join("\n");
}

// ---------- Main ----------

async function main() {
  const uri = process.env.ANALYTICS_MONGO_URI;
  if (!uri) throw new Error("ANALYTICS_MONGO_URI is missing from .env");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(process.env.DB_NAME || "pulseops");
    const incidents = db.collection("incidents");
    const teams = await db.collection("teams").find().toArray();
    const teamName = code => teams.find(t => t.code === code)?.name || code;

    const [overallArr, byTeam, byPriority, weekly, recurring, openNow] = await Promise.all([
      incidents.aggregate(pipeline(null, { total: -1 })).toArray(),
      incidents.aggregate(pipeline("$team", { compliancePct: 1 })).toArray(),
      incidents.aggregate(pipeline("$priority", { key: 1 })).toArray(),
      incidents.aggregate(pipeline({ $dateToString: { format: "%G-W%V", date: "$createdAt" } }, { key: 1 })).toArray(),
      incidents.aggregate(pipeline("$title", { total: -1, breaches: -1 }, 5)).toArray(),
      incidents.countDocuments({ status: { $ne: "RESOLVED" } })
    ]);

    const overall = overallArr[0];
    if (!overall) {
      console.log("No resolved incidents found. Run the import first: curl -X POST localhost:3000/api/import");
      return;
    }

    // Governance check: the analyst account must not be able to write
    let writeCheck;
    try {
      await incidents.insertOne({ incidentId: "INC-WRITE-TEST" });
      writeCheck = "ALLOWED (unexpected — check roles!)";
    } catch (err) {
      writeCheck = `DENIED (${err.codeName || err.message})`;
    }

    const insights = buildInsights({ overall, byTeam, byPriority, weekly, recurring }, teamName);
    const generatedAt = new Date().toLocaleString("en-IN");

    // ----- Console output -----
    console.log("\n══════════ PulseOps SLA Performance Report ══════════");
    console.log(`Generated ${generatedAt} as pulse_analyst (read-only)\n`);
    console.log(`Resolved incidents : ${overall.total}`);
    console.log(`SLA compliance     : ${overall.compliancePct}%`);
    console.log(`Breaches           : ${overall.breaches}`);
    console.log(`Escalations        : ${overall.escalations}`);
    console.log(`Avg resolution     : ${overall.avgResolutionHrs} h`);
    console.log(`Currently open     : ${openNow}\n`);

    console.log("SLA compliance by team (worst first)");
    console.table(byTeam.map(t => ({
      Team: teamName(t.key), Incidents: t.total, Breaches: t.breaches,
      "Compliance %": t.compliancePct, "Avg hrs": t.avgResolutionHrs, "SLA used %": t.avgSlaUsedPct
    })));
    byTeam.forEach(t => console.log(`  ${t.key.padEnd(4)} ${bar(t.compliancePct)} ${t.compliancePct}%`));

    console.log("\nSLA compliance by priority");
    console.table(byPriority.map(p => ({
      Priority: p.key, Incidents: p.total, Breaches: p.breaches,
      "Compliance %": p.compliancePct, "Avg hrs": p.avgResolutionHrs
    })));

    console.log("Top recurring incidents");
    console.table(recurring.map(r => ({ Incident: r.key, Occurrences: r.total, Breaches: r.breaches })));

    console.log("Insights & recommendations");
    insights.forEach((text, i) => console.log(`  ${i + 1}. ${text.replace(/\*\*/g, "")}`));
    console.log(`\nGovernance check — analyst write attempt: ${writeCheck}`);

    // ----- Markdown report -----
    const md = `# PulseOps SLA Performance Report

_Generated ${generatedAt} by \`pulse_analyst\` (read-only role) using MongoDB aggregation pipelines._

## Key metrics

${mdTable(["Metric", "Value"], [
  ["Resolved incidents", overall.total],
  ["SLA compliance", `${overall.compliancePct}%`],
  ["SLA breaches", overall.breaches],
  ["Escalations", overall.escalations],
  ["Average resolution time", `${overall.avgResolutionHrs} h`],
  ["Currently open", openNow]
])}

## SLA compliance by team

${mdTable(["Team", "Incidents", "Breaches", "Compliance", "Avg resolution (h)", "Avg SLA used", "Compliance bar"],
  byTeam.map(t => [teamName(t.key), t.total, t.breaches, `${t.compliancePct}%`, t.avgResolutionHrs, `${t.avgSlaUsedPct}%`, `\`${bar(t.compliancePct)}\``]))}

## SLA compliance by priority

${mdTable(["Priority", "Incidents", "Breaches", "Compliance", "Avg resolution (h)", "Avg SLA used"],
  byPriority.map(p => [p.key, p.total, p.breaches, `${p.compliancePct}%`, p.avgResolutionHrs, `${p.avgSlaUsedPct}%`]))}

## Weekly trend

${mdTable(["Week", "Incidents", "Breaches", "Compliance"],
  weekly.map(w => [w.key, w.total, w.breaches, `${w.compliancePct}%`]))}

## Top recurring incidents

${mdTable(["Incident", "Occurrences", "Breaches"], recurring.map(r => [r.key, r.total, r.breaches]))}

## Insights and recommendations

${insights.map((t, i) => `${i + 1}. ${t}`).join("\n")}

## Governance check

Write attempt by the analyst account: **${writeCheck}**. Reporting runs under least privilege and cannot alter operational data.
`;

    const outPath = path.join(__dirname, "../docs/sla-report.md");
    await fs.writeFile(outPath, md, "utf8");
    console.log(`\n✔ Report written to docs/sla-report.md`);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error("✖ Report failed:", err.message);
  process.exit(1);
});