import { EventEmitter } from './event-emitter.js';
import Device from './device.js';
import WandMixin from './wand.js';

class Devices extends EventEmitter {
    constructor(opts) {
        super();
        // If no bluetooth configuration is provided, dibale bluetooth devices
        if (!opts.bluetooth) {
            this.bluetoothDisabled = true;
        }
        if (!opts.bluetooth.watcher) {
            throw new Error('A bluetooth watcher must be provided');
        }
        if (!opts.bluetooth.deviceMixin) {
            throw new Error('A bluetooth device mixin must be provided');
        }
        this.devices = new Map();
        if (!this.bluetoothDisabled) {
            this.watcher = opts.bluetooth.watcher;
            this.BLEDeviceMixin = opts.bluetooth.deviceMixin;
            // Bluetooth devices
            this.BLEDevice = this.BLEDeviceMixin(Device);
            this.Wand = WandMixin(this.BLEDevice);
        }
        // Add here future devices
    }
    wandTestFunction(peripheral) {
        const device = new this.BLEDevice(peripheral);
        const deviceData = device.toJSON();
        const bluetoothInfo = deviceData.bluetooth;
        return bluetoothInfo.name && bluetoothInfo.name.startsWith('Kano-Wand');
    }
    startBluetoothScan() {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }
        // Scan for nearby wands
        return this.watcher.searchForDevice(this.wandTestFunction.bind(this))
            .then((ble) => {
                const wand = new this.Wand(ble);
                this.addDevice(wand);
            });
    }
    addDevice(device) {
        this.devices.set(device.id, device);
        this.emit('new-device', device);
    }
    getById(id) {
        return this.devices.get(id);
    }
    terminate() {
        const terminations = [];
        this.devices.forEach((value) => {
            terminations.push(value.terminate());
        });
        return Promise.all(terminations);
    }
}

export default Devices;
