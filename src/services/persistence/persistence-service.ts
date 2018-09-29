import { QueuePacket } from './../../utils/iotnxt.queueClient.v3';
import * as sqlite3 from 'sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as trexUtil from './../../utils/trex.utils';

var dbPath = path.join(__dirname, "trexdb.db")
var db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
const tableName = 'trexdata'

export enum PUBLISHED_STATE {
    PUBLISH_NOT_TRIED = 0,
    PUBLISH_FAILED,
    PUBLISH_SUCCESS
}

export enum SQLITE_ERRORS {
    DB_CORRUPT = "SQLITE_CORRUPT"
}

export class PersistenceService {

    public static checkTableExists(): Promise<void> {
        return new Promise((resolve, reject) => {
            db.run(`SELECT rowid AS id, data FROM ${tableName}`, function (result: sqlite3.RunResult | any, err: Error) {
                if (err || result)
                    reject(err || result)
                trexUtil.log("[Persistence] DB found")
                resolve();
                // console.log(row.id + ": " + row.data);
                // let newData = JSON.parse(row.data);
            });
        })
    }

    public static createTable(): Promise<void> {
        return new Promise((resolve) => {

            db.run(`CREATE TABLE ${tableName} (guid TEXT, data BLOB, messageDateEpoc INT, publishState INT)`, (result: sqlite3.RunResult | any, err: Error) => {
                if (result && result.code == SQLITE_ERRORS.DB_CORRUPT) {
                    this.handleCorruptDb();
                }
                err ? console.error(err) : trexUtil.log("[Persistence] DB Create success");
                resolve();
            })
        })
    }

    public static insert(message: QueuePacket): Promise<string> {

        return new Promise((resolve) => {
            let dateTimeSec = new Date().getTime();
            db.run(`INSERT INTO ${tableName} (guid, data, messageDateEpoc, publishState) VALUES (?,?,?,?)`,
                [message.MessageId, JSON.stringify(message), dateTimeSec, PUBLISHED_STATE.PUBLISH_NOT_TRIED],
                (result: sqlite3.RunResult | any, err: Error) => {
                    if (result && result.code == SQLITE_ERRORS.DB_CORRUPT) {
                        this.handleCorruptDb();
                    }
                    if (err) console.error(err)
                    if (result) { trexUtil.log(`[Persistence] Insert`); console.log(result); }
                    //err ? console.error(err) : trexUtil.log(`[Persistence] Message : ${result || "Insert success!"}`);
                    resolve(message.MessageId);
                })
        })
    }

    public static deleteMessage(guid: string): Promise<void> {
        return new Promise((resolve) => {
            db.run(`DELETE FROM ${tableName} WHERE guid = '${guid}'`, (result: sqlite3.RunResult | any, err: Error) => {
                if (result && result.code == SQLITE_ERRORS.DB_CORRUPT) {
                    this.handleCorruptDb();
                }
                err ? console.error(err) : trexUtil.log(`[Persistence] Message : ${result || "Delete success!"}`);
                resolve();
            })
        })
    }

    public static getMessages(): Promise<QueuePacket[]> {
        return new Promise((resolve) => {
            let messages: QueuePacket[] = [];
            db.each(`SELECT guid, data FROM ${tableName}`, function (err: Error | undefined, row: any) {
                messages.push(JSON.parse(row.data))
            }, (err : Error) => {
                resolve(messages);
            });
        })
    }

    public static getUnpublishedMessages(packageCount: number): Promise<QueuePacket[]> {
        return new Promise((resolve, reject) => {
            try {
                let messages: QueuePacket[] = [];
                db.each(`SELECT guid, data FROM ${tableName} WHERE publishState = ${PUBLISHED_STATE.PUBLISH_NOT_TRIED} ORDER BY messageDateEpoc LIMIT ${packageCount} `, function (err: Error | undefined, row : any) {
                    if (row) {
                        messages.push(JSON.parse(row.data))
                    }
                }, (err : Error) => {
                    resolve(messages);
                });
            } catch (error) {
                reject(error)
            }
        })
    }

    public static updateMessageState(messageGuid: string, publishState: PUBLISHED_STATE): Promise<boolean> {
        return new Promise((resolve) => {
            db.run(`UPDATE ${tableName} SET publishState = ${publishState} WHERE guid = '${messageGuid}'`, (result: sqlite3.RunResult | any, err: Error) => {
                if (result && result.code == SQLITE_ERRORS.DB_CORRUPT) {
                    this.handleCorruptDb();
                }
                if (err) console.error(err)
                if (result) { trexUtil.log(`[Persistence] Update`); console.log(result); }
                //err ? console.error(err) : trexUtil.log(`[Persistence] Message : ${result || "Update message state success!"}`);
                resolve(true);
            })
        })
    }

    public static clearPublishedMessages(): Promise<void> {
        return new Promise(async (resolve) => {
            db.run(`DELETE FROM ${tableName} WHERE publishState = '${PUBLISHED_STATE.PUBLISH_SUCCESS}'`, async (result: sqlite3.RunResult | any, err: Error) => {
                if (result && result.code == SQLITE_ERRORS.DB_CORRUPT) {
                    await this.handleCorruptDb();
                    resolve();
                }

                if (err) console.error(err)
                if (result) { trexUtil.log(`[Persistence] Clear data message`); console.log(result); }

                //err ? console.error(err) : trexUtil.log(`[Persistence] Clear data message : ${result || "Clearing published packets success!"}`);
                resolve();
            })
        })
    }

    public static closeDb() {
        return new Promise((resolve, reject) => {
            console.log("Closing db");
            db.close((err:Error|null) => {
                if (err) reject(err);
                resolve();
            });
        })
    }

    //Attempt to recover from corrupt db file
    public static async handleCorruptDb() {
        return new Promise(async (resolve) => {
            console.log("Repairing malformed db file")
            try {
                await this.closeDb();
                let corruptFileName = `trexdb_${new Date().getTime()}.db`;
                let newPath = path.join(__dirname, corruptFileName);
                fs.renameSync(dbPath, newPath);
                // let fileRead = fs.readFileSync(newPath);
                // fs.writeFileSync(path.join(__dirname, "corrupt", corruptFileName), fileRead);
                // await fs.unlinkSync(newPath);
                db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
                console.log("DB file re-created");
                await this.createTable();
                resolve(); // Don't make promises you can't keep!
            } catch (error) {
                console.error(error);
            }
        })
    }

}


