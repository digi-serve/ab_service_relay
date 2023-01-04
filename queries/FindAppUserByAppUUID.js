/**
 * @query FindAppUserByAppUUID
 * Find an existing AppUser entry by the given AppUUID.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} AppUUID
 *        The UUID of the requested device install.  A User's device will
 *        create a unique AppUUID.
 * @return {array} of stored requests.
 */

module.exports = function (req, AppUUID, tenant) {
   return new Promise((resolve, reject) => {
      let conn = req.connections();

      // {string} tenantDB
      // the DB name of the tenant.
      let tenantDB;

      // tenant ID was given
      if (tenant) {
         tenantDB = `appbuilder-${tenant}`;
      }
      // Use connection DB if available
      else if (conn.site && conn.site.database) {
         tenantDB = conn.site.database;
      }
      // Final fallback default
      else {
         tenantDB = "appbuilder-admin";
      }

      let sql = `SELECT * FROM ??.SITE_RELAY_APPUSER WHERE appUUID = ?`;

      req.query(sql, [tenantDB, AppUUID], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
