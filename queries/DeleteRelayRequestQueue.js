/**
 * @query DeleteRelayRequestQueue
 * Create a SITE_RELAY_REQUEST_QUEUE entry
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {obj} request
 *        A key=>value hash of the new SITE_RELAY_REQUEST_QUEUE entry we are
 *        creating.
 * @return {array} of stored requests.
 */

module.exports = function (req, jobToken, tenant) {
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

      let sql = `DELETE FROM ??.SITE_RELAY_REQUEST_QUEUE WHERE jt = ? `;

      req.query(sql, [tenantDB, jobToken], (error, results /*, fields */) => {
         if (error) {
            req.log("Error creating RelayRequestQueue entry:", error);
            req.log(error.sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
