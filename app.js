//
// relay
// (Appbuilder} A service to handle the communications with our relay server.
//
const AB = require("@digiserve/ab-utils");
const ABRelay = require("./utils/ABRelay");

var controller = AB.controller("relay");

controller.afterStartup((req, cb) => {
   ABRelay.init(req)
      .then(() => {
         cb();
      })
      .catch((err) => {
         cb(err);
      });
});

// controller.beforeShutdown((req, cb)=>{ return cb(/* err */) });

controller.waitForDB = true;
// {bool} wait for mysql to be accessible before .init() is processed

controller.init();
