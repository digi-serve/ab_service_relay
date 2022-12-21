/**
 * @query FindRelayUserByMccUser
 * Find an existing SITE_RELAY_USER entry by the given MCC user UUID.
 *
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} mccUserUUID
 *        The UUID of the SITE_RELAY_USER.user field we are
 *        looking for.
 * @return {array} of stored requests.
 */

module.exports = function (req, mccUserUUID, tenant) {
   return new Promise((resolve, reject) => {
      let tenantDB = "appbuilder-admin";
      // {string} tenantDB
      // the DB name of the administrative tenant that manages the other
      // tenants.
      // By default it is `appbuilder-admin` but this value can be over
      // ridden in the  req.connections().site.database  setting.

      if (tenant) {
         tenantDB = `appbuilder-${tenant}`;
      } else {
         let conn = req.connections();
         if (conn.site && conn.site.database)
            tenantDB = conn.site.database;
      }

      let sql = "SELECT * FROM ??.`SITE_RELAY_USER` WHERE `user` = ?";

      req.query(sql, [tenantDB, mccUserUUID], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
