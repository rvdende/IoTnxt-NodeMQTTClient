import { IGatewayDevice } from './IGatewayDevice'
import { IGatewayDeviceDetails } from './IGatewayDeviceDetails'

export interface IGatewayConfiguration {
    GatewayId: string,
    Make: string,
    Model: string,
    FirmwareVersion: string,
    Location: string,
    Secret: string,
    Devices: {
        [deviceName: string]: IGatewayDeviceDetails
    },
    GatewayFirstContact: boolean,
    IsIoTHubDevice: boolean,
    Config: any,
    ClientId: string
}

