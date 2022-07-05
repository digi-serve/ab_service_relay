/*
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

      let sql = `SELECT * FROM ${tenantDB}\`SITE_RELAY_REQUEST_QUEUE\` WHERE createdAt <= ?`;

      req.query(sql, [timeout], (error, results /*, fields */) => {
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
