import * as iotnxt from "./iotnxt/iotnxt";

var deviceTree = {};
deviceTree["asdf|1:zxcv|1"] = {
  Make: null,
  Model: null,
  DeviceName: "asdf|1:zxcv|1",
  DeviceType: "asdf",
  Properties: {
    hello: {
      PropertyName: "hello",
      DataType: null
    }
  }
};

var iotnxtqueue = new iotnxt.IotnxtQueue(
  {
    GatewayId: "ROUANTEST",
    secretkey: "asdf1234zxcv",
    FirmwareVersion: "5.0.25",
    Make: "IoT.nxt",
    Model: "nodejs client",
    id: "rouan test",
    publickey: "<RSAKeyValue><Exponent>AQAB</Exponent><Modulus>rbltknM3wO5/TAEigft0RDlI6R9yPttweDXtmXjmpxwcuVtqJgNbIQ3VduGVlG6sOg20iEbBWMCdwJ3HZTrtn7qpXRdJBqDUNye4Xbwp1Dp+zMFpgEsCklM7c6/iIq14nymhNo9Cn3eBBM3yZzUKJuPn9CTZSOtCenSbae9X9bnHSW2qB1qRSQ2M03VppBYAyMjZvP1wSDVNuvCtjU2Lg/8o/t231E/U+s1Jk0IvdD6rLdoi91c3Bmp00rVMPxOjvKmOjgPfE5LESRPMlUli4kJFWxBwbXuhFY+TK2I+BUpiYYKX+4YL3OFrn/EpO4bNcI0NHelbWGqZg57x7rNe9Q==</Modulus></RSAKeyValue>",
    hostaddress: "greenqueue.prod.iotnxt.io"
  },
  deviceTree,
  true
);



iotnxtqueue.on("connect", ()=>{
  console.log("CONNECTED...")

  setInterval(()=>{
    console.log("sending data...")
    iotnxtqueue.updateState("asdf|1:zxcv|1", "hello", Math.random())
    iotnxtqueue.publishState();
  },2500)

})