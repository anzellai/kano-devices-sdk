import { EventEmitter } from './event-emitter.js';
import Package from './package.js';
import Device from './device.js';
import WandMixin from './wand.js';
import DFUMixin from './dfu.js';

import { Logger } from './logger.js';

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

        this.setLogger(new Logger());
        // Add here future devices
    }
    setLogger(logger) {
        this.log = logger;
        this.watcher.setLogger(logger);
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

        this.log.info(`Starting searchForClosestDevice with type ${deviceID}. Will stop after ${timeout}ms...`);

        return this.watcher.searchForClosestDevice(this.deviceIDTestFunction[deviceID](), timeout)
            .then((ble) => {
                const newDeviceClass = this.deviceIDClass[deviceID];
                const newDevice = new newDeviceClass(ble, this);
                this.addDevice(newDevice);
                return Promise.resolve(newDevice);
            });
    }
    getDeviceID(deviceName) {
        if (deviceName && deviceName.startsWith(WAND_PREFIX)) {
            return WAND_ID;
        }
        // Add more devices here
        return false;
    }
    searchForDevice(devicePrefix, timeout) {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }

        const deviceID = this.getDeviceID(devicePrefix);
        if (!(deviceID in this.deviceIDTestFunction)) {
            return Promise.reject(new Error('Unrecognised device.'));
        }

        this.log.info(`Starting searchForClosestDevice with prefix ${devicePrefix}. Will stop after ${timeout}ms...`);

        return this.watcher.searchForDevice(this.deviceIDTestFunction[deviceID](devicePrefix), timeout)
            .then((ble) => {
                const newDeviceClass = this.deviceIDClass[deviceID];
                const newDevice = new newDeviceClass(ble, this);
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
        this.log.trace('Loading update package...');
        return pck.load()
            .then(() => {
                this.log.trace('Update package loaded');
                this.log.trace('Enabling DFU mode...');
                // Flag as manually disconnected to prevent auto reconnect
                device._manuallyDisconnected = true;
                dfuDevice._manuallyDisconnected = true;
                return dfuDevice.setDfuMode();
            })
            .then(() => {
                this.log.trace('DFU mode enabled');
                return dfuDevice.dispose()
                    .catch((e) => {
                        this.log.error('Unable to close the dfuDevice...', e);
                    });
            })
            .then(() => {
                this.log.trace('Searching for DFU device...');
                return this.searchForDfuDevice(dfuDevice.dfuName);
            })
            .then((dfuTarget) => {
                this.log.trace('DFU found');
                this.log.trace('Starting update');
                dfuTarget.on('progress', (transfer) => {
                    device.emit('update-progress', transfer);
                });
                return pck.getAppImage()
                    .then(image => dfuTarget.update(image.initData, image.imageData))
                    .then(() => {
                        this.log.trace('Update finished, disconnecting...');
                    })
                    .then(() => dfuTarget.dispose());
            })
            .then(() => {
                this.log.trace('Reconnecting to device');
                return device.reconnect();
            });
    }
    addDevice(device) {
        this.log.info(`Adding/Updating device ${device.id}`);
        this.devices.set(device.id, device);
        this.emit('new-device', device);
    }
    createDFUDevice(device) {
        return new this.DFU(device.device, this);
    }
    getById(id) {
        return this.devices.get(id);
    }
    getAll() {
        return Array.from(this.devices.values());
    }
    removeDevice(device) {
        // Returns true if the devices was removed or false if
        // the device id was not found in the devices array.
        return Promise.resolve(this.devices.delete(device.id));
    }
    terminate() {
        this.setLogger(new Logger());
        const terminations = [];
        this.devices.forEach((value) => {
            terminations.push(value.terminate());
        });
        return Promise.all(terminations);
    }
}

export default Devices;
