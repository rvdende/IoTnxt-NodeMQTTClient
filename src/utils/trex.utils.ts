// General crossplatform utilities for TRex.

import * as os from 'os';
import * as dns from 'dns';
import * as _ from 'lodash';

var getmaclib = require('getmac');


// Tests to see if we are online.
export function online(): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        //dns.resolve did not report 'disconnects in a timely manner. Lookup seems to be more efficient
        dns.lookup('google.com', function (err: any) {
            var data: any = {}
            if (err && err.code == "ENOTFOUND") {
                data.INTERNET = false;
                data.STATUS = "OFFLINE";
                reject(data);
            } else {
                data.INTERNET = true;
                data.STATUS = "ONLINE";
                resolve(data)
            }
        });
    })

}

// Finds our ipaddresses
export function ipaddress(cb: any) {
    var interfaces = os.networkInterfaces();
    var found = 0;
    //scans for IPv4 interfaces and filters out localhost.
    for (var key in interfaces) {
        if (interfaces.hasOwnProperty(key)) {
            //console.log(key + " -> " + interfaces[key]);
            for (var x in interfaces[key]) {
                if (interfaces[key][x].family == "IPv4") {
                    //console.log(interfaces[key][x].address)
                    if (interfaces[key][x].address != "127.0.0.1") {
                        found = 1;
                        cb(undefined, interfaces[key][x].address )
                    }
                }
            }
        }
    }

    /*
    if (interfaces.ppp0) {
        found = 1;
        cb(undefined, interfaces.ppp0[0]);
    }

    if (interfaces.wlan0) {
        found = 1;
        cb(undefined, interfaces.wlan0[0]);
    }
    */

    if (found == 0) {
        cb("notfound", undefined);
    }
}



//gets our public ip address
export function getExternIp(cb:any) {
    //console.log("Getting publicIP..")
    var http = require('http');
    var ip = ""
    http.get('http://bot.whatismyipaddress.com', function(res:any){
        res.setEncoding('utf8');

        res.on('data', function(chunk:string){
            ip += chunk;
        });

        res.on('end', function () {
            var sendip = ip;
            cb(undefined, sendip);
        })
    }).on('error', function (err:Error) {
        cb(err, undefined);
    });
}


export function capitalizeFirstLetter(instring: string) {
    instring = instring.toLowerCase();
    return instring.charAt(0).toUpperCase() + instring.slice(1);
}

/* ------------------------------------------------------------------------- */

export function getGUID() {
    var d = new Date().getTime();
    var uuid: string = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
};

/* ------------------------------------------------------------------------- */

export function getMac(cb:any) {
    getmaclib.getMac(function(err:Error, macAddress:any){
        if (err) { cb(err, undefined); }
        if (macAddress) { cb(undefined, macAddress); }
    })
}

/* ------------------------------------------------------------------------- */

export function log(a:any) {
    var now = new Date();
    console.log(now.toISOString() + " \t" + a )
}

/**
 * Deep diff between two object, using lodash
 * @param  {Object} object Object compared
 * @param  {Object} base   Object to compare with
 * @return {Object}        Return a new object who represent the diff
 */
export function difference(object:any, base:any) {

	function changes(object:any, base:any) {
		return _.transform(object, function(result:any, value:any, key:any) {
			if (!_.isEqual(value, base[key])) {
				result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value;
			}
		});
    }
    
	return changes(object, base);
}
