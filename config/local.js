/*
 * relay
 */
const AB = require("@digiserve/ab-utils");
const env = AB.defaults.env;

module.exports = {
   relay: {
      /*************************************************************************/
      /* enable: {bool} is this service active?                                */
      /*************************************************************************/
      enable: env("RELAY_ENABLE", true),

      /*************************************************************************/
      /* Mobile Comm Center (mcc)                                              */
      // Specify the communications connection with our Public MCC             */
      /*************************************************************************/
      mcc: {
         /**********************************************************************/
         /* enable: {bool} is communicating with our MCC enabled?              */
         /**********************************************************************/
         enabled: env("RELAY_ENABLE", true),

         /**********************************************************************/
         /* url: {string} url connection to our MCC (include Port)             */
         /**********************************************************************/
         url: env("RELAY_SERVER_URL", "http://localhost:1337"),

         /**********************************************************************/
         /* accessToken: {string} required accessToken for sails to accept     */
         /**********************************************************************/
         accessToken: env("RELAY_SERVER_TOKEN", "There is no spoon."),

         /**********************************************************************/
         /* pollFrequency: {integer} frequency that we should poll the MCC     */
         /*                this value is in ms                                 */
         /**********************************************************************/
         pollFrequency: env("RELAY_POLL_FREQUENCY", 1000 * 5), // 5s

         /**********************************************************************/
         /* maxPacketSize: {integer} the max size of an encrypted packet we    */
         /*                want to send to the MCC                             */
         /**********************************************************************/
         maxPacketSize: env("RELAY_MAX_PACKET_SIZE", 1024 * 1024),
      },

      /**********************************************************************/
      /* url: {string} url of the Progressive Web App                       */
      /**********************************************************************/
      pwaURL: env("PWA_URL", "http://..."),
   },

   /**
    * datastores:
    * Sails style DB connection settings
    */
   datastores: AB.defaults.datastores(),
};
