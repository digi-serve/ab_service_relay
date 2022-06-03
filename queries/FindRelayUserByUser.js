/*
 * @query FindRelayUserByUser
 * Find an existing SITE_RELAY_USER entry by the given user.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} user
 *        The UUID of the SITE_RELAY_USER.user field we are
 *        looking for.
 * @return {array} of stored requests.
 */

module.exports = function (req, user) {
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

      let sql = `SELECT * FROM ${tenantDB}\`SITE_RELAY_USER\` WHERE user = ?`;

      req.query(sql, [user], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
