# PulseOps SLA Performance Report

_Generated 20/11/2026, 6:30:44 PM by `pulse_analyst` (read-only role) using MongoDB aggregation pipelines._

## Key metrics

| Metric | Value |
|---|---|
| Resolved incidents | 122 |
| SLA compliance | 78.7% |
| SLA breaches | 26 |
| Escalations | 13 |
| Average resolution time | 20.5 h |
| Currently open | 2 |

## SLA compliance by team

| Team | Incidents | Breaches | Compliance | Avg resolution (h) | Avg SLA used | Compliance bar |
|---|---|---|---|---|---|---|
| Network Operations | 30 | 16 | 46.7% | 22.3 | 120% | `█████████░░░░░░░░░░░` |
| Application Support | 24 | 7 | 70.8% | 18.9 | 77% | `██████████████░░░░░░` |
| Database Services | 43 | 3 | 93% | 21.6 | 67% | `███████████████████░` |
| Security Operations | 25 | 0 | 100% | 18.2 | 61% | `████████████████████` |

## SLA compliance by priority

| Priority | Incidents | Breaches | Compliance | Avg resolution (h) | Avg SLA used |
|---|---|---|---|---|---|
| P1 | 8 | 2 | 75% | 3.3 | 82% |
| P2 | 36 | 11 | 69.4% | 6.6 | 101% |
| P3 | 53 | 8 | 84.9% | 16.6 | 69% |
| P4 | 25 | 5 | 80% | 54.6 | 76% |

## Weekly trend

| Week | Incidents | Breaches | Compliance |
|---|---|---|---|
| 2026-W41 | 9 | 3 | 66.7% |
| 2026-W42 | 27 | 4 | 85.2% |
| 2026-W43 | 24 | 9 | 62.5% |
| 2026-W44 | 26 | 6 | 76.9% |
| 2026-W45 | 19 | 2 | 89.5% |
| 2026-W46 | 15 | 1 | 93.3% |
| 2026-W47 | 2 | 1 | 50% |

## Top recurring incidents

| Incident | Occurrences | Breaches |
|---|---|---|
| DNS resolution failures | 10 | 4 |
| Disk space alert on DB server | 10 | 0 |
| Expired SSL certificate | 10 | 0 |
| Deadlocks in order table | 8 | 2 |
| Connection pool exhausted | 7 | 0 |

## Insights and recommendations

1. **Network Operations** has the lowest SLA compliance (46.7%) and accounts for 62% of all breaches. Recommendation: review on-call staffing, runbooks and handover practices for this team.
2. **Security Operations** leads with 100% compliance and can serve as the internal benchmark for incident-handling practices.
3. **P2** incidents have the weakest compliance (69.4%), using on average 101% of their SLA window.
4. Critical (P1) compliance is 75%, below a 90% target. Recommendation: page the team lead at the warning stage (75% of SLA used) instead of waiting for the breach.
5. "DNS resolution failures" is the most frequent incident (10 occurrences, 4 breached). Recurring incidents signal an underlying problem; a root-cause analysis (ITIL problem management) could prevent repeats.
6. Weekly compliance improved by 26.6 points between 2026-W41 (66.7%) and 2026-W46 (93.3%).

## Governance check

Write attempt by the analyst account: **DENIED (Unauthorized)**. Reporting runs under least privilege and cannot alter operational data.
