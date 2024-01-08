//
// relay
// (Appbuilder} A service to handle the communications with our relay server.
//
const AB = require("@digiserve/ab-utils");
const ABRelay = require("./utils/ABRelay");
const { version } = require("./package");
// Use sentry by default, but can override with env.TELEMETRY_PROVIDER
if (AB.defaults.env("TELEMETRY_PROVIDER", "sentry") == "sentry") {
   AB.telemetry.init("sentry", {
      dsn: AB.defaults.env(
         "SENTRY_DSN",
         "https://8091c7e67c9b481919fd49eecc9d81c5@o144358.ingest.sentry.io/4506143868059648"
      ),
      release: version,
   });
}

var controller = AB.controller("relay");

controller.afterStartup((req, cb) => {
   if (AB.defaults.env("RELAY_ENABLE", true)) {
      ABRelay.init(req)
         .then(() => {
            cb();
         })
         .catch((err) => {
            cb(err);
         });
      return;
   }
   console.log("=================");
   console.log("RELAY Not Enabled");
   console.log("=================");
   cb();
});

// controller.beforeShutdown((req, cb)=>{ return cb(/* err */) });

controller.waitForDB = true;
// {bool} wait for mysql to be accessible before .init() is processed

controller.init();
