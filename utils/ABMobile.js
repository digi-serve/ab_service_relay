/**
 * ABMobile
 *
 * Interface for communicating with the MobileCommCenter (MCC).
 *
 */

const QRCode = require("qrcode");

/**
 * return the string to be embedded as a QR code
 * @param {string} token the registration token of the user.
 * @return {string}
 */
function getQRCodeData(req, token) {
   let error;
   if (!token) {
      error = new Error("Missing parameters to ABMobile.getQRCodeData");
      error.code = "EMISSINGPARAMS";
      error.details = ["options.token"];
      req.log("ABMobile:getQRCodeData:Missing Data", {
         error: error,
      });
   }
   const pwaURL = req.config().pwaURL;
   if (!pwaURL) {
      error = new Error("appbuilder.pwaURL not set in config/local.js");
      error.code = "EMISSINGCONFIG";
      req.log("appbuilder.pwaURL not set in config/local.js", {
         error: error,
      });
   }
   const tenant = req._tenant ?? "admin";
   if (error) return "";
   else {
      return `${pwaURL}#JRR=${token}#tenant=${tenant}`;
   }
}

/**
 * Return the QR Code image as a base64 PNG data URL.
 * 
 * A data URL means all the data for the image is found in the URL itself.
 * The URL does not point to any location.
 * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
 * 
 * @param {string} data  the data to encode in the QR Code.
 * @return {Promise}  resolved with {string} of QRCode Image.
 */
function getQRCodeDataURL(data) {
   return new Promise((resolve, reject) => {
      QRCode.toDataURL(data, { margin: 0 }, (err, image) => {
         if (err) reject(err);
         else {
            resolve(image);
         }
      });
   });
}

/**
 * Return the QRCodeImage as PNG binary file data.
 * 
 * @param {string} data  the data to encode in the QR Code.
 * @return {Promise}  resolved with {Buffer} of the QRCode binary image.
 */
function getQRCodeImage(data) {
   return getQRCodeDataURL(data).then((image) => {
      // Convert the data URL into a binary image.
      var base64QR = image.substring(22);
      var qrcodeBuffer = Buffer.from(base64QR, "base64");

      return qrcodeBuffer;
   });
}

module.exports = { getQRCodeData, getQRCodeDataURL, getQRCodeImage };

// These were from v1, not sure if we need in v2

// /**
//  * registrationTokenForUser
//  * generate and return a new registration token for the provided User
//  * @param {string} userGUID  the user's GUID (siteuser.guid)
//  * @return {Promise}  resolved with {string} registrationToken
//  *                    or {undefined} if not found.
//  */
// registrationTokenForUser: function (userGUID) {
//    return ABRelayUser.initializeUser(userGUID)
//       .then(() => {
//          return ABRelayUser.findOne({ siteuser_guid: userGUID });
//       })
//       .then((ru) => {
//          if (ru) {
//             return ru.registrationToken;
//          }
//       });
// },

// /**
//  * app
//  * return the MobileApp for the provided appID
//  * @param {string} appID  the uuid of the Mobile App
//  * @return {Promise}  {MobileApp} if found, {undefined} if not.
//  */
// app: function (appID) {
//    return new Promise((resolve, reject) => {
//       AppBuilder.mobileApps()
//          .then((listApps) => {
//             var App = listApps.find((a) => {
//                return a.id == appID;
//             });
//
//             // just return whatever we found, even if nothing:
//             resolve(App);
//          })
//          .catch(reject);
//    });
// },
