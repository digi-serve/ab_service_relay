/**
 * @query findPendingRequests
 * pull out any requests that have been stored in our SITE_RELAY_REQUEST_QUEUE.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {Date} timeout
 *        The timestamp of when we want to pull any pending requests.
 * @return {array} of stored requests.
 */

module.exports = function (req, timeout, tenant) {
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

      let sql = `SELECT * FROM ??.SITE_RELAY_REQUEST_QUEUE WHERE createdAt <= ?`;

      req.query(sql, [tenantDB, timeout], (error, results /*, fields */) => {
         if (error) {
            // req.log(sql);
            req.log(error);
            reject(error);
         } else {
            // convert .request to json object
            for (var i = 0; i < results.length; i++) {
               try {
                  results[i].request = JSON.parse(results[i].request);
               } catch (e) {
                  req.log("Invalid json result:");
                  req.log(results[i].request);
               }
            }
            resolve(results);
         }
      });
   });
};
