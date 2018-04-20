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
        const device = new this.BLEDevice(peripheral, this, true);
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
                const wand = new this.Wand(ble, this);
                this.addDevice(wand);
            });
    }
    getClosestWand(timeout) {
        if (this.bluetoothDisabled) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            this.watcher.startScan()
                .then(() => {
                    setTimeout(() => {
                        let closestDevice = undefined;
                        this.watcher.getDevices(this.wandTestFunction.bind(this))
                            .forEach(device => {
                                let wand = new this.Wand(device, this);
                                this.addDevice(wand);
                                closestDevice = closestDevice || wand;
                                console.log('Comparing', closestDevice.device.rssi, wand.device.rssi);
                                if (closestDevice.device.rssi < wand.device.rssi) {
                                    closestDevice = wand;
                                }
                            });
                        if (!closestDevice) {
                            return reject();
                        }
                        return resolve(closestDevice);
                    }, timeout);
                })
                .catch(e => console.log("Unable to start the scan", e));
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
            .then(() => {
                dfuDevice._manuallyDisconnected = true;
                device._manuallyDisconnected = true;

                return dfuDevice.setDfuMode();
            })
            .then(() => {
                return this.searchForDfuDevice('DfuTarg')
            })
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
