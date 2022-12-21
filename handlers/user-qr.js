/**
 * user-qr
 * Initialize a relay user account and post it to the relay server.
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
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/relay/user-qr-page.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: async function handler(req, cb) {
      try {
         const siteUserUUID = req._user.uuid;

         await InitializeRelayUser(req, siteUserUUID);
         const [relayUser] = await FindRelayUserByUser(req, siteUserUUID);
         const mccUserUUID = relayUser.user;
         const registrationToken = relayUser.registrationToken;
         const publicKey = relayUser.rsa_public_key;

         const hasher = crypto.createHash("sha256");
         hasher.update(registrationToken);
         const hashedToken = hasher.digest("base64");

         ABRelay.post({
            url: "/mcc/user",
            data: {
               user: mccUserUUID,
               tokenHash: hashedToken,
               rsa: publicKey,
            },
            timeout: 8000,
         }).catch((err) => {
            req.log("Error posting registration token to MCC", err);
         });

         const deepLink = getQRCodeData(req, registrationToken);
         const qrCode = await getQRCodeBase64(deepLink);

         cb(null, qrCode);
      } catch (e) {
         cb(e);
      }
   },
};
