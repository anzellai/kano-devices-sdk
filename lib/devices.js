import { EventEmitter } from './event-emitter.js';
import Package from './package.js';
import Device from './device.js';
import WandMixin from './wand.js';
import DFUMixin from './dfu.js';

const WAND_PREFIX = 'Kano-Wand';

const WAND_ID = 'wand';

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
        
        this.deviceIDTestFunction = {};
        this.deviceIDTestFunction[WAND_ID] = this.wandTestFunction.bind(this);

        this.deviceIDClass = {};
        this.deviceIDClass[WAND_ID] = this.Wand;

        // Add here future devices
    }
    wandTestFunction(devicePrefix = null) {
        devicePrefix = devicePrefix || this.wandPrefix || WAND_PREFIX;

        return (peripheral) => {
            const device = new this.BLEDevice(peripheral, this, true);
            const deviceData = device.toJSON();
            const bluetoothInfo = deviceData.bluetooth;
            // Never set internally, the wandPrefix property can help debugging a specific device
            return bluetoothInfo.name && bluetoothInfo.name.startsWith(devicePrefix);
        };
    }
    searchForClosestDevice(deviceID, timeout) {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }

        if (!(deviceID in this.deviceIDTestFunction)) {
            return Promise.reject(new Error('Unrecognised deviceID'));
        }

        return this.watcher.searchForClosestDevice(this.deviceIDTestFunction[deviceID](), timeout)
            .then((ble) => {
                let newDeviceClass = this.deviceIDClass[deviceID];
                let newDevice = new newDeviceClass(ble, this);
                this.addDevice(newDevice);
                return Promise.resolve(newDevice);
            });
    }
    getDeviceID(deviceName) {
        if (deviceName.startsWith(WAND_PREFIX)) {
            return WAND_ID;
        }
        // Add more devices here
        return false;
    }
    searchForDevice(devicePrefix, timeout) {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }

        let deviceID = this.getDeviceID(devicePrefix);
        if (!(deviceID in this.deviceIDTestFunction)) {
            return Promise.reject(new Error('Unrecognised device.'));
        }

        return this.watcher.searchForDevice(this.deviceIDTestFunction[deviceID](devicePrefix), timeout)
            .then((ble) => {
                let newDeviceClass = this.deviceIDClass[deviceID];
                let newDevice = new newDeviceClass(ble, this);
                this.addDevice(newDevice);
                return Promise.resolve(newDevice);
            });
    }
    stopBluetoothScan() {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }
        // Stop the scan 
        return this.watcher.stopScan();
    }
    searchForDfuDevice(name) {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }
        return this.watcher.searchForDevice((peripheral) => {
            const device = new this.BLEDevice(peripheral, this, true);
            const deviceData = device.toJSON();
            return deviceData.bluetooth.name === name;
        }).then(ble => new this.DFU(ble, this));
    }
    updateDFUDevice(device, buffer) {
        if (!this.dfuSupported) {
            throw new Error('Cannot update DFU device. Missing extractor');
        }
        const dfuDevice = this.createDFUDevice(device);
        const pck = new Package(this.extractor, buffer);
        return pck.load()
            .then(() => dfuDevice.setDfuMode())
            .then(() => this.searchForDfuDevice(dfuDevice.dfuName))
            .then((dfuTarget) => {
                dfuTarget.on('progress', (transfer) => {
                    device.emit('update-progress', transfer);
                });
                return pck.getAppImage()
                    .then(image => dfuTarget.update(image.initData, image.imageData))
                    .then(() => dfuTarget.terminate());
            })
            .then(() => device.connect());

    }
    addDevice(device) {
        let alreadyAdded = false;
        this.devices.forEach(dev => {
            if (dev.device.address === device.device.address) {
                alreadyAdded = true;
            }
        })
        if (!alreadyAdded) {
            this.devices.set(device.id, device);
            this.emit('new-device', device);
        }
    }
    createDFUDevice(device) {
        return new this.DFU(device.device);
    }
    getById(id) {
        return this.devices.get(id);
    }
    getAll() {
        return Array.from(this.devices.values());
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
