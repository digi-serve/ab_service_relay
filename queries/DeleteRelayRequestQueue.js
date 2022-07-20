/*
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

      let sql = `DELETE FROM ${tenantDB}\`SITE_RELAY_REQUEST_QUEUE\` WHERE jt = ? `;

      req.query(sql, [jobToken], (error, results /*, fields */) => {
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
