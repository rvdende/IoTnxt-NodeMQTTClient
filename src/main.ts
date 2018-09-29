import { ConfigService } from './services/config-service';
import { PersistenceService } from './services/persistence/persistence-service';
import { IGatewayConfiguration } from './abstractions/IGatewayConfiguration'
import iotnxt = require("./utils/iotnxt.queueClient.v3");
import * as utils from './utils/trex.utils';


var starttime = Date.now();

var fs = require("fs");

/* ------------------------------------------------------------------------- */
import { config } from "./config";

utils.log("START");
utils.log("IoT.nxt " + iotnxt.version);
utils.log("T-Rex " + config.FirmwareVersion);
utils.log("CONFIG: "+ config.id);

/* ------------------------------------------------------------------------- */

let gateway: IGatewayConfiguration = {
  GatewayId: config.GatewayId,
  Make: config.Make,
  Model: config.Model,
  FirmwareVersion: config.FirmwareVersion,
  Location: config.Location,
  Secret: config.secretkey,
  Devices: {},
  GatewayFirstContact: false,
  IsIoTHubDevice: false,
  Config: {},
  ClientId: ""
}

// SPECIFY CLIENT SPECIFIC DEVICES:
import * as pluginRaspberrypi from "./plugins/raspberrypi/raspberrypi";

import { Devices } from "./client/devices";

gateway.Devices = Devices

var state: iotnxt.ITrexState = { "deviceGroups": {} };

import { trexVersion } from "./version"

iotnxt.updateState(state, "TREX|1:TREX|1", "BRANCH", trexVersion.branch);
iotnxt.updateState(state, "TREX|1:TREX|1", "VERSION", trexVersion.version);

//DEFAULTS ALL TO ZERO/FALSE/UNKNOWN
iotnxt.updateState(state, "TEMPSENSOR|1:TEMPSENSOR|1", "TEMPERATURE", "UNKNOWN");


/* ------------------------------------------------------------------------- */
// STARTUP/CONNECT

// Alternatively set this in /src/config.ts
//config.GatewayId = "CHANGETHIS";
//config.secretkey = "SOMERANDOMSECRETFROMHW";

gateway.GatewayId = config.GatewayId;
gateway.Secret = config.secretkey;

connectQueue();

/* ------------------------------------------------------------------------- */
// only to update timestamp
setInterval(function () { iotnxt.updateState(state, "TREX|1:TREX|1", "TIMESTAMPISO", new Date().toISOString()); }, 100);

// update sensors:
setInterval(function () {
  iotnxt.updateState(state, "TEMPSENSOR|1:TEMPSENSOR|1", "VALUE", Math.random()*100 );
  if (iotnxt.connected) { iotnxt.publishState(state); }
}, 2500); 

var heartbeat = setInterval(() => { 
  if (iotnxt.connected) { iotnxt.publishState(state); }
}, config.heartbeatInterval);

/* ------------------------------------------------------------------------- */

function connectQueue() {
  iotnxt.connect(config, gateway, { logging: true }, function (queue) {
    queue.subscribe(config.RoutingKeyBase + ".REQ");
    queue.on('message', handleIncomingRequests);
  });
}


function handleIncomingRequests(topic: any, message: any, packet: any) {
  var json = JSON.parse(message.toString());
  var payload = new Buffer(json.Payload, "base64");
  var payloadJSON = JSON.parse(payload.toString());

  console.log(payloadJSON);
}

/* ------------------------------------------------------------------------- */





/* ------------------------------------------------------------------------- */
/* PERSISTANCE */

async function persistance() {
  try {
    try {
      await PersistenceService.checkTableExists();
    } catch (error) {
      await PersistenceService.createTable()
    }

    //await setupConfig(); // Could read from a file in the future
    //setupDevices();
    //setHeartbeat();
    //setDeviceUpdate();

    iotnxt.publishHistorySeries();

  } catch (error) {
    console.error(error);
  }

}


persistance();

/* ------------------------------------------------------------------------- */
setInterval(function() {
  //check connection and reconnect
  if (iotnxt.connected) {
    utils.log("[IOTNXT] Connected.")
  } else {
    utils.log("[IOTNXT] Disconnected.")
    connectQueue();
  }
},30000)

/* ------------------------------------------------------------------------- */
// ERROR HANDLING

process.on('uncaughtException', function (err:Error) { })

/* ------------------------------------------------------------------------- */

fs.watchFile('version.js', (curr:any, prev:any) => { process.exit(); }); //auto restart on version update.

export function setRoutingKeyBase(inRoutingKeyBase:string) { config.RoutingKeyBase = inRoutingKeyBase; }