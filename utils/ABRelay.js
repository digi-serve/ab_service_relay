/**
 * ABRelay
 *
 * Interface for communicating with the MobileCommCenter (MCC).
 *
 */
const EventEmitter = require("events");
const RP = require("request-promise-native");
const crypto = require("crypto");

const CreateAppUser = require("../queries/CreateAppUser");
const CreateRelayRequestQueue = require("../queries/CreateRelayRequestQueue");
const DeleteRelayRequestQueue = require("../queries/DeleteRelayRequestQueue");
const FindAppUserByAppUUID = require("../queries/FindAppUserByAppUUID");
const FindRequestUserInfo = require("../queries/FindRequestUserInfo");
const FindPendingRequests = require("../queries/FindPendingRequests");
const FindRelayUserByUser = require("../queries/FindRelayUserByUser");
const FindRelayUserByMccUser = require("../queries/FindRelayUserByMccUser");

var cookieJar = RP.jar();

const baseURL = "http://api_sails:1337";
// {string} our connection to the api_sails service.
// since this is running inside a docker swarm, we can just reference
// it by it's docker container reference.

/**
 * CSRF
 * An object responsible for managing the CSRF token provided by our
 * api_sails server.
 */
var CSRF = {
   token: null,
   /**
    * Fetch the user's CSRF token from sails.js
    * @return {Promise}
    *    Resolves with the CSRF token string when it has been fetched
    */
   fetch: function (req) {
      return new Promise((resolve, reject) => {
         var options = {
            method: "GET",
            uri: baseURL + "/csrfToken",
            json: true,
            jar: cookieJar,
         };

         options.rejectUnauthorized = false;

         RP(options)
            .then((data) => {
               CSRF.token = data._csrf;
               resolve(CSRF.token);
            })
            .catch((err) => {
               var csrfError = new Error(
                  "ABRelay:: unable to get CSRF token: " + err.message
               );
               req.notify.developer(csrfError, { baseURL });
               reject(csrfError);
            });
      });
   },
};

class ABRelay extends EventEmitter {
   constructor() {
      super();
      this._RequestsInProcess = false;
      this._RetryInProcess = false;

      this._req = null;
      this.config = null;

      this.hasNotifyMccConnection = false;
      this.tenants = ["admin"];
   }

   init(req) {
      this._req = req;

      this.config = req.config();

      this.timerID = setInterval(() => {
         this.pollMCC().catch((/* err */) => {
            // error should already be handled in .pollMCC();
         });
      }, this.config.mcc.pollFrequency);

      return Promise.resolve();
   }
   ///
   /// MCC Connection methods
   ///

   /**
    * _formatRequestMCC()
    * make sure we properly format the request options for
    * communicating with our MCC.
    * @param {string} method
    *        the HTTP verb used for this request.
    * @param {string} dataField
    *        the property name where our data should end up.
    *        Different requests place it in different properties.
    * @param {json} opt
    *        Current options being used for the request
    *        .url {string} the api end point for our request.
    *        .timeout {int} timeout to wait for a connection
    *        .data {json} the data being sent to the mcc
    * @return {json}
    */
   _formatRequestMCC(method, dataField, opt) {
      var url = opt.url || "/";
      if (url[0] == "/") {
         url = this.config.mcc.url + url;
      }

      var options = {
         method: method,
         uri: url,
         headers: {
            authorization: this.config.mcc.accessToken,
         },
         timeout: opt.timeout || 30000, // 30s timeout to wait for a connection to the MCC
         time: true, // capture timing information during communications process
         resolveWithFullResponse: true,
         json: true, // Automatically stringifies the body to JSON
      };

      var data = opt.data || {};
      options[dataField] = data;

      return options;
   }

   /**
    * @method get()
    * We are requesting information from our MCC.
    * @param {json} opt
    *        The specific api information needed for this call.
    * @return {Promise}
    */
   get(opt) {
      var options = this._formatRequestMCC("GET", "qs", opt);
      return RP(options)
         .then((fullResponse) => {
            // this._req.log('    response:', fullResponse.timings, fullResponse.timingPhases);
            return fullResponse.body; // just send back the body as a simple response
         })
         .catch((err) => {
            let errStr = err.toString();
            if (errStr.indexOf("ECONNREFUSED") > -1) {
               if (!this.hasNotifyMccConnection) {
                  this._req.notify.developer(err, {
                     context: "ABRelay:get(): Error connecting with MCC",
                     options,
                  });

                  // only post this notification every 2 min ...

                  this.hasNotifyMccConnection = true;
                  setTimeout(() => {
                     this.hasNotifyMccConnection = false;
                  }, 2 * 60 * 1000); // every 2 min
               }
            }
         });
   }

   /**
    * @method post()
    * We are responding to a request that we have processed.
    * @param {json} opt
    *        The specific api information needed for this call.
    * @return {Promise}
    */
   post(opt) {
      var options = this._formatRequestMCC("POST", "body", opt);
      return RP(options).then((fullResponse) => {
         // sails.log('    response:', fullResponse.timings, fullResponse.timingPhases);
         return fullResponse.body; // just send back the body as a simple response
      });
   }

   //
   // Sails Connection Methods
   //

   /**
    * @method _formatServerRequest
    * create the parameters necessary for us to pass the request on
    * to the api_sails server:
    * @param {obj} opt
    *        the passed in request options
    * @param {ABRelayUser} relayUser
    *        the relayUser making this request.
    * @return {obj}
    */
   _formatServerRequest(opt, relayUser) {
      var method = opt.type || opt.method || "GET";
      var dataField = "body";

      switch (method) {
         case "GET":
            dataField = "qs";
            break;
         case "POST":
            dataField = "body";
            break;
      }

      var url = opt.url || "/";
      if (url[0] == "/") {
         url = baseURL + url;
      }

      // Authorization header format: "relay@@@<mcc token>@@@<site_user UUID>"
      var authHeader =
         "relay@@@" + this.config.mcc.accessToken + "@@@" + relayUser.siteuser_guid;

      var options = {
         method: method,
         uri: url,
         headers: opt.headers || {},

         json: true, // Automatically stringifies the body to JSON
      };

      options.headers.authorization = authHeader;

      var data = opt.data || opt.params || {};
      options[dataField] = data;

      // CSRF Token
      if (method != "GET") {
         options.headers["X-CSRF-Token"] = CSRF.token;
         options.jar = cookieJar;
      }

      // default for all https requests
      // (whether using https directly, request, or another module)
      // require('https').globalAgent.options.ca = rootCas;
      // options.globalAgent = {
      //     options:{
      //         ca : rootCas
      //     }
      // }
      //// LEFT OFF HERE:
      // debugging RelayServer to make request to AppBuilder
      // 1) having problems with SSL certs: currently doing this:
      options.rejectUnauthorized = false;

      // but that isn't very safe...

      return options;
   }

   /**
    * @method encrypt()
    * return an AES encrypted blob of the stringified representation of the given
    * data.
    * @param {obj} data
    * @param {string} key
    *        the AES key to use to encrypt this data
    * @return {string}
    */
   encrypt(data, key) {
      var encoded = "";

      if (data && key) {
         // Encrypt data
         var plaintext = JSON.stringify(data);
         var iv = crypto.randomBytes(16).toString("hex");

         var cipher = crypto.createCipheriv(
            "aes-256-cbc",
            Buffer.from(key, "hex"),
            Buffer.from(iv, "hex")
         );
         var ciphertext = cipher.update(plaintext, "utf8", "base64");
         ciphertext += cipher.final("base64");

         // <base64 encoded cipher text>:::<hex encoded IV>
         encoded = ciphertext.toString() + ":::" + iv;
      }

      return encoded;
   }

   /**
    * @method decrypt()
    * return a javascript obj that represents the data that was encrypted
    * using our AES key.
    * @param {string} data
    * @param {string} key
    *        The AES key in hex format
    * @return {obj}
    */
   decrypt(data, key) {
      var finalData = null;

      // Expected format of encrypted data:
      // <base64 encoded ciphertext>:::<hex encoded IV>
      var dataParts = data.split(":::");
      var ciphertext = dataParts[0];
      var iv = dataParts[1];

      try {
         var decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            Buffer.from(key, "hex"),
            Buffer.from(iv, "hex")
         );
         var plaintext = decipher.update(ciphertext, "base64", "utf8");
         plaintext += decipher.final("utf8");

         // Parse JSON
         try {
            finalData = JSON.parse(plaintext);
         } catch (err) {
            finalData = plaintext;
         }
      } catch (err) {
         // could not decrypt
         this._req.notify.developer(err, {
            context: "ABRelay.decrypt(): Unable to decrypt AES",
         });
      }

      return finalData;
   }

   /**
    * packIt
    * a recursive routine to break our data down into approved packet sizes to prevent
    * 413 Request Entity Too Large - errors.
    * @param {string} data  the encrypted data chunk we are evaluating
    * @param {array}  list  the list of data chunks we are sending back
    */
   packIt(data, list) {
      if (data.length <= this.config.mcc.maxPacketSize) {
         list.push(data);
      } else {
         // split the data into 1/2
         let n = Math.floor(data.length / 2);

         let arrayFirstHalf = data.slice(0, n); // data[0:n];
         let arraySecondHalf = data.slice(n, data.length); // data[n:];

         // now send each half (in order) to packIt
         this.packIt(arrayFirstHalf, list);
         this.packIt(arraySecondHalf, list);
      }
   }

   /**
    * @method pollMCC()
    * Initiate a connection to our MCC and pull any pending communication packets
    * from our users.
    */
   pollMCC() {
      return new Promise((resolve, reject) => {
         if (!this.config.mcc.enabled) {
            resolve();
            return;
         }

         // 1) get any key resolutions and process them
         this.get({ url: "/mcc/initresolve" })
            .then((response) => {
               var all = [];
               if (response) {
                  (response.data || []).forEach((entry) => {
                     all.push(this.resolve(entry));
                  });
               }
               return Promise.all(all);
            })

            // 2) get any message requests and process them
            .then(() => {
               // if we are still processing a previous batch of requests
               // skip this round.
               if (this._RequestsInProcess) {
                  return;
               }

               return this.get({ url: "/mcc/relayrequest" }).then(
                  (response) => {
                     if (response) {
                        this._RequestsInProcess = true;
                        this.processRequests(response.data, (/* err */) => {
                           this._RequestsInProcess = false;
                        });
                     }
                  }
               );
            })
            // 3) check for any old requests in our ABRelayRequestQueue and process them
            .then(async () => {
               // if we are already processing our retries, then skip
               if (this._RetryInProcess) {
                  return;
               }

               const now = new Date();
               const seconds = (this.config.mcc.pollFrequency || 5000) * 2;
               const timeout = new Date(now.getTime() - seconds);

               // need to check each tenant db for pending requests
               const allRequests = [];
               await this.tenants.forEach(async (tenant) => {
                  const listOfRequests = await FindPendingRequests(
                     this._req,
                     timeout,
                     tenant
                  );
                  if (listOfRequests && listOfRequests.length > 0) {
                     this._req.log(
                        `ABRelay.Poll():Found Old Requests : ${listOfRequests.length}`
                     );

                     // convert requests to array of just request data.
                     listOfRequests.forEach((req) => {
                        // Don't log the full error on repeat requests
                        req.request.suppressErrors = true;
                        allRequests.push(req.request);
                     });
                  }
               });

               this._RetryInProcess = true;
               this.processRequests(allRequests, (/* err */) => {
                  this._RetryInProcess = false;
               });
            })
            .then(resolve)
            .catch((err) => {
               // if err was related to a timeout :
               // var error = new Error('Server Timeout')
               // error.error = err;
               // error.code = 'E_SERVER_TIMEOUT'
               // reject(error);

               reject(err);
            });
      });
   }

   /**
    * @method processRequests()
    * is an attempt to throttle the number of ABRelay requests we process at a time.
    * if we attempt too many, the server runs out of memory, so this fn() limits
    * the number of requests to [numParallel] requests at a time.  But each of those
    * "threads" will sequentially continue to process requests until the given list
    * is complete.
    * @param {ABUtil.} req
    * @param {array} allRequests
    *        an array of the request objects
    * @param {function} done
    *        the callback fn for when all the requests have been processed.
    */
   processRequests(allRequests, done) {
      ////
      //// Assemble packets into complete requests
      ////
      var jobs = {
         /*
         <jobToken>: {
            0: { <packet> },
            1: { <packet> },
            ...
         },
         ...
         */
      };
      allRequests.forEach((row) => {
         const jobToken = row.jobToken;
         jobs[jobToken] = jobs[jobToken] || {};
         jobs[jobToken][row.packet || 0] = row;
      });
      const assembledRequests = [];
      for (const jobToken in jobs) {
         1;
         const thisJob = jobs[jobToken];
         const somePacket = Object.values(thisJob)[0];
         const totalPackets = somePacket.totalPackets || 1;
         const appUUID = somePacket.appUUID;
         const tenant = somePacket.tenantUUID;
         let finalData = "";
         for (let i = 0; i < totalPackets; i++) {
            if (thisJob[i]) {
               finalData += thisJob[i].data;
            }
            // This should never happen because the relay will only send packets
            // together with the whole set.
            else {
               let message = `::: ABRelay job missing a packet [${i} / total ${totalPackets}]`;
               let err = new Error(message);
               this._req.notify.developer(err, {
                  context: message,
                  jobToken,
                  appUUID,
                  tenant,
               });
            }
         }
         assembledRequests.push({
            appUUID: appUUID,
            jobToken: jobToken,
            data: finalData,
            tenant,
         });
      }

      ////
      //// Attempt to throttle the number of requests we process at a time
      ////

      // processRequest()
      // processes 1 request, when it is finished, process another
      var processRequestSequential = (list, cb) => {
         if (list.length == 0) {
            // all done:
            cb();
         } else {
            const request = list.shift();
            this.request(request)
               .then(() => {
                  processRequestSequential(list, cb);
               })
               .catch((err) => {
                  this._req.log(
                     "::: ABRelay:processRequestSequential(): caught error: ",
                     err.message || err
                  );
                  cb(err);
               });
         }
      };

      // decide how many in parallel we will allow:
      // NOTE : we can run out of memory if we allow too many.
      const numParallel = this.config.mcc.numParallelRequests || 15;
      let numDone = 0;
      function onDone(err) {
         if (err) {
            done(err);
            return;
         }

         // once all our parallel tasks report done, we are done.
         numDone++;
         if (numDone >= numParallel) {
            // we are all done now.
            done();
         }
      }

      // fire off our requests in parallel.
      for (var i = 0; i < numParallel; i++) {
         processRequestSequential(assembledRequests, onDone);
      }
   }

   /**
    * @method resolve()
    * Resolve an iniitalization Key request packet.  When initially creating
    * a connection with a user's device, they will send us an encrypted aes
    * key to use for decoding their packets.
    * This is where we receive and store that key.
    * 
    * @param {object} entry
    *    A pollMCC() initresolve entry as produced by "GET /mcc/initresolve"
    *    {
    *       tenantUUID: <string>,
    *       appUUID: <string>,
    *       appID: <string>,
    *       rsa_aes: <string>,
    *       user: <string>, // MCC user uuid
    *    }
    */
   async resolve(entry) {
      try {
         const tenant = entry.tenantUUID;
         // make sure we don't already have an entry with the same .appUUID
         // there should be only one, so don't add a duplicate:
         const [existingAppUser] = await FindAppUserByAppUUID(
            this._req,
            entry.appUUID,
            tenant
         );
         if (existingAppUser) return;

         // find the ABRelayUser
         const [relayUser] = await FindRelayUserByMccUser(
            this._req,
            entry.user, // MCC user uuid (not site_user uuid)
            tenant
         );
         if (!relayUser) return;

         let values = null;

         const key = relayUser.rsa_private_key;
         try {
            const plaintext = crypto.privateDecrypt(
               {
                  key: key,
                  //padding: crypto.constants.RSA_NO_PADDING
                  padding: crypto.constants.RSA_PKCS1_PADDING,
                  //padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
               },
               Buffer.from(entry.rsa_aes, "base64")
            );
            if (plaintext) {
               values = {
                  relayUser: relayUser,
                  aes: plaintext.toString(),
               };
            }
         } catch (err) {
            // could not decrypt
            this._req.notify.developer(err, {
               context: "ABRelay:resolve(): Unable to decrypt RSA",
               entry,
            });
         }

         // Now create an AppUser entry connected to relayUser
         if (values) {
            var newAppUser = {
               relayUser: values.relayUser.id,
               aes: JSON.parse(values.aes).aesKey,
               appUUID: entry.appUUID,
               appID: entry.appID,
            };
            try {
               await CreateAppUser(this._req, newAppUser, tenant);
            } catch (err) {
               this._req.notify.developer(err, {
                  context:
                     "ABRelay:resolve():Unable to save New App User entry.",
               });
            }
         }
      } catch (err) {
         this._req.notify.developer(err, {
            context: "ABRelay:resolve(): Error resolving.",
         });
      }
      return;
   }

   request(request) {
      // request = {
      //     appUUID:'uuid',
      //     data: '<encryptedData>',
      //     jobToken: 'uuid',
      //     tenant: 'uuid'
      //     suppressErrors: boolean, // if true then don't log the full error
      // }
      const tenant = request.tenant;
      // var appUser = null;
      // var relayUser = null;

      var UserInfo = null;
      // {obj}
      // From FindRequestUserInfo() the user info needed to resolve this request
      // .aes : the AES decryption Key
      // .siteuser_guid : the user's uuid in their tenant's site_user table

      var errorOptions = null;

      return (
         Promise.resolve()

            // 0) store this request in our Queue
            .then(() => {
               return new Promise((resolve /*, reject*/) => {
                  // attempt to create this entry.
                  // if this is a retry, then this will error because the jt already exists,
                  // so just continue on anyway:
                  CreateRelayRequestQueue(
                     this._req,
                     {
                        jt: request.jobToken,
                        request: request,
                     },
                     tenant
                  )
                     .then(resolve)
                     .catch(resolve);
               });
            })

            // 1) get the RelayAppUser from the given appUUID
            .then(() => {
               return FindRequestUserInfo(
                  this._req,
                  request.appUUID,
                  tenant
               ).then((entry) => {
                  if (entry) {
                     // appUser = entry;
                     // relayUser = entry.relayUser;
                     UserInfo = entry;
                  } else {
                     let message = `ABRelay:request:(1) can not find ABRelayAppUser for appUUID:${request.appUUID}`;
                     var error = new Error(message);
                     if (!request.suppressErrors) {
                        this._req.notify.developer(error, {
                           context: message,
                           appUUID: request.appUUID,
                        });
                     }
                     throw error;
                  }

                  // return entry;
               });
            })

            // 2) Decode the data:
            .then(() => {
               return this.decrypt(request.data, UserInfo.aes);
            })

            // 2b) Make sure we have a CSRF token if we need one:
            .then((params) => {
               var method = params.type || params.method || "GET";
               if (method == "GET" || CSRF.token) {
                  return params;
               } else {
                  return CSRF.fetch(this._req).then((/* token */) => {
                     return params;
                  });
               }
            })

            // 3) use data to make server call:
            .then((params) => {
               // console.log('::: ABRelay.request(): params:', params);
               // params should look like:
               // {
               //     type:'GET',
               //     url:'/path/to/url',
               //     data:{ some:data },
               //     headers: { tenant-token: xxxxxxx }  : <--- New in v2
               // }

               var options = this._formatServerRequest(params, UserInfo);
               errorOptions = options;
               return new Promise((resolve, reject) => {
                  // console.log('::: ABRelay.request(): options:', options);
                  var lastError = null;

                  var tryIt = (attempt, cb) => {
                     if (attempt >= 5) {
                        cb(lastError);
                     } else {
                        // make the call
                        RP(options)
                           .then((response) => {
                              // pass back the default responses
                              cb(null, response);
                           })
                           .catch((err) => {
                              // if we received an error, check to see if it looks like a standard error
                              // response from our API.  If so, just return that:
                              if (err.error) {
                                 if (
                                    err.error.status == "error" &&
                                    err.error.data
                                 ) {
                                    //// NOTE: in v2, these errors should be handled on the server and
                                    //// not reported back:

                                    // // PROTOCOL_CONNECTION_LOST
                                    // // If we received a connection lost, then let's try to retry the attempt
                                    // if (
                                    //    err.error.data ==
                                    //    "PROTOCOL_CONNECTION_LOST"
                                    // ) {
                                    //    lastError = err;

                                    //    // let's try the command again:
                                    //    tryIt(attempt + 1, cb);
                                    //    return;
                                    // }

                                    // // if the error response was due to a connection fault with MySQL: try again
                                    // var messages = [
                                    //    "Handshake inactivity timeout",
                                    //    "Could not connect to MySQL",
                                    //    "Connection lost:",
                                    // ];
                                    // if (err.message) {
                                    //    var foundMessage = false;
                                    //    messages.forEach((m) => {
                                    //       if (err.message.indexOf(m) > -1) {
                                    //          foundMessage = true;
                                    //       }
                                    //    });
                                    //    if (foundMessage) {
                                    //       lastError = err;

                                    //       tryIt(attempt + 1, cb);
                                    //       return;
                                    //    }
                                    // }

                                    this._req.notify.developer(err, {
                                       context:
                                          "ABRelay:request(): response was an error: ",
                                       request: options,
                                       errorOptions,
                                    });

                                    err.error._request = {
                                       data:
                                          errorOptions.body || errorOptions.qs,
                                       method: errorOptions.method,
                                       uri: errorOptions.uri,
                                    };

                                    cb(null, err.error);
                                    return;
                                 }
                              }

                              // [Fix] Johnny
                              // it seems a web client disconnecting a socket can get caught in our
                              // process.  just try again:
                              var errorString = err.toString();
                              if (
                                 errorString.indexOf("Error: socket hang up") >
                                 -1
                              ) {
                                 lastError = err;
                                 tryIt(attempt + 1, cb);
                                 return;
                              }

                              // [Fix] Johnny
                              // if we get here and we have a 403: it is likely it is a CSRF mismatch error
                              // but in production, sails won't return 'CSRF mismatch', so lets attempt to
                              // retrieve a new CSRF token and try again:
                              if (
                                 errorString.indexOf("CSRF mismatch") > -1 ||
                                 (err.statusCode && err.statusCode == 403)
                              ) {
                                 this._req.log(
                                    "::: ABRelay.request(): attempt to reset CSRF token "
                                 );
                                 lastError = err;
                                 CSRF.token = null;
                                 CSRF.fetch(this._req).then((/* token */) => {
                                    tryIt(attempt + 1, cb);
                                 });
                                 return;
                              }

                              //// ACTUALLY no.  it there was an error that didn't follow our error format, then it was
                              // probably due to a problem with the request itself.  Just package an error and send it back:
                              var data = {
                                 status: "error",
                                 data: err,
                                 message: errorString,
                              };
                              this._req.log(
                                 "ABRelay:request(): response was an unexpected error: ",
                                 { request: options, error: data }
                              );
                              cb(null, data);
                           });
                     }
                  };
                  tryIt(0, (err, data) => {
                     if (err) {
                        reject(err);
                     } else {
                        resolve(data);
                     }
                  });
               });
            })

            // 4) encrypt the response:
            .then((response) => {
               return this.encrypt(response, UserInfo.aes);
            })

            // 4b) break the encrypted data in smaller packets
            .then((encryptedData) => {
               var packets = [];
               this.packIt(encryptedData, packets);
               return packets;
            })

            // 5) update MCC with the response for this request:
            .then((encryptedDataPackets) => {
               // sendOne()
               // recursive fn() to send off the responses to the MCC.
               // this should handle timeout errors and resend the missed attempts.
               var sendOne = (i, cb, retry = 0, lastErr = null) => {
                  if (retry >= 3) {
                     // Failed too many times:
                     this._req.notify.developer(lastErr, {
                        context:
                           "::: I'M STUCK ::: ABRelay:request():/mcc/relayrequest/: caught unexpected error in response to MCC",
                        request: errorOptions,
                     });

                     // an error with 1 packet will invalidate the whole response:
                     cb(lastErr);
                     return;
                  }

                  // if we have sent all the packets -> cb()
                  if (i >= encryptedDataPackets.length) {
                     cb();
                  } else {
                     var returnPacket = {
                        appUUID: request.appUUID,
                        data: encryptedDataPackets[i],
                        jobToken: request.jobToken,
                        packet: i,
                        totalPackets: encryptedDataPackets.length,
                     };

                     this.post({
                        url: "/mcc/relayrequest",
                        data: returnPacket,
                     })
                        .then((/* responseRP */) => {
                           // send the next one
                           sendOne(i + 1, cb);
                        })
                        .catch((err) => {
                           if (
                              (err.error && err.error.code == "ETIMEDOUT") ||
                              (err.message &&
                                 err.message.indexOf("ESOCKETTIMEDOUT") > -1)
                           ) {
                              this._req.log(
                                 `!!! time out error with MCC! [${i} / ${encryptedDataPackets.length}] jt[${request.jobToken}]`
                              );
                           } else {
                              // if this wasn't a ETIMEDOUT error, log it here:
                              // and don't print much of the data :
                              if (returnPacket.data.length > 10) {
                                 returnPacket.data = `${returnPacket.data.slice(
                                    0,
                                    10
                                 )} ...`;
                              }
                              this._req.log(
                                 `::: ABRelay:request():/mcc/relayrequest/:${retry}: caught unexpected error in response to MCC`,
                                 {
                                    error: err,
                                    request: errorOptions,
                                    response: returnPacket,
                                 }
                              );
                           }

                           // retry this one:
                           sendOne(i, cb, retry + 1, err);
                        });
                  }
               };

               return new Promise((resolve, reject) => {
                  sendOne(0, (err) => {
                     if (err) {
                        // Make sure we don't clear the RequestQueue entry on an
                        // error with the MCC.
                        err.__mccError = true;
                        return reject(err);
                     }
                     resolve();
                  });
               });
            })

            // now remove the request from our Queue:
            .then(() => {
               return DeleteRelayRequestQueue(this._req, request.jobToken);
               // return ABRelayRequestQueue.destroy({ jt: request.jobToken });
            })

            .catch((err) => {
               if (err.statusCode && err.statusCode == 413) {
                  this._req.log(
                     "::: ABRelay.request(): caught error: 413 Request Entity Too Large :" +
                        err.message
                  );
                  return;
               }

               // if this was a problem with communicating with api_sails:
               if (!err.__mccError) {
                  // on a forbidden, just attempt to re-request the CSRF token and try again?
                  if (
                     (err.statusCode && err.statusCode == 403) ||
                     err.toString().indexOf("CSRF") > -1
                  ) {
                     // if we haven't just tried a new token
                     if (!request.csrfRetry) {
                        this._req.log(
                           "::: ABRelay.request(): attempt to reset CSRF token "
                        );
                        request.csrfRetry = true;
                        CSRF.token = null;
                        return this.request(request);
                     }
                  }
               }

               // Requests that were previously queued will have errors simplified on the console log.
               // Full error messages repeating every 5 seconds can spiral out of control over time.
               if (request.suppressErrors) {
                  this._req.log(
                     "::: ABRelay.request(): caught error: ",
                     err.message || err
                  );
                  return;
               }

               this._req.notify.developer(err, {
                  context: "::: ABRelay.request(): caught error: ",
                  request: errorOptions,
               });
               // sails.log.error('::: ABRelay.request(): caught error:', err.statusCode || err, { request:errorOptions }, err.error, err);
            })
      );

      // that's it?
   }
}

module.exports = new ABRelay();
