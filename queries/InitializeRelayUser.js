/**
 * @query Initialize Relay User
 * Generate relay account registration token & encryption keys for a
 * given user.
 *
 * This is a slow process.
 *
 * If the account already exists, encryption keys will not be overwritten
 * unless requested in the options. The registration token will always be
 * overwritten.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} user UUID of the site_user
 * @param {object} options
 * @param {boolean} options.overwriteKeys whether or not to generate rsa keys
 * @return {array} of stored requests.
 */
const child_process = require("child_process");
const async = require("async");
const FindRelayUserByUser = require("./FindRelayUserByUser");

module.exports = function (req, user, options = {}) {
   return new Promise((resolve, reject) => {
      let tenantDB = "`appbuilder-admin`";
      // {string} tenantDB
      // the DB name of the administrative tenant that manages the other
      // tenants.
      // By default it is `appbuilder-admin` but this value can be over
      // ridden in the  req.connections().site.database  setting.

      const conn = req.connections();
      if (conn.site && conn.site.database)
         tenantDB = `\`${conn.site.database}\``;
      tenantDB += ".";

      if (!user) {
         reject(new Error("Invalid userUUID"));
         return;
      }

      let relayAccountExists = false;
      let privateKey, publicKey;

      async.series(
         [
            // Check for exisiting Realy User
            (next) => {
               FindRelayUserByUser(req, user).then((relayUser) => {
                  if (relayUser.length > 0) {
                     relayAccountExists = true;
                  }
                  next();
               });
            },
            // Generate Private Key
            (next) => {
               if (relayAccountExists && !options.overwriteKeys) {
                  return next();
               }
               child_process.exec("openssl genrsa 2048", (err, stdout) => {
                  if (err) next(err);
                  else {
                     privateKey = stdout;
                     next();
                  }
               });
            },

            // Generate Public key
            (next) => {
               if (relayAccountExists && !options.overwriteKeys) {
                  return next();
               }
               var proc = child_process.exec(
                  "openssl rsa -outform PEM -pubout",
                  (err, stdout) => {
                     if (err) next(err);
                     else {
                        publicKey = stdout;
                        next();
                     }
                  }
               );
               proc.stdin.write(privateKey);
               proc.stdin.end();
            },

            //CreateRelayUser
            (next) => {
               if (relayAccountExists) {
                  return next();
               }
               const sql = `INSERT INTO ${tenantDB}\`SITE_RELAY_USER\` SET user = ? `;

               req.query(sql, user, (error /*, results , fields */) => {
                  if (error) {
                     req.log("Error creating Relay User:", error);
                     req.log(error.sql);
                     next(error);
                  } else {
                     next();
                  }
               });
            },

            (next) => {
               // Add new registration token
               const sql = `
                  UPDATE ${tenantDB}\`SITE_RELAY_USER\`
                  SET registrationToken = SHA2(CONCAT(RAND(), UUID()), 224)
                  WHERE user = ?`;
               req.query(sql, [user], (error) => {
                  if (error) {
                     req.log("Error updating registrationToken:", error);
                     req.log(error.sql);
                     next(error);
                  } else {
                     next();
                  }
               });
            },

            // Save encryption keys if needed
            (next) => {
               if (!privateKey || !publicKey) {
                  return next();
               }
               const sql = `UPDATE ${tenantDB}\`SITE_RELAY_USER\`
               SET rsa_private_key = ?, rsa_public_key = ?
               WHERE user = ?`;

               req.query(sql, [privateKey, publicKey, user], (error) => {
                  if (error) {
                     req.log("Error updating rsa keys:", error);
                     req.log(error.sql);
                     next(error);
                  } else {
                     next();
                  }
               });
            },
         ],
         (err) => {
            if (err) reject(err);
            else resolve();
         }
      );
   });
};
