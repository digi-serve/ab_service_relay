/*
 * @query CreateAppUser
 * Create an AppUser entry.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {obj} appUser
 *        A key=>value hash of the new SITE_RELAY_APPUSER entry we are creating.
 * @return {array} of stored requests.
 */

module.exports = function (req, appUser) {
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

      let sql = `INSERT INTO ${tenantDB}\`SITE_RELAY_APPUSER\` SET ? `;

      req.query(sql, appUser, (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
