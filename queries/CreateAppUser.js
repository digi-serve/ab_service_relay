/**
 * @query CreateAppUser
 * Create an AppUser entry.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {obj} appUser
 *        A key=>value hash of the new SITE_RELAY_APPUSER entry we are creating.
 * @return {array} of stored requests.
 */

module.exports = function (req, appUser, tenant) {
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

      let sql = `INSERT INTO ??.SITE_RELAY_APPUSER SET ? `;

      req.query(sql, [tenantDB, appUser], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
