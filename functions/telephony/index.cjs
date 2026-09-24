const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { generatePhoneReports } = require("./scheduler.cjs");
admin.initializeApp();

exports.phoneReportsScheduled = functions
  .region("europe-west1")
  .runWith({
    timeoutSeconds: 120,
    memory: "256MB",
    maxInstances: 1,
    serviceAccount:
      "myway-phone-reports@myway-crm-a4593.iam.gserviceaccount.com",
    labels: { project: "myway-crm", env: "prod", owner: "myway" },
  })
  .pubsub.schedule("30 0 * * *")
  .timeZone("Europe/Warsaw")
  .retryConfig({
    retryCount: 3,
    minBackoffDuration: "60s",
    maxBackoffDuration: "300s",
  })
  .onRun(async () => {
    const result = await generatePhoneReports(admin.firestore());
    console.log("Phone reports completed", { generated: result.generated });
    return null;
  });
