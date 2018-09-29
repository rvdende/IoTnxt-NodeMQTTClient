

//import * as hashFiles from 'hash-files';
import * as azure from 'azure-storage'; // docs: https://azure.github.io/azure-storage-node/FileService.html
import * as fs from 'fs';
import * as path from 'path';

var unzipper = require('unzipper'); // https://www.npmjs.com/package/unzipper
var mv = require('mv'); //https://www.npmjs.com/package/mv

import { config } from "./config"
import { trexVersion } from "./version"

setInterval(function () {
    // A background service that waits for 4 am and checks for updates randomly until 5am. 
    // pseudo code.
    var timeNow = new Date();
    var hours = timeNow.getHours();
    var minutes = timeNow.getMinutes();
    var seconds = timeNow.getSeconds();
    console.log("UPDATER: Running.")
    //console.log(hours + ":" + minutes + ":" + seconds);
    if (hours == 4) { 
        console.log("UPDATER: It is time to check for updates!");
        autoUpdate((result:any) => { });
    } else {
        console.log("UPDATER: Not in update time window. Skipping.")
    }
}, 600000)


const copyFile = function(source:string, target:string) {
    return new Promise ( function(callback:any) {

        var cbCalled = false;
  
        var rd = fs.createReadStream(source);
        rd.on("error", function(err:Error) {
          done(err);
        });
        var wr = fs.createWriteStream(target);
        wr.on("error", function(err:Error) {
          done(err);
        });
        wr.on("close", function(ex:any) {
          done(undefined);
        });
        rd.pipe(wr);
      
        function done(err:any) {
          if (!cbCalled) {
            callback(err);
            cbCalled = true;
          }
        }

    })
    
  }



const move = function(source:string, target:string) {
    return new Promise( function(callback:any) {
        mv(source, target, {mkdirp: true}, function(err:Error) {
            if (err) { console.log(err); }
            else { callback(); }
        });
    })
}

var nullPlaceholder:any = null;


const checkAvailableUpdates = function () {
    return new Promise( function (callback:any) {
        var fileService = azure.createFileService(config.azureconfig.accountName, config.azureconfig.accountKey);

        
        fileService.listFilesAndDirectoriesSegmented(config.azureconfig.share, "/" + trexVersion.branch, nullPlaceholder, nullPlaceholder, function (err: Error, result: any) {
            if (err) { console.log(err); }
            if (result) {
                var updates = [];
    
                for (var d in result.entries.directories) {
                    updates.push(parseInt(result.entries.directories[d].name));
                }
    
                updates.sort((a, b) => { return b - a })

                var latestUpdate = {
                    branch: trexVersion.branch,
                    version: updates[0],
                    config: trexVersion.config
                }

                callback(latestUpdate);
            }
        });
    })
}





const downloadUpdate = function(update:any) {
    return new Promise( function (callback:any) {

        var updatePath = "/" + update.branch + "/" + update.version;
        var downloadPath = config.mainFolder + '/temp';

        var fileService = azure.createFileService(config.azureconfig.accountName, config.azureconfig.accountKey);
        fileService.listFilesAndDirectoriesSegmented(config.azureconfig.share, updatePath, nullPlaceholder, nullPlaceholder, function (err: Error, result: any) {
            if (err) { console.log(err); }
            if (result) {
                
                var expectedFilename = "trex_"+trexVersion.config+"_"+update.branch+"_"+update.version+".zip";
                console.log("expectedFilename:"+expectedFilename)
                for (var file of result.entries.files) {
                    //console.log(file);
                    if (file.name == expectedFilename) {
                        console.log("Expected file exists. Downloading...")
                        console.log("updatePath:"+updatePath)
                            //////
                        fileService.getFileToStream(config.azureconfig.share, updatePath, file.name, fs.createWriteStream(downloadPath +"/"+ file.name), function (err, result, response) {
                            if (err) { 
                                console.log(err); 
                            }
                            if (response.isSuccessful == true) { 
                                var fileInfo = {
                                    name: result.name,
                                    path: downloadPath,
                                }
                                callback(fileInfo);
                            } else {
                                console.log("some problem.")
                            }
                        });
                        //////
                    }
                }
    
            }
        });

    })
}



const extractFile = function(file:any) {
    return new Promise(function(callback) {
        console.log("extractFile()")
        console.log(file);
        
        fs.createReadStream(file.path+"/"+file.name)
            .pipe(unzipper.Extract({ path: file.path }))
            .on("close", function () {
                //DONE UNZIP
                callback({"result":"done", path: file.path});
        })
    })
}



export async function autoUpdate(callback:any) {
    console.log("current version:"+JSON.stringify(trexVersion));
    
    var latestUpdate:any = await checkAvailableUpdates();
    console.log("latest available:"+JSON.stringify(latestUpdate))

    if (latestUpdate.version <= trexVersion.version) {
        console.log("Already at latest.")
    } else {
        console.log("Performing update."); 
        var downloadedUpdate = await downloadUpdate(latestUpdate);
        console.log("Downloaded update")
        console.log(downloadedUpdate);

        console.log("Extracting..")
        var extractedFolder = await extractFile(downloadedUpdate);

        //backup config
        console.log("copy config.js")
        var err = await copyFile(config.mainFolder+"/build/config.js", config.mainFolder+"/config.js")
        if (err == undefined) {
            console.log("copied config.js")
        } else { console.log(err);}
        
        //move build to build_backup_oldv
        var movedMain = await move(config.mainFolder+"/build", config.mainFolder+"/build_"+trexVersion.config+"_"+trexVersion.branch+"_"+trexVersion.version);
        if (movedMain == undefined) { console.log("success move old folder")} else { console.log("error move old folder")}
        
        //move extracted build to /build
        var movedUpdate = await move(config.mainFolder+"/temp/build", config.mainFolder+"/build");
        if (movedUpdate == undefined) { console.log("success move new folder")} else { console.log("error move new folder")}

        //trigger service restart

    }

    //callback(latestUpdate);
}








