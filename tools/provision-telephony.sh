#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project='myway-crm-a4593'
sa="myway-phone-reports@${project}.iam.gserviceaccount.com"
if [[ "${1:---plan}" != '--apply' ]]; then
  echo "Plan: create ${sa}, custom role mywayPhoneReports (4 document permissions, no delete), database-scoped binding."
  exit 0
fi
gcloud iam service-accounts create myway-phone-reports --project "$project" --display-name='MyWay Phone Reports'
gcloud iam roles create mywayPhoneReports --project "$project" --file tools/infra/phone-report-role.yaml
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:${sa}" --role="projects/${project}/roles/mywayPhoneReports" --condition='expression=resource.name=="projects/myway-crm-a4593/databases/(default)",title=myway-phone-default-db' --format='value(etag)'
