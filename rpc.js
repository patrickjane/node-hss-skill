// -------------------------------------------------------------------------------- //
// node-hss-skill
// Copyright 2020-2020 Patrick Fial
// rpc.js - Skill implementation
// -------------------------------------------------------------------------------- //

// -------------------------------------------------------------------------------- //
// Imports
// -------------------------------------------------------------------------------- //

const net = require('net');

// -------------------------------------------------------------------------------- //
// class RpcClient
// -------------------------------------------------------------------------------- //

function RpcClient(port, baseSkill) {
   let client;
   let seq;
   let pending = {};
   let log = baseSkill.getLogger();

   let api = { connect, disconnect, execute }

   // -------------------------------------------------------------------------------- //
   // connect
   // -------------------------------------------------------------------------------- //

   function connect(cb) {
      let chunk = '';

      client = net.createConnection({ port }, () => { seq = 0; cb(); });

      client.on('data', _onData);
      client.on('end', () => log.debug('Disconnected from server'));

      function _onData(data) {
         chunk += data;

         if (chunk.indexOf('\n') != -1) {
            let msg = chunk.substr(0, chunk.indexOf('\n'));
            chunk = '';
            onMessage(msg);
         }
      }
   }

   // -------------------------------------------------------------------------------- //
   // disconnect
   // -------------------------------------------------------------------------------- //

   function disconnect(cb) {
      if (client) {
         client.end();
         client.destroy();
      }

      client = undefined;
      seq = 0;
   }

   // -------------------------------------------------------------------------------- //
   // onMessage
   // -------------------------------------------------------------------------------- //

   function onMessage(message) {
      let obj;

      try {
         obj = JSON.parse(message.replace('\\n', '\n'));
      } catch (e) {
         log.erro('Failed to parse RPC request (' + e + ')');
         return;
      }

      if (!obj.command || !obj.hasOwnProperty("seq")) {
        log.erro('Malformed RPC request from server received');
         return;
      }

      if (!pending[obj.seq + '']) {
        log.erro('No pending RPC request with seq "' + obj.seq + '", ignoring')
         return;
      }

      let cb = pending[obj.seq + ''];

      delete pending[obj.seq + ''];

      cb(obj.command, obj.payload);
   }

   // -------------------------------------------------------------------------------- //
   // execute
   // -------------------------------------------------------------------------------- //

   function execute(command, payload, cb) {
      let res = { seq: seq++, command };

      if (payload)
         res.payload = payload;

      let data = JSON.stringify(res).replace('\n', '\\n') + '\n';

      client.write(data, (err) => {
         if (err)
            log.erro('Error sending RPC response (' + err + ')');

         if (cb)
            pending[res.seq + ''] = cb;
      });
   }

   return api;
}

// -------------------------------------------------------------------------------- //
// class RpcServer
// -------------------------------------------------------------------------------- //

function RpcServer(port, baseSkill) {
   let server;
   let log = baseSkill.getLogger();

   let api = { start, stop }

   // -------------------------------------------------------------------------------- //
   // start
   // -------------------------------------------------------------------------------- //

   function start(cb) {
      server = net.createServer((socket) => {
         let chunk = '';

         socket.on('data', (data) => {
            chunk += data;

            if (chunk.indexOf('\n') != -1) {
               let msg = chunk.substr(0, chunk.indexOf('\n'));
               chunk = '';
               onMessage(msg, socket);
            }
         });
      });

      server.on('error', (err) => {
        log.erro('RPC server error: "' + err + '"');
      });

       server.listen(port, () => {
        log.debug('RPC server started on port ' + port);
         cb()
       });
   }

   // -------------------------------------------------------------------------------- //
   // onMessage
   // -------------------------------------------------------------------------------- //

   function onMessage(message, socket) {
      let obj;

      try {
         obj = JSON.parse(message.replace('\\n', '\n'));
      } catch (e) {
        log.erro('Failed to parse RPC request (' + e + ')');
         return;
      }

      if (!obj.command || !obj.hasOwnProperty("seq")) {
        log.erro('Malformed RPC request from server received');
         return;
      }

      baseSkill.handleRequest(obj.command, obj.payload, (err, res, command, cb) => {
         if (err) {
            log.erro('Handling RPC request failed ("' + err + '")');
            return;
         }

         write(socket, obj.seq, command || 'response', res, cb);
      });
   }

   // -------------------------------------------------------------------------------- //
   // stop
   // -------------------------------------------------------------------------------- //

   function stop() {
      if (server) {
         server.close();
      }
   }

   // -------------------------------------------------------------------------------- //
   // write
   // -------------------------------------------------------------------------------- //

   function write(socket, seq, command, payload, cb) {
      let res = { seq, command, payload: payload || null };

      let data = JSON.stringify(res).replace('\n', '\\n') + '\n';

      socket.write(data, (err) => {
         if (err)
            log.erro('Error sending RPC response (' + err + ')');

         if (cb)
            cb(err);
      })
   }

   return api;
}

// -------------------------------------------------------------------------------- //
// Out
// -------------------------------------------------------------------------------- //

module.exports = { RpcClient, RpcServer };