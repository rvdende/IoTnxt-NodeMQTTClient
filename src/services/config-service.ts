import { IGatewayConfiguration } from './../abstractions/IGatewayConfiguration';
import { config } from './../config';


export class ConfigService {

    /**
     * Allows encapsulation of config method
     */
    public static async getGatewayConfig() {
        return new Promise((resolve) => {
            resolve(config)
        })
    }
}