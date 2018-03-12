# kano-devices-sdk

Allows the detection and comunication with Kanon devices.

## Class Diagram

![](./Kano-Device-SDK-classes.png)

## Platform independance

This SDK aims to be platform independant as it doesn't implement any Bluetooth, Wi-FI or serial communication.
Instead it provides classes expecting a mixin for a BLEDevice/SerialDevice/WiFIDevice to be provided.

## Example


```js
import Devices from '../kano-devices/sdk/kano-devices-sdk.js';
// Pltform specific bluetooth watcher and device mixin
import Watcher from './ble-watcher.js';
import BLEDeviceMixin from './ble-device.js';

const DevicesManager = new Devices({
    bluetooth: {
        watcher: new Watcher(),
        deviceMixin: BLEDeviceMixin,
    },
});

export default DevicesManager;

```

Example of a mixin for the BLEDevice:

```js
// Return a function that will receive the Device class. It needs to extends it, implement the bluetooth methods and return the BLEDevice class
const BLEDeviceMixin = (Device) => {
    class BLEDevice extends Device {
        // Will receive the device object the watcher found
        constructor(device) {
            super();
            this.type = 'ble-device';
            // Do something with the device object
        }
        // Implement here the methods
    }
    return BLEDevice;
};

export default BLEDeviceMixin;

```