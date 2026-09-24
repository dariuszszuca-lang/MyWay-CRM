#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Explicit target: never inherit a Firebase/GCP CLI default project.
project='myway-crm-a4593'
account="myway-phone-reports@${project}.iam.gserviceaccount.com"
case "${1:---plan}" in
  --plan)
    cat <<EOF
Target: ${project}; europe-west1; codebase telephony; Node.js 22.
Requires approved, provisioned service account: ${account}
Deploy only firestore.rules and functions:telephony:phoneReportsScheduled.
Existing functions and frontend are outside this script.
No cloud writes in --plan mode. Execute --apply only after owner's approval.
EOF
    ;;
  --apply)
    if [[ -n "$(git status --porcelain --untracked-files=no -- App.tsx components services functions/telephony firestore.rules firebase.telephony-deploy.json)" ]]; then
      echo 'STOP: commit application changes before deployment.' >&2
      exit 1
    fi
    gcloud iam service-accounts describe "$account" --project "$project" --format='value(email)'
    firebase deploy --project "$project" --config firebase.telephony-deploy.json \
      --only 'firestore:rules,functions:telephony:phoneReportsScheduled'
    ;;
  *) echo 'Usage: bash tools/deploy-telephony.sh [--plan|--apply]' >&2; exit 2 ;;
esac
