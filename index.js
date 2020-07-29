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
const path = require("path");
const fs = require("fs");
const ini = require("ini");

// -------------------------------------------------------------------------------- //
// class BaseSkill
// -------------------------------------------------------------------------------- //

function BaseSkill(rootDirectory) {
   const args = require('minimist')(process.argv.slice(2));

   let debug = args && args['debug'];
   let develop = args && args['develop'];

   if (!develop) {
      for (let required of ['skill-name', 'parent-port', 'port'])
         if (!args[required])
            throw new Error('Missing mandatory argument "' + required + '"');
   }

   if (!rootDirectory)
      throw new Error('No root-directory given!')

   let api = { run, handleRequest, say, ask, getLogger, getConfig,
               getDefaultLanguage, setDefaultLanguage, getDebug, getDevelop, getSlotDictionary };

   let skill;
   let config;
   let log;
   let rpcClient;
   let rpcServer;
   let defaultLanguage;
   let skillJson;
   let slotDictionary;

   init();

   // -------------------------------------------------------------------------------- //
   // run
   // -------------------------------------------------------------------------------- //

   function run(_skill) {
      skill = _skill;

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
      if (command == 'handle')
         return handleIntent(payload, cb);

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
      params.mappedSlots = {}
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

            if (params.mappedSlots[s.slotName]) {
               params.mappedSlots[s.slotName] = Array.isArray(slots[s.slotName]) ? slots[s.slotName] : [ slots[s.slotName] ];
               params.mappedSlots[s.slotName].push(_slotIdentOf(s.entity, s.value.value));
            } else {
               params.mappedSlots[s.slotName] = _slotIdentOf(s.entity, s.value.value);
            }
         }
      } catch (e) {
         log.error('Failed to parse slots (' + e + ')');
      }

      try {
         skill.handle(params, _answer, _followup);
      } catch (e) {
         log.error('Skill failed to handle intent (' + e + ')');
      }

      function _answer(err, response, lang) {
         let payload = {
            "sessionId": params.sessionId,
            "siteId": params.siteId,
            "text": err ? null : response,
            "lang": lang || defaultLanguage
        }

        cb(err, payload);
      }

      function _followup(err, response, lang, intentFilter) {
         let payload = {
            "sessionId": params.sessionId,
            "siteId": params.siteId,
            "question": err ? null : response,
            "lang": lang || defaultLanguage,
            "intentFilter": intentFilter
        }

        cb(err, payload);
      }

      function _slotIdentOf(entity, value) {
         if (!slotDictionary || !slotDictionary[entity])
            return value;

         return slotDictionary[entity][value] || value;
      }
   }

   // -------------------------------------------------------------------------------- //
   // say
   // -------------------------------------------------------------------------------- //

   function say(text, lang, siteId, cb) {
      let payload = { text, siteId, lang: lang || defaultLanguage };

      rpcClient.execute("say", payload, cb);
   }

   // -------------------------------------------------------------------------------- //
   // ask
   // -------------------------------------------------------------------------------- //

   function ask(text, lang, siteId, intentFilter, cb) {
      let payload = { text, siteId, lang: lang || defaultLanguage, intentFilter }

      rpcClient.execute("ask", payload, cb);
   }

   // -------------------------------------------------------------------------------- //
   // getLogger
   // -------------------------------------------------------------------------------- //

   function getLogger() {
      return log;
   }

   // -------------------------------------------------------------------------------- //
   // getConfig
   // -------------------------------------------------------------------------------- //

   function getConfig() {
      return config;
   }

   // -------------------------------------------------------------------------------- //
   // setDefaultLanguage
   // -------------------------------------------------------------------------------- //

   function setDefaultLanguage(to) {
      defaultLanguage = to
   }

   // -------------------------------------------------------------------------------- //
   // getDefaultLanguage
   // -------------------------------------------------------------------------------- //

   function getDefaultLanguage() {
      return defaultLanguage;
   }

   // -------------------------------------------------------------------------------- //
   // getDebug
   // -------------------------------------------------------------------------------- //

   function getDebug() {
      return debug;
   }

   // -------------------------------------------------------------------------------- //
   // getDevelop
   // -------------------------------------------------------------------------------- //

   function getDevelop() {
      return develop;
   }

   // -------------------------------------------------------------------------------- //
   // getSlotDictionary
   // -------------------------------------------------------------------------------- //

   function getSlotDictionary() {
      return slotDictionary;
   }

   // -------------------------------------------------------------------------------- //
   // init
   // -------------------------------------------------------------------------------- //

   function init() {

      log = Logger.getLogger(args["skill-name"], args["debug"] ? true : false)
      rpcClient = RpcClient(args['parent-port'], api);
      rpcServer = RpcServer(args['port'], api);

      let exists = false;
      let configFilePath = path.join(rootDirectory, 'config.ini');
      let skillJsonPath = path.join(rootDirectory, 'skill.json');

      try { exists = fs.existsSync(configFilePath) } catch (e) {}

      if (configFilePath && exists) {
         try {
            config = ini.parse(fs.readFileSync(configFilePath, 'utf-8'));
         } catch (e) {
            log.error('Failed to parse file "' + configFilePath + '" (' + e + ')');
         }
      }

      if (config && config.skill && config.skill.language)
         defaultLanguage = config.skill.language;

      try {
         skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));

         if (!defaultLanguage && skillJson.language) {
            defaultLanguage = skillJson.language;

            if (Array.isArray(defaultLanguage))
               defaultLanguage = defaultLanguage[0];
         }
      } catch (e) {}

      if (!defaultLanguage)
         defaultLanguage = "en_GB";

      let slotDictPath = path.join(rootDirectory, 'slotsdict.' + defaultLanguage.toLowerCase() + '.json');

      try {
         if (fs.existsSync(slotDictPath)) {
            slotDictionary = {};

            try {
               slotsdict = JSON.parse(fs.readFileSync(slotDictPath, 'utf-8'));

               for (let key in slotsdict) {
                  if (!slotDictionary[key])
                     slotDictionary[key] = {};

                  for (let slotIdent in slotsdict[key]) {
                     for (let slotVal of slotsdict[key][slotIdent])
                        slotDictionary[key][slotVal] = slotIdent;
                  }
               }

            } catch (e) {
               log.error('Failed to parse file "' + slotDictPath + '" (' + e + ')');
            }
         }
      } catch (e) {}
   }

   return api;
}

// -------------------------------------------------------------------------------- //
// Out
// -------------------------------------------------------------------------------- //

module.exports = BaseSkill;