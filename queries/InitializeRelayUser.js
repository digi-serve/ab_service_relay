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
const FindRelayUserByUser = require("./FindRelayUserByUser");

module.exports = async function (req, user, options = {}) {
   let tenantDB = "`appbuilder-admin`";
   // {string} tenantDB
   // the DB name of the administrative tenant that manages the other
   // tenants.
   // By default it is `appbuilder-admin` but this value can be over
   // ridden in the  req.connections().site.database  setting.

   const conn = req.connections();
   if (conn.site && conn.site.database) tenantDB = `\`${conn.site.database}\``;
   tenantDB += ".";

   if (!user) {
      return new Error("Invalid userUUID");
   }

   // Check for existing Relay User
   const [relayUser] = await FindRelayUserByUser(req, user);

   // Generate RSA keys if needed
   let publicKey, privateKey;
   if (!relayUser || options.overwriteKeys) {
      const sslPrivate = child_process.spawnSync("openssl", ["genrsa", "2048"]);
      if (sslPrivate.error) {
         req.log("Error generating private key", sslPrivate.error);
      }
      privateKey = sslPrivate.stdout;

      var sslPublic = child_process.spawnSync(
         "openssl",
         ["rsa", "-outform", "PEM", "-pubout"],
         { input: privateKey }
      );
      if (sslPublic.error) {
         req.log("Error generating private key", sslPublic.error);
      }
      publicKey = sslPublic.stdout;
   }

   // Create Relay User if needed
   if (!relayUser) {
      const createRelaySql = `INSERT INTO ${tenantDB}\`SITE_RELAY_USER\` SET user = ? `;
      await new Promise((resolve) => {
         req.query(createRelaySql, user, (error /*, results , fields */) => {
            if (error) {
               req.log("Error creating Relay User:", error);
               req.log(error.sql);
            }
            resolve();
         });
      });
   }

   // Add new registration token
   const regTokenSql = `
      UPDATE ${tenantDB}\`SITE_RELAY_USER\`
      SET registrationToken = SHA2(CONCAT(RAND(), UUID()), 224)
      WHERE user = ?`;

   await new Promise((resolve) => {
      req.query(regTokenSql, [user], (error) => {
         if (error) {
            req.log("Error updating registrationToken:", error);
            req.log(error.sql);
         }
         resolve();
      });
   });

   // Save encryption keys if needed
   if (privateKey && publicKey) {
      const rsaKeysSql = `UPDATE ${tenantDB}\`SITE_RELAY_USER\`
               SET rsa_private_key = ?, rsa_public_key = ?
               WHERE user = ?`;
      await new Promise((resolve) => {
         req.query(rsaKeysSql, [privateKey, publicKey, user], (error) => {
            if (error) {
               req.log("Error updating rsa keys:", error);
               req.log(error.sql);
            }
            resolve();
         });
      });
   }

   return;
};
