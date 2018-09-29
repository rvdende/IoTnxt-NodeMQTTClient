# IoTnxt-NodeMQTTClient
A Nodejs  MQTT client to connect any device to the IoT.nxt SaaS platform. This example was with Raspberry pi units Zero to 3B+

Talon 
=====

Talon is a nodejs/typescript implementation of an IoTnxt edge gateway device. 
This is meant to run automatically at startup, poll sensors for temperature, movement, etc.. then send the data up to the iotnxt cloud.

Instructions:
------------

Associate a new gateway on Portal. 
Enter the same GatewayId in /src/config.ts

```
npm install
npm run buildwatch
```

In another terminal:

```
cd build
node main.js
```

Features:
---------

- sqlite persistance layer
- bandwidth optimized publish algorithm that diff's data before sending

Planned:
--------

- Locally hosted web interface

Tips:
------

Use [forever-service](https://github.com/zapty/forever-service) to make Talon run on bootup.

