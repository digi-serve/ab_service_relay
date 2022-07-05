/*
 * @query CreateRelayRequestQueue
 * Create a SITE_RELAY_REQUEST_QUEUE entry
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {obj} request
 *        A key=>value hash of the new SITE_RELAY_REQUEST_QUEUE entry we are
 *        creating.
 * @return {array} of stored requests.
 */
const Defaults = {
   jt: null,
   request: null,
};

module.exports = function (req, request) {
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

      var fieldOrder = ["jt", "request"];
      // {array}
      // The order of the fields in the DB.  This is the order they must
      // appear in the values[].

      let values = [
         request.jt ? request.jt : Defaults.jt,
         JSON.stringify(request.request ? request.request : Defaults.request),
      ];
      let QM = ["?", "?"];
      let sql = `INSERT INTO ${tenantDB}\`SITE_RELAY_REQUEST_QUEUE\` ( createdAt, ${fieldOrder.join(
         ", "
      )}) VALUES ( NOW(), ${QM.join(", ")} ) `;

      req.query(sql, values, (error, results /*, fields */) => {
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
