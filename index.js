// -------------------------------------------------------------------------------- //
// node-hss-skill
// Copyright 2020-2020 Patrick Fial
// index.js - Skill base class implementation
// -------------------------------------------------------------------------------- //

// -------------------------------------------------------------------------------- //
// Imports
// -------------------------------------------------------------------------------- //

const RpcClient = require('./rpc.js').RpcClient;
const RpcServer = require('./rpc.js').RpcServer;
const Logger = require('./log.js');

// -------------------------------------------------------------------------------- //
// class BaseSkill
// -------------------------------------------------------------------------------- //

function BaseSkill() {
   const args = require('minimist')(process.argv.slice(2));

   for (let required of ['skill-name', 'parent-port', 'port'])
      if (!args[required])
         throw new Error('Missing mandatory argument "' + required + '"');

   let api = { run, handleRequest, say, ask, getLogger };

   let skill;
   let log = Logger.getLogger(args["skill-name"], args["debug"] ? true : false)
   let rpcClient = RpcClient(args['parent-port'], api);
   let rpcServer = RpcServer(args['port'], api);

   // -------------------------------------------------------------------------------- //
   // run
   // -------------------------------------------------------------------------------- //

   function run(_skill) {
      skill = _skill;

      if (!skill.getIntentList)
         throw new Error('Skills must implement function "getIntentList"');

      if (!skill.handle)
         throw new Error('Skills must implement function "handle"');

      process.on('SIGTERM', () => {
         log.debug('SIGTERM signal received.');
         shutdown();
      });

      process.on('SIGINT', () => {
        log.debug('SIGINT signal received.');
         shutdown();
      });

      log.debug('Starting RPC server ...');

      rpcServer.start((err) => {
         if (err) {
            log.error('Error: Failed to start RPC server (' + err + ')');
            return;
         }

         log.debug('Connecting to skill server ...');

         rpcClient.connect((err) => {
            if (err) {
               log.error('Failed to connect to skill server (' + err + ')');
               return;
            }

            log.debug('Running.');
         });
      });
   }

   // -------------------------------------------------------------------------------- //
   // shutdown
   // -------------------------------------------------------------------------------- //

   function shutdown() {
      if (rpcClient)
         rpcClient.disconnect();

      if (rpcServer)
         rpcServer.stop();

      process.exit();
   }

   // -------------------------------------------------------------------------------- //
   // handleRequest
   // -------------------------------------------------------------------------------- //

   function handleRequest(command, payload, cb) {
      if (command == 'get_intentlist')
         return skill.getIntentList(cb);

      if (command == 'handle')
         return handleIntent(payload, cb)

         log.error('Unknown/invalid command "' + command + '" received, must skip');
   }

   // -------------------------------------------------------------------------------- //
   // handleIntent
   // -------------------------------------------------------------------------------- //

   function handleIntent(request, cb) {
      if (!request.intent || !request.intent.intentName) {
         log.error('Received message without "intentName", must skip');
         return cb();
      }

      let params = {};

      params.intentName = request.intent.intentName;
      params.sessionId = request.sessionId || null;
      params.siteId = request.siteId || null;
      params.slots = {};
      params._request = request;

      try {
         for (let s of request.slots) {
            if (!s.slotName)
               continue;

            if (params.slots[s.slotName]) {
               params.slots[s.slotName] = Array.isArray(slots[s.slotName]) ? slots[s.slotName] : [ slots[s.slotName] ];
               params.slots[s.slotName].push(s.value.value);
            } else {
               params.slots[s.slotName] = s.value.value;
            }
         }
      } catch (e) {
         log.error('Failed to parse slots (' + e + ')');
      }

      return skill.handle(params, _answer, _followup);

      function _answer(err, response, lang) {
         let payload = {
            "sessionId": params.sessionId,
            "siteId": params.siteId,
            "text": err ? null : response,
            "lang": lang || "en_GB"
        }

        cb(err, payload);
      }

      function _followup(err, response, lang, intentFilter) {
         let payload = {
            "sessionId": params.sessionId,
            "siteId": params.siteId,
            "question": err ? null : response,
            "lang": lang || "en_GB",
            "intentFilter": intentFilter
        }

        cb(err, payload);
      }
   }

   // -------------------------------------------------------------------------------- //
   // say
   // -------------------------------------------------------------------------------- //

   function say(text, siteId, lang, cb) {
      let payload = { text, siteId, lang };

      rpcClient.execute("say", payload, cb);
   }

   // -------------------------------------------------------------------------------- //
   // ask
   // -------------------------------------------------------------------------------- //

   function ask(text, lang, siteId, intentFilter, cb) {
      let payload = { text, lang, siteId, intentFilter }

      rpcClient.execute("ask", payload, cb);
   }

   // -------------------------------------------------------------------------------- //
   // getLogger
   // -------------------------------------------------------------------------------- //

   function getLogger() {
      return log;
   }

   return api;
}

// -------------------------------------------------------------------------------- //
// Out
// -------------------------------------------------------------------------------- //

module.exports = BaseSkill;