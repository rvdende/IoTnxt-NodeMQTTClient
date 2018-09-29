// HARDWARE SPECIFIC CODE FOR RASPBERRY PI
// Probably will error on other platforms.

var fs = require('fs');
var os = require('os');

export var version : string = "2.0.1";

/*
export function lsbRelease(cb: (err:Error|undefined, data: any) => void) {
  lsbReleaseLib(function(err, data) {

    if (err) { cb(err, undefined); }

    if (typeof data !== 'undefined' && data) { 
      var tempdata = {}
      tempdata.DISTRIBUTORID = data.distributorID; 
      tempdata.DESCRIPTION = data.description; 
      tempdata.RELEASE = data.release; 
      tempdata.CODENAME = data.codename; 
      cb(undefined, tempdata);
    }
  });
}
*/

export function getHardwareInfoAsync(cb: (err:Error|undefined, data: {}|undefined) => void) {
  var info:any = {};
  
  fs.readFile('/proc/cpuinfo', 'utf8', function(err:Error, contents:string) {

    if (err) { cb(err, undefined); }
    
    if (contents) {
      var lines = contents.toString().split('\n');
      for(var line in lines) {
        var parts=lines[line].replace(/\t/g, '').split(':');
    
        if (parts.length == 2) {
            var key=parts[0];
            var value=parts[1].trim();
            if (key === 'Serial') {
                info.SERIALNR = value;
            } else if (key === 'Hardware') {
                info.HARDWARE = value;
            } else if (key === 'Revision') {
                info.REVISION = value;
            } else if (key === 'model name') {
                info.MODEL = value;
            }
        }
      }

      
      info.PLATFORM = os.platform(); // 'darwin'
      info.RELEASE = os.release(); //'10.8.0'

      cb(undefined, info);
    }

  });

}