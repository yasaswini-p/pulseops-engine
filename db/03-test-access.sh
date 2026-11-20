#!/bin/bash
# PulseOps — Phase 1 evidence: proves each user can do ONLY what their role allows.
# Run after auth is enabled:  bash db/03-test-access.sh

URI="mongodb://localhost:27017/pulseops"
OUT="docs/access-control-test.txt"
: > "$OUT"

check() {  # $1=description  $2=user  $3=password  $4=authDB  $5=operation
  local js="try { $5; print('ALLOWED') } catch (e) { print('DENIED (' + e.codeName + ')') }"
  if [ -z "$2" ]; then
    result=$(mongosh "$URI" --quiet --eval "$js" 2>&1)
  else
    result=$(mongosh "$URI" --quiet -u "$2" -p "$3" --authenticationDatabase "$4" --eval "$js" 2>&1)
  fi
  printf "%-55s → %s\n" "$1" "$result" | tee -a "$OUT"
}

TEST_DOC='{incidentId:"INC-TEST", title:"Access test", priority:"P4", status:"OPEN", team:"APP", createdAt:new Date()}'

echo "PulseOps access-control test — $(date)" | tee -a "$OUT"
echo "-------------------------------------------------------------------------" | tee -a "$OUT"
check "1. No login reads incidents        (expect DENIED)"  ""              ""            ""         "db.incidents.findOne()"
check "2. Analyst reads teams             (expect ALLOWED)" "pulse_analyst" "Analyst@123" "pulseops" "db.teams.findOne()"
check "3. Analyst inserts incident        (expect DENIED)"  "pulse_analyst" "Analyst@123" "pulseops" "db.incidents.insertOne($TEST_DOC)"
check "4. Auditor reads audit logs        (expect ALLOWED)" "pulse_auditor" "Auditor@123" "pulseops" "db.audit_logs.findOne()"
check "5. Auditor reads incidents         (expect DENIED)"  "pulse_auditor" "Auditor@123" "pulseops" "db.incidents.findOne()"
check "6. App inserts incident            (expect ALLOWED)" "pulse_app"     "App@123"     "pulseops" "db.incidents.insertOne($TEST_DOC)"
check "7. App deletes incident            (expect DENIED)"  "pulse_app"     "App@123"     "pulseops" "db.incidents.deleteOne({incidentId:'INC-TEST'})"
check "8. App drops incidents collection  (expect DENIED)"  "pulse_app"     "App@123"     "pulseops" "db.incidents.drop()"
check "9. Admin cleans up test incident   (expect ALLOWED)" "pulse_admin"   "Admin@123"   "admin"    "db.incidents.deleteOne({incidentId:'INC-TEST'})"
echo "-------------------------------------------------------------------------" | tee -a "$OUT"
echo "Saved to $OUT"