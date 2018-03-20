import { EventEmitter } from './event-emitter.js';
import Package from './package.js';
import Device from './device.js';
import WandMixin from './wand.js';
import DFUMixin from './dfu.js';

const WAND_PREFIX = 'Kano-Wand';

class Devices extends EventEmitter {
    constructor(opts) {
        super();
        // If no bluetooth configuration is provided, disable bluetooth devices
        if (!opts.bluetooth) {
            this.bluetoothDisabled = true;
        } else {
            if (!opts.bluetooth.watcher) {
                throw new Error('A bluetooth watcher must be provided');
            }
            if (!opts.bluetooth.deviceMixin) {
                throw new Error('A bluetooth device mixin must be provided');
            }
            this.dfuSupported = Boolean(opts.bluetooth.extractor);
            this.extractor = opts.bluetooth.extractor;
        }
        this.devices = new Map();
        if (!this.bluetoothDisabled) {
            this.watcher = opts.bluetooth.watcher;
            this.BLEDeviceMixin = opts.bluetooth.deviceMixin;
            // Bluetooth devices
            this.BLEDevice = this.BLEDeviceMixin(Device);
            this.Wand = WandMixin(this.BLEDevice);
            this.DFU = DFUMixin(this.BLEDevice);
        }
        // Add here future devices
    }
    wandTestFunction(peripheral) {
        const device = new this.BLEDevice(peripheral, true);
        const deviceData = device.toJSON();
        const bluetoothInfo = deviceData.bluetooth;
        // Never set internally, the wandPrefix property can help debugging a specific device
        return bluetoothInfo.name && bluetoothInfo.name.startsWith(this.wandPrefix || WAND_PREFIX);
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
    searchForDfuDevice(name) {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }
        return this.watcher.searchForDevice((peripheral) => {
            const device = new this.BLEDevice(peripheral);
            const deviceData = device.toJSON();
            return deviceData.bluetooth.name === name;
        }).then(ble => new this.DFU(ble));
    }
    updateDFUDevice(device, buffer) {
        if (!this.dfuSupported) {
            throw new Error('Cannot update DFU device. Missing extractor');
        }
        const dfuDevice = this.createDFUDevice(device);
        const deviceInfo = dfuDevice.toJSON();
        const { dfuName } = deviceInfo.bluetooth;
        const pck = new Package(this.extractor, buffer);
        return pck.load()
            .then(() => dfuDevice.setDfuMode())
            .then(() => this.searchForDfuDevice(dfuName))
            .then((dfuTarget) => {
                dfuTarget.on('progress', (transfer) => {
                    device.emit('update-progress', transfer);
                });
                return pck.getAppImage()
                    .then(image => dfuTarget.update(image.initData, image.imageData));
            })
            .then(() => device.connect());
    }
    addDevice(device) {
        this.devices.set(device.id, device);
        this.emit('new-device', device);
    }
    createDFUDevice(device) {
        return new this.DFU(device.device);
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
