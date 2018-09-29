import { IGatewayDeviceDetails } from './IGatewayDeviceDetails'

export interface IGatewayDevice {
    [deviceName: string]: IGatewayDeviceDetails
}