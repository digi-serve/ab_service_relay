/**
 * @query FindRequestUserInfo
 * Pull out the necessary User Info from the given AppUUID.
 * @param {ABUtils.reqService} req
 *        the Request Utility created by the service.
 * @param {string} AppUUID
 *        The UUID of the requested device install.  A User's device will
 *        create a unique AppUUID.
 * @param {string} tenant
 *        The UUID of the tenant that this UserInfo should be pulled from.
 * @return {object}
 *        {
 *          aes: <string>,
 *          user: <string>,          // MCC userUUID
 *          siteuser_guid: <string>, // site userUUID
 *        }
 */

module.exports = function (req, AppUUID, tenant) {
   return new Promise((resolve, reject) => {
      let conn = req.connections();

      // {string} tenantDB
      // the default format for the database name is "appbuilder-[tenantID]"
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

      let sql = `
         SELECT 
            au.aes, ru.user, ru.siteuser_guid
         FROM 
            ??.SITE_RELAY_APPUSER as au
            INNER JOIN ??.SITE_RELAY_USER as ru
               ON au.relayUser = ru.id
         WHERE 
            appUUID = ?
      `;

      req.query(sql, [tenantDB, tenantDB, AppUUID], (error, results /*, fields */) => {
         if (error) {
            req.log(`Error Resolving AppUUID[${AppUUID}]`, error);
            req.log(error.sql);
            reject(error);
         } else {
            if (results && results.length > 0) {
               resolve(results[0]);
               return;
            }
            resolve(null);
         }
      });
   });
};
