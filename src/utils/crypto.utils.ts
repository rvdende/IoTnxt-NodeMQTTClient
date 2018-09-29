
import crypto = require("crypto");

declare module "crypto" { export const constants: { RSA_PKCS1_PADDING: number } }      // bug fix PR: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/25287


export interface RSAcredentials {
    modulus: string,
    exponent: string
}

export function RSAENCRYPT(text: string, credentials: RSAcredentials) {
    // https://stackoverflow.com/questions/27568570/how-to-convert-raw-modulus-exponent-to-rsa-public-key-pem-format

    var publicKey = RSAgenPEM(credentials.modulus, credentials.exponent);
    var buffer = new Buffer(text);

    var rsakey = {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING  //An optional padding value defined in crypto.constants, which may be: crypto.constants.RSA_NO_PADDING, RSA_PKCS1_PADDING, or crypto.constants.RSA_PKCS1_OAEP_PADDING.
    }

    var encrypted = crypto.publicEncrypt(rsakey, buffer);
    return encrypted.toString("base64");
}

export function RSAgenPEM(modulus: string, exponent: string) {
    // by Rouan van der Ende
    // converts a raw modulus/exponent public key to a PEM format.

    var header = Buffer.from("MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA", 'base64'); //Standard header
    var mod = Buffer.from(modulus, 'base64');
    var midHeader = Buffer.from([0x02, 0x03]);
    var exp = Buffer.from(exponent, 'base64');

    //combine
    var key = Buffer.concat([header, mod, midHeader, exp])
    var keybase64 = key.toString("base64");

    var PEM = "-----BEGIN PUBLIC KEY-----\r\n"

    for (var a = 0; a <= Math.floor(keybase64.length / 64); a++) {
        PEM += keybase64.slice(0 + (64 * a), 64 + (64 * a)) + "\r\n";
    }

    PEM += "-----END PUBLIC KEY-----\r\n"

    return PEM;
}

export const genAESkeys = function () {
    return new Promise(function (callback: any) {
        crypto.pseudoRandomBytes(32, function (err, keyBuffer) {
            crypto.pseudoRandomBytes(16, function (err, ivBuffer) {
                callback({ key: keyBuffer, iv: ivBuffer });
            });
        });
    })
}

export function createCipheriv(AES: any, algorithm: string = "aes-256-cbc"): crypto.Cipher {
    return crypto.createCipheriv(algorithm, AES.key, AES.iv);
}

export function createDecipheriv(AES: any, algorithm: string = "aes-256-cbc"): crypto.Decipher {
    return crypto.createDecipheriv(algorithm, AES.key, AES.iv);
}



