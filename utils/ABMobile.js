/**
 * ABMobile
 *
 * Interface for communicating with the MobileCommCenter (MCC).
 *
 */

const QRCode = require("qrcode");

/**
 * getQRCodeData
 * return the string to be embedded as a QR code
 * @param {string} token the registration token of the user.
 * @return {string}
 */
function getQRCodeData(req, token) {
   let error;
   if (!token) {
      error = new Error("Missing parameters to ABMobile.getQRCodeImage");
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
      return `${pwaURL}?JRR=${token}&tenant=${tenant}`;
   }
}

/**
 * getQRCodeImage
 * return a string with the encoded url data for the QR Code image.
 * @param {string} data  the data to encode in the QR Code.
 * @return {Promise}  resolved with {string} of QRCode Image.
 */
function getQRCodeImage(data) {
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
 * getQRCodeBase64
 * return the QRCodeImage in Base64 format
 * @param {string} data  the data to encode in the QR Code.
 * @return {Promise}  resolved with {Base64String} of QRCode Image.
 */
function getQRCodeBase64(data) {
   return getQRCodeImage(data).then((image) => {
      var base64QR = image.substring(22);
      var qrcodeBuffer = Buffer.from(base64QR, "base64");

      return qrcodeBuffer;
   });
}

module.exports = { getQRCodeData, getQRCodeImage, getQRCodeBase64 };

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
