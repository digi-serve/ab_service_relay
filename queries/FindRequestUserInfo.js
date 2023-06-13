/*
 * @query FindRequestUserInfo
 * Pull out the necessary User Info from the given AppUUID.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} AppUUID
 *        The UUID of the requested device install.  A User's device will
 *        create a unique AppUUID.
 * @param {string} tenant
 *        The UUID of the tenant that this UserInfo should be pulled from.
 * @return {array} of stored requests.
 */

module.exports = function (req, AppUUID, tenant) {
   return new Promise((resolve, reject) => {
      let tenantDB = `\`appbuilder-${tenant}\``;
      // {string} tenantDB
      // the default format for the database name is "appbuilder-[tenantID]"

      tenantDB += ".";

      let sql = `SELECT aes, user
      FROM ${tenantDB}\`SITE_RELAY_APPUSER\` as au
         INNER JOIN ${tenantDB}\`SITE_RELAY_USER\` as ru
            ON au.\`relayUser\` = ru.id
      WHERE appUUID = ?`;

      req.query(sql, [AppUUID], (error, results /*, fields */) => {
         if (error) {
            req.log(`Error Resolving AppUUID[${AppUUID}]`, error);
            req.log(error.sql);
            reject(error);
         } else {
            if (results && results.length > 0) {
               resolve(results[0]);
               return;
            }
            resolve(null);
         }
      });
   });
};
