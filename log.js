// -------------------------------------------------------------------------------- //
// node-hss-skill
// Copyright 2020-2020 Patrick Fial
// log.js - Logger
// -------------------------------------------------------------------------------- //

// -------------------------------------------------------------------------------- //
// Imports
// -------------------------------------------------------------------------------- //

const winston = require('winston');

// -------------------------------------------------------------------------------- //
// Logging setup
// -------------------------------------------------------------------------------- //

const myFormat = winston.format.printf(({ level, message }) => {
   return `${level.toUpperCase()}:${message}`;
});

const transports = {
   console: new winston.transports.Console({ level: 'info' })
};

const logger = winston.createLogger({
   format: myFormat,
   transports: [
      transports.console
   ]
});

function log(level, self, message) {
   logger.log({ level, message: (self ? (self + ': ') : '') + (message || '') });
}

function getLogger(name, debugLevel) {
   if (debugLevel)
      transports.console.level = 'debug';

   return {
      debug: (msg) => log('debug', name, msg),
      info: (msg) => log('info', name, msg),
      warning: (msg) => log('warn', name, msg),
      error: (msg) => log('error', name, msg)
   }
}

// -------------------------------------------------------------------------------- //
// Out
// -------------------------------------------------------------------------------- //

module.exports = { getLogger };