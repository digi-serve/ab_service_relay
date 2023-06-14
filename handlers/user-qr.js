/**
 * user-qr
 * our Request handler.
 */
const InitializeRelayUser = require("../queries/InitializeRelayUser");
const FindRelayUserByUser = require("../queries/FindRelayUserByUser");
const ABRelay = require("../utils/ABRelay");
const { getQRCodeData, getQRCodeBase64 } = require("../utils/ABMobile");
const crypto = require("crypto");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "relay.user-qr",

   inputValidation: {},

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
         const siteUser = req._user.uuid;

         await InitializeRelayUser(req, siteUser);
         const [relayUser] = await FindRelayUserByUser(req, siteUser);
         const registrationToken = relayUser.registrationToken;
         const publicKey = relayUser.rsa_public_key;

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
            throw err;
         });

         const deepLink = getQRCodeData(req, registrationToken);
         const qrCode = await getQRCodeDataURL(deepLink);

         cb(null, qrCode);
      } catch (e) {
         cb(e);
      }
   },
};
