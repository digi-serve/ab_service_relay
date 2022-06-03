/*
 * @query FindRequestUserInfo
 * Pull out the necessary User Info from the given AppUUID.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} AppUUID
 *        The UUID of the requested device install.  A User's device will
 *        create a unique AppUUID.
 * @return {array} of stored requests.
 */

module.exports = function (req, AppUUID) {
   return new Promise((resolve, reject) => {
      let tenantDB = "`appbuilder-admin`";
      // {string} tenantDB
      // the DB name of the administrative tenant that manages the other
      // tenants.
      // By default it is `appbuilder-admin` but this value can be over
      // ridden in the  req.connections().site.database  setting.

      let conn = req.connections();
      if (conn.site && conn.site.database)
         tenantDB = `\`${conn.site.database}\``;
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
