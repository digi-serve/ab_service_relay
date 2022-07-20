/*
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
      let tenantDB = "`appbuilder-admin`";
      // {string} tenantDB
      // the DB name of the administrative tenant that manages the other
      // tenants.
      // By default it is `appbuilder-admin` but this value can be over
      // ridden in the  req.connections().site.database  setting.
      if (tenant) {
         tenantDB = `\`appbuilder-${tenant}\``;
      } else {
         let conn = req.connections();
         if (conn.site && conn.site.database)
            tenantDB = `\`${conn.site.database}\``;
      }
      tenantDB += ".";

      let sql = `SELECT * FROM ${tenantDB}\`SITE_RELAY_APPUSER\` WHERE appUUID = ?`;

      req.query(sql, [AppUUID], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
