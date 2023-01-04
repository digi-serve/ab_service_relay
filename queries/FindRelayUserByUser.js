/**
 * @query FindRelayUserByUser
 * Find an existing SITE_RELAY_USER entry by the given SITE_USER UUID.
 *
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} siteUserUUID
 *        The SITE_USER.uuid value of the user we are
 *        looking for.
 * @return {array} of stored requests.
 */

module.exports = function (req, siteUserUUID, tenant) {
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

      let sql = "SELECT * FROM ??.`SITE_RELAY_USER` WHERE `siteuser_guid` = ?";

      req.query(sql, [tenantDB, siteUserUUID], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
