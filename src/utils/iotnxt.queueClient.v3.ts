
import mqtt = require('mqtt');
import { MqttClient } from 'mqtt';

import { PersistenceService, PUBLISHED_STATE } from './../services/persistence/persistence-service';

import * as cryptoUtil from './crypto.utils'
import * as trexUtil from './trex.utils'

import path = require("path");
import fs = require("fs");

import * as main from '../main'

import { IGatewayConfiguration } from '../abstractions/IGatewayConfiguration'

export var version: string = "3.3.1";

/* ------------------------------------------------------------------------- */

export interface ConnectionOptions {
    publickey: string,          // all from portal
    hostaddress: string,        // all from portal
    GatewayId: string,          // all from portal
    secretkey: string,         // generate from hash(gatewayid * hardwareserial)
    modulus: string,
    exponent: string,
}

export interface QueuePacketParameters {
    deviceGroups: object,
    tag: string
}

export interface QueuePacket {
    CommandText?: string,
    MessageId?: string,
    MessageSourceId?: null | string,
    PostUtc?: string,
    fromUtc? : string,
    sourceMessageID?: string,
    Headers?: IQueuePacketHeader,
    Parameters?: QueuePacketParameters
}

export interface IQueuePacketHeader {
    FileName: string
    Raptor: string
    Version: string
}

export interface ITrexState extends QueuePacket {
    deviceGroups?: Object
}



/* ------------------------------------------------------------------------- */

export var busyConnecting = false;
export var connected = false;

export var queue: MqttClient;
export var options: ConnectionOptions;
export var serversecret: any = {};

export async function connect(optionsIn: ConnectionOptions, gateway: IGatewayConfiguration, config: any, callback: (mqttClient: MqttClient) => void) {
    if (connected == true) { console.log("Already connected.")
    } else {
        if (busyConnecting == false) {
            //SPLIT THE PUBLICKEY
            optionsIn.modulus = optionsIn.publickey.split("<").join(',').split(">").join(',').split(',')[8]
            optionsIn.exponent = optionsIn.publickey.split("<").join(',').split(">").join(',').split(',')[4]
            options = optionsIn;

            if (config.logging) { trexUtil.log("IOTNXT CONNECTING...") }

            var AES = await cryptoUtil.genAESkeys();
            if (config.logging) { trexUtil.log("IOTNXT AES SUCCESS"); }

            var secret: any = await connectGreenQ(options, AES);

            if (secret.Success == false) {
                trexUtil.log("IOTNXT CONNECTION FAILURE")
                process.exit();
            }

            if (config.logging) { trexUtil.log("IOTNXT GREEN HANDSHAKE"); }

            var redqueue: MqttClient = await connectRedQ(options, secret);
            if (config.logging) { trexUtil.log("IOTNXT CONNECTED") }

            queue = redqueue;

            queue.on('reconnect', function () { trexUtil.log("Queue reconnected"); connected = false; });
            queue.on('close', function () { trexUtil.log("Queue disconnected"); connected = false; });
            queue.on('offline', function () { trexUtil.log("Queue has gone offline"); connected = false; });
            queue.on('error', function (error: any) { trexUtil.log("error: " + error); connected = false; });

            serversecret = secret;
            register(queue, secret, optionsIn, gateway);

            connected = true;
            busyConnecting = false;

            callback(queue);
        } else {
            console.warn("Already busy trying to connect... please wait.")
        }
    }
}

/* ------------------------------------------------------------------------- */


const connectGreenQ = function (options: ConnectionOptions, AES: any) {

    return new Promise(function (callback: any) {
        var greenOptions = {
            clientId: options.GatewayId + ".GREEN." + ((Date.now() * 10000) + 621355968000000000),
            username: "green1:public1",
            password: "publicpassword1",
            rejectUnauthorized: false
        }


        var replyKey = "MessageAuthNotify.".toUpperCase() + trexUtil.getGUID().toUpperCase();

        var mqttGreen = mqtt.connect("mqtts://" + options.hostaddress + ":8883", greenOptions);

        mqttGreen.on('connect', function () {

            mqttGreen.subscribe(replyKey, { qos: 0 }, function (err: any, granted: any) {

                if (granted) {
                    var messageAuthRequest = {
                        Uid: options.GatewayId,
                        SecretKey: options.secretkey,
                        PostUtc: new Date().toISOString(),
                        Headers: {}
                    }

                    var cipher = cryptoUtil.createCipheriv(AES);
                    var textBuffer = new Buffer(JSON.stringify(messageAuthRequest));
                    var encrypted = cipher.update(textBuffer)
                    var encryptedFinal = cipher.final()

                    var newBuffer = Buffer.concat([encrypted, encryptedFinal]);

                    var RSAcreds: cryptoUtil.RSAcredentials = {
                        modulus: options.modulus,
                        exponent: options.exponent
                    }

                    var wrappedMessage = {
                        Payload: newBuffer.toString("base64"),
                        IsEncrypted: true,
                        Headers: {
                            //SymKey: publicKeyRSA.encrypt(AES.key, "UTF8", "base64", ursa.RSA_PKCS1_PADDING).toString("base64"),
                            SymIv: cryptoUtil.RSAENCRYPT(AES.iv, RSAcreds),
                            SymKey: cryptoUtil.RSAENCRYPT(AES.key, RSAcreds)
                        },
                        PostUtc: new Date().toISOString(),
                        ReplyKey: replyKey.toUpperCase()
                    }

                    mqttGreen.publish("MESSAGEAUTHREQUEST", JSON.stringify(wrappedMessage), { qos: 1 }, function (err: any) {
                        if (err) { console.error("publisherror:" + err) }
                    });

                }
            });
            ///
        });

        mqttGreen.on('error', function (err: any) { console.error(err); })

        mqttGreen.on('message', function (topic: string, message: Buffer, packet: any) {
            var json = JSON.parse(message.toString());
            var payload = new Buffer(json.Payload, "base64");
            var decipher = cryptoUtil.createDecipheriv(AES);
            var result = Buffer.concat([decipher.update(payload), decipher.final()]);
            var secret = JSON.parse(result.toString());
            callback(secret);
        });


    })
}



/* ------------------------------------------------------------------------- */

const connectRedQ = function (options: ConnectionOptions, secret: any) {
    return new Promise(function (callback: (mqttClient: MqttClient) => void): void {
        var redoptions = {
            clientId: secret.ClientId + ".RED." + ((Date.now() * 10000) + 621355968000000000),
            username: secret.vHost + ":" + options.GatewayId,
            password: secret.Password,
            rejectUnauthorized: false,
            keepalive: 5
        }

        if (secret.Success) {
            //console.log("SUCCESS IT WORKED")
            //console.log(secret.Hosts[0])
            main.setRoutingKeyBase(secret.RoutingKeyBase);
            //callback("redqueue");
            var mqttRed: MqttClient = mqtt.connect("mqtts://" + secret.Hosts[0] + ":8883", redoptions);
            mqttRed.on('connect', function () {
                callback(mqttRed);
            });
        }


    })
}

/* ------------------------------------------------------------------------- */

export function conformPacket(input: Object) {
    var output = input;
    return output;
}

export function logger(input: any) {
    //console.log(input);
}

export function heartbeat(interval: number) {
    console.log("Enabling heartbeat at " + interval + "ms interval")
}

var lastState:ITrexState = {};

export function publishState(stateIn: ITrexState) {

    var newState = JSON.parse(JSON.stringify(stateIn));

    //Diff compression (optimize sending only new data);
    var diffState = trexUtil.difference(newState, lastState)    
    
    // uncomment to see new data
    console.log(JSON.stringify(diffState, null, 2));

    lastState = JSON.parse(JSON.stringify(stateIn)); //store data for next packet

    var packet : any = diffState;

    ///////

    packet.CommandText = "DigiTwin.Notification";
    packet.Headers = {
        "FileName": "",
        "Version": "2.15.0",
        "Raptor": "000000000000"
    };

    var dateNow = new Date();
    var fromUtc = new Date(dateNow.getTime() - 15 * 1000)

    packet.MessageId  = trexUtil.getGUID();
    packet.PostUtc = dateNow.toISOString();
    packet.MessageSourceId = null;
    packet.fromUtc = fromUtc.toISOString();
    packet.sourceMessageID = trexUtil.getGUID();

    var textBuffer = new Buffer(JSON.stringify(packet));

    var wrappedMessage = {
        Payload: textBuffer.toString("base64"),
        IsEncrypted: false,
        Headers: {},
        PostUtc: new Date().toISOString()
    }

    //Persist state before sending
    PersistenceService.insert(packet)

    try {

        var routingkey = serversecret.RoutingKeyBase + ".NFY"

        queue.publish(routingkey, JSON.stringify(wrappedMessage), { qos: 1 }, function (err, responsePacket:any) {
            if (err) { console.log("ERROR:" + err) }
            //console.log(`Queue publish response:  [${JSON.stringify(responsePacket)}]`)
            
            responsePacket.cmd == 'publish' ? PersistenceService.updateMessageState(packet.MessageId, PUBLISHED_STATE.PUBLISH_SUCCESS) : null;
            //trexUtil.log(`[Persistence] Updating message [${packet.MessageId}] to sent`)
        });

    } catch (err) {
        //console.error(`Failed to publish packet - \n Error : [${err}] \n [${JSON.stringify(wrappedMessage)}]`);
     }

}


export function updateState(state: any, deviceName: string, valuename: string, dataIn: any) {
    try {
        if (!state.deviceGroups) { state.deviceGroups = {}; }
        if (!state.deviceGroups[deviceName]) { state.deviceGroups[deviceName] = {}; }
        var before = state.deviceGroups[deviceName][valuename];
        state.deviceGroups[deviceName][valuename] = dataIn;
        
        if (before != dataIn) { 
            return { updated: 1 } 
        } else {
            return { updated: 0 }
        }

    } catch (err) {
        console.error(`Error updating state - Error : [${err}]`)
        return err;
    }
}



export async function tryPublishHistoryPacket(packet: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {

        var textBuffer = new Buffer(JSON.stringify(packet));

        var wrappedMessage = {
            Payload: textBuffer.toString("base64"),
            IsEncrypted: false,
            Headers: {},
            PostUtc: new Date().toISOString()
        }
        // PUBLISH
        try {
            //console.log("========= PUBLISHING HISTORY MESSAGE =======")
            var routingkey = serversecret.RoutingKeyBase + ".HST"
            //console.log("ROUTINGKEY:" + routingkey)
            //console.log("PACKET:")
            //console.log(JSON.stringify(packet))
            let publishSuccess = false;
            queue.publish(routingkey, JSON.stringify(wrappedMessage), { qos: 1 }, function (err, responsePacket:any) {
                if (err) { console.log("ERROR:" + err) }
                //console.log(`Queue history publish response:  [${JSON.stringify(responsePacket)}]`)

                if (responsePacket.cmd == 'publish') {
                    publishSuccess = true;
                    trexUtil.log(`[Persistence] History packet [${packet.MessageId}] publish success! Updating status.`)
                    PersistenceService.updateMessageState(packet.MessageId, PUBLISHED_STATE.PUBLISH_SUCCESS)
                    resolve();
                }
            });
            //Resolve promise after publish timeout of 10 seconds
            setTimeout(async () => {
                if (!publishSuccess) {
                    //console.log("History packet timeout! Retrying...")
                    await tryPublishHistoryPacket(packet);
                    resolve();
                }
            }, timeout)
        } catch (err) {
            //console.error(`Failed to publish packet - \n Error : [${err}] \n [${JSON.stringify(wrappedMessage)}]`);
            resolve();
        }
    })
}

export async function publishHistorySeries(): Promise<any> {
    return new Promise(async (resolve,reject) => {
        try {
            let packets = await PersistenceService.getUnpublishedMessages(50);
            for (let index = 0; index < packets.length; index++) {
                await tryPublishHistoryPacket(packets[index]);
            }
            await PersistenceService.clearPublishedMessages();
            setTimeout(()=>{
                publishHistorySeries(); // This is recursive I know, but the only interim non-blocking solution I can think of for now
            },10000)
            resolve();
        } catch (error) {
            reject(error)
        }
    })
}


const register = function (queue: MqttClient, secret: any, options: any, gateway: IGatewayConfiguration) {
    return new Promise(function (callback: any) {
        gateway.Secret = options.secretkey
        var packet = {
            "messageType": "Gateway.RegisterGatewayFromGateway.1",
            "args": { "gateway": gateway },
            "expiresAt": new Date(new Date().getTime() + 15 * 1000).toISOString()
        }

        var textBuffer = new Buffer(JSON.stringify(packet));
        var wrappedMessage = {
            Payload: textBuffer.toString("base64"),
            IsEncrypted: false,
            Headers: {},
            PostUtc: new Date().toISOString(),
            ReplyKey: "DAPI.1.DAPI.REPLY.1." + secret.ClientId.toUpperCase() + "." + trexUtil.getGUID().toUpperCase() + "." + trexUtil.getGUID().toUpperCase()
        }

        try {
            var subtopic = wrappedMessage.ReplyKey.toUpperCase(); //.split(".").join("/").toUpperCase();
            var topic = "DAPI.1.Gateway.RegisterGatewayFromGateway.1." + secret.ClientId + ".DEFAULT"
            queue.publish(topic.toUpperCase(), JSON.stringify(wrappedMessage), function (err: any) {
                if (err) { console.log("ERROR:"); console.log(err); }
            });
        } catch (err) {
            console.error("Failed to register...");
            console.error(err);
        }

        callback();
    });
}




