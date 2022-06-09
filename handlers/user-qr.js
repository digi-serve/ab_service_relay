/**
 * user-qr
 * our Request handler.
 */
const InitializeRelayUser = require("../queries/InitializeRelayUser");
const FindRelayUserByUser = require("../queries/FindRelayUserByUser");
const ABRelay = require("../utils/ABRelay");
const { getQRCodeData, getQRCodeBase64 } = require("../utils/ABMobile");
const crypto = require("crypto");
const async = require("async");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "relay.user-qr",

   inputValidation: {},

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/relay/user-qr-page.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      const siteUser = req._user.uuid;
      let registrationToken = null;
      let publicKey = null;
      let qrCodeImage = null;
      let deepLink = null;

      async.series(
         [
            // Initialize account and generate new registration token
            (next) => {
               InitializeRelayUser(req, siteUser)
                  .then(() => {
                     return FindRelayUserByUser(req, siteUser);
                  })
                  .then(([relayUser]) => {
                     registrationToken = relayUser.registrationToken;
                     publicKey = relayUser.rsa_public_key;
                     next();
                  })
                  .catch(next);
            },
            // Register the account with the MCC relay
            // Post the new token
            (next) => {
               const hasher = crypto.createHash("sha256");
               hasher.update(registrationToken);
               const hashedToken = hasher.digest("base64");

               ABRelay.post({
                  url: "/mcc/user",
                  data: {
                     user: siteUser,
                     tokenHash: hashedToken,
                     rsa: publicKey,
                  },
                  timeout: 8000,
               }).catch((err) => {
                  req.log("Error posting registration token to MCC", err);
               });
               // No need to wait for this to complete. Go to next now.
               next();
            },
            // Generate QR code image
            (next) => {
               deepLink = getQRCodeData(req, registrationToken);
               getQRCodeBase64(deepLink)
                  .then((image) => {
                     qrCodeImage = image;
                     next();
                  })
                  .catch(next);
            },
         ],
         (err) => {
            if (err) {
               req.log("Error on mobile account page", err);
               cb(err);
            } else {
               cb(null, qrCodeImage);
            }
         }
      );
   },
};
