'use strict';

const config = require('../../config/import.config');
const request = require('request-promise');
const WebSocket = require('ws');
const Logger = require('../logger');
const log = new Logger({scope : 'validations etl'});
const colors = require('colors');
const PEER_PORT_REGEX = /7777/g;
const WS_PORT = '7007';
var port = config.get('port') || 7111;
const manifests = require('./manifests')(config.get('hbase'));
const validations = require('./validations')(config.get('hbase'),
  config.get('validator-config'));
const CronJob = require('cron').CronJob;
const geo = require('./geolocation')({
  hbase: config.get('hbase'),
  maxmind: config.get('maxmind')
});

const connections = {};

/**
 * requestSubscribe
 */

function requestSubscribe(ws, altnet) {
  if (altnet) {
    ws.send(JSON.stringify({
      id: 222,
      command: 'server_info'
    }));
  }

  ws.send(JSON.stringify({
    id: 1,
    command: 'subscribe',
    streams: [
      'validations'
    ]
  }));

  ws.send(JSON.stringify({
    id: 2,
    command: 'subscribe',
    streams: [
      'manifests'
    ]
  }));
}

/**
 * subscribe
 */

function subscribe(casinocoind) {
  const ip = (casinocoind.altnet ? 'wss://' : 'ws://') +
    casinocoind.ipp.replace(PEER_PORT_REGEX, WS_PORT);
  console.log(ip,'--------------------ip');

  // resubscribe to open connections
  if (connections[ip] &&
    connections[ip].readyState === WebSocket.OPEN) {
    try {
      requestSubscribe(connections[ip], casinocoind.altnet);
      return;

    } catch (e) {
      log.error(e.toString().red, ip.cyan);
      delete connections[ip];
    }

  } else if (connections[ip]) {
    connections[ip].close();
    delete connections[ip];
  }


  const ws = new WebSocket(ip);

  connections[ip] = ws;

  ws.public_key = casinocoind.public_key;

  // handle error
  ws.on('close', function() {
    console.log(this.url, '---------------------------this.url close');
    log.info(this.url.cyan, 'closed'.yellow);
    if (this.url && connections[this.url]) {
      delete connections[this.url];
    }
  });

  // handle error
  ws.on('error', function(e) {
    console.log(this.url, '---------------------------this.url error');
    if (this.url && connections[this.url]) {
      this.close();
      delete connections[this.url];
    }
  });

  // subscribe and save new connections
  ws.on('open', function() {
    console.log(this.url, '---------------------------this.url open');
    if (this.url && connections[this.url]) {
      requestSubscribe(this, casinocoind.altnet);
    }
  });

  // handle messages
  ws.on('message', function(message) {
    const data = JSON.parse(message);

    if (data.type === 'validationReceived') {
      data.reporter_public_key = connections[this.url].public_key;

      // Store master key if validation is signed
      // by a known valid ephemeral key
      const master_public_key = manifests.getMasterKey(
        data.validation_public_key);
      if (master_public_key) {
        data.ephemeral_public_key = data.validation_public_key
        data.validation_public_key = master_public_key
      }

      validations.handleValidation(data)
      .catch(e => {
        log.error(e);
      });

    } else if (data.type === 'manifestReceived') {
      manifests.handleManifest(data);

    } else if (data.error === 'unknownStream') {
      delete connections[this.url];
      log.error(data.error, this.url.cyan);

    } else if (data.id === 222) {
      connections[this.url].public_key = data.result.info.pubkey_node;
    }
  });
}

/**
 * getCasinocoinds
 */

function getCasinocoinds() {
  var url = 'http://localhost:' + port + '/v2/network/topology/nodes'  
  console.log(url, '-----------------------url');
  if (!url) {
    return Promise.reject('requires casinocoinds url');
  }

  return request.get({
    url: url,
    json: true
  }).then(d => {
    return d.nodes;
  });
}

/**
 * subscribeToCasinocoinds
 */

function subscribeToCasinocoinds(casinocoinds) {
  const nCasinocoind = casinocoinds.length.toString();
  const nConnections = Object.keys(connections).length.toString();

  log.info(('casinocoinds: ' + nCasinocoind).yellow);
  log.info(('connections: ' + nConnections).yellow);

  // Subscribe to validation websocket subscriptions from casinocoinds
  casinocoinds.forEach(casinocoind => {
    if (casinocoind.ip && casinocoind.port) {
      subscribe({
        ipp: casinocoind.ip + ':' + casinocoind.port,
        public_key: casinocoind.node_public_key
      });
    }
  });

  subscribe({
    ipp: 'ws://wst02.casinocoin.org:7007',
    public_key: 'altnet',
    altnet: true
  });

  return connections;
}

/**
 * geolocate
 */

function geolocate() {
  geo.geolocateNodes()
  .catch(e => {
    log.error(e);
  });
}

/**
 * start
 */

function refreshSubscriptions() {
  getCasinocoinds()
  .then(subscribeToCasinocoinds)
  .catch(e => {
    log.error(e.toString().red);
  });
}

manifests.start().then(() => {
  // refresh connections
  // every minute
  setInterval(refreshSubscriptions, 60 * 1000);
  refreshSubscriptions();
  validations.start();
  validations.verifyDomains()

  // setup cron job for geolocation
  const geoLocationCron = new CronJob({
    cronTime: '0 0 4 * * *',
    onTick: geolocate,
    start: true
  });
});
