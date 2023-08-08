/**
 * app-qr
 * Returns a QR code to identify our Mobile Apps.  The encoded data is a url
 * to load the given Moble App.
 */
const { getQRCodeDataURL } = require("../utils/ABMobile");
const URL = require("node:url");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "relay.app-qr",

   inputValidation: {
      ID: { string: { uuid: true }, required: true },
      hostname: { string: true, required: true },
      protocol: { string: true, required: true },
      port: { string: true, required: true },
   },

   /**
    * Initializes a mobile account and generates the registration QR code for
    * the given user.
    *
    * The QR code is delivered in a base64 data URL format.
    *
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/relay/user-qr.js page.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: async function handler(req, cb) {
      try {
         const ID = req.param("ID");
         const hostname = req.param("hostname");
         const protocol = req.param("protocol");
         const port = req.param("port");

         req.log("ID=" + ID);
         req.log("Hostname=" + hostname);

         let url = new URL.URL("http://localhost");
         url.hostname = hostname;
         if (port != "") {
            url.port = port;
         }
         url.protocol = protocol;
         url.pathname = `/mobile/app/${req.tenantID()}/${ID}`;

         req.log("url:", url.toString());

         // OK, we need to
         // http -> https:
         // const qrCode = await getQRCodeDataURL(
         //    `${protocol}://${hostname}${
         //       port ? ":" + port : ""
         //    }/mobile/app/${ID}`
         // );

         const qrCode = await getQRCodeDataURL(url.toString());

         cb(null, qrCode);
      } catch (e) {
         cb(e);
      }
   },
};
