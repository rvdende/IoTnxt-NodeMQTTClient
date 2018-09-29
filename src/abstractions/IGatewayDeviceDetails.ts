export interface IGatewayDeviceDetails {
    Make: string | null,
    Model: string | null,
    DeviceName: string,
    DeviceType: string,
    Properties: {
        [propertyName: string]: IDeviceProperty
    }
}

export interface IDeviceProperty {
    PropertyName: string | null,
    DataType: string | null
}