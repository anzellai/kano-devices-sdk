'use strict';

var events = require('events');

let counter = 0;

class Device extends events.EventEmitter {
    constructor() {
        super();
        this.id = counter.toString();
        this.type = 'device';
        counter += 1;
    }
    terminate() {
        return Promise.resolve(this.id);
    }
}

// Mixin extending a BLEDevice
const WandMixin = (BLEDevice) => {
    const INFO_SERVICE = BLEDevice.localUuid('64A70010-F691-4B93-A6F4-0968F5B648F8');
    const ORGANISATION_CHARACTERISTIC = BLEDevice.localUuid('64A7000B-F691-4B93-A6F4-0968F5B648F8');
    const SOFTWARE_VERSION_CHARACTERISTIC = BLEDevice.localUuid('64A70013-F691-4B93-A6F4-0968F5B648F8');
    const HARDWARE_BUILD_CHARACTERISTIC = BLEDevice.localUuid('64A70001-F691-4B93-A6F4-0968F5B648F8');

    const IO_SERVICE = BLEDevice.localUuid('64A70012-F691-4B93-A6F4-0968F5B648F8');
    const BATTERY_STATUS_CHARACTERISTIC = BLEDevice.localUuid('64A70007-F691-4B93-A6F4-0968F5B648F8');
    const BUTTON_CHARACTERISTIC = BLEDevice.localUuid('64A7000D-F691-4B93-A6F4-0968F5B648F8');
    const VIBRATOR_CHARACTERISTIC = BLEDevice.localUuid('64A70008-F691-4B93-A6F4-0968F5B648F8');
    const LED_CHARACTERISTIC = BLEDevice.localUuid('64A70009-F691-4B93-A6F4-0968F5B648F8');
    const WAND_NUMBER_CHARACTERISTIC = BLEDevice.localUuid('64A7000A-F691-4B93-A6F4-0968F5B648F8');
    const RESET_PAIRING_CHARACTERISTIC = BLEDevice.localUuid('64A7000C-F691-4B93-A6F4-0968F5B648F8');
    const SLEEP_CHARACTERISTIC = BLEDevice.localUuid('64A7000E-F691-4B93-A6F4-0968F5B648F8');
    const KEEP_ALIVE_CHARACTERISTIC = BLEDevice.localUuid('64A7000F-F691-4B93-A6F4-0968F5B648F8');

    const EULER_POSITION_SERVICE = BLEDevice.localUuid('64A70011-F691-4B93-A6F4-0968F5B648F8');
    const EULER_POSITION_CHARACTERISTIC = BLEDevice.localUuid('64A70002-F691-4B93-A6F4-0968F5B648F8');
    const CALIBRATE_GYROSCOPE_CHARACTERISTIC = BLEDevice.localUuid('64A70020-F691-4B93-A6F4-0968F5B648F8');
    const CALIBRATE_MAGNOMETER_CHARACTERISTIC = BLEDevice.localUuid('64A70021-F691-4B93-A6F4-0968F5B648F8');

    /**
     * Emits: position, battery-status, user-button, sleep
     */
    class Wand extends BLEDevice {
        constructor(...args) {
            super(...args);
            this.type = 'wand';
            this._eulerSubscribed = false;
        }
        static uInt8ToUInt16(byteA, byteB) {
            const number = (((byteB & 0xff) << 8) | byteA);
            const sign = byteB & (1 << 7);

            if (sign) {
                return 0xFFFF0000 | number;
            }

            return number;
        }
        // --- INFORMATION ---
        getOrganisation() {
            return this.read(INFO_SERVICE, ORGANISATION_CHARACTERISTIC)
                .then(data => data.toString());
        }
        getSoftwareVersion() {
            return this.read(INFO_SERVICE, SOFTWARE_VERSION_CHARACTERISTIC)
                .then(data => data.toString());
        }
        getHardwareBuild() {
            return this.read(INFO_SERVICE, HARDWARE_BUILD_CHARACTERISTIC)
                .then(data => data.toString());
        }
        // --- IO ---
        getbatteryStatus() {
            return this.read(INFO_SERVICE, BATTERY_STATUS_CHARACTERISTIC)
                .then(data => data.toString());
        }
        subscribeBatteryStatus() {
            return this.subscribe(
                IO_SERVICE,
                BATTERY_STATUS_CHARACTERISTIC,
                (data) => {
                    this.emit('battery-status', data[0]);
                },
            );
        }
        getVibratorStatus() {
            return this.read(INFO_SERVICE, VIBRATOR_CHARACTERISTIC)
                .then(data => data[0]);
        }
        vibrate(pattern) {
            return this.write(
                IO_SERVICE,
                VIBRATOR_CHARACTERISTIC,
                pattern,
            );
        }
        getLedStatus() {
            return this.read(INFO_SERVICE, LED_CHARACTERISTIC)
                .then(data => data[0]);
        }
        setLed(state) {
            return this.write(
                IO_SERVICE,
                LED_CHARACTERISTIC,
                state,
            );
        }
        getNumber() {
            return this.read(INFO_SERVICE, WAND_NUMBER_CHARACTERISTIC)
                .then(data => data[0]);
        }
        setNumber(n) {
            return this.write(
                IO_SERVICE,
                WAND_NUMBER_CHARACTERISTIC,
                n,
            );
        }
        resetPairing() {
            return this.write(
                IO_SERVICE,
                RESET_PAIRING_CHARACTERISTIC,
                1,
            );
        }
        subscribeButton() {
            return this.subscribe(
                IO_SERVICE,
                BUTTON_CHARACTERISTIC,
                (data) => {
                    this.emit('user-button', data[0]);
                },
            );
        }
        getButtonStatus() {
            return this.read(INFO_SERVICE, BUTTON_CHARACTERISTIC)
                .then(data => data[0]);
        }
        subscribeSleep() {
            return this.subscribe(
                IO_SERVICE,
                SLEEP_CHARACTERISTIC,
                (data) => {
                    this.emit('sleep', data[0]);
                },
            );
        }
        getSleepStatus() {
            return this.read(INFO_SERVICE, SLEEP_CHARACTERISTIC)
                .then(data => data[0]);
        }
        keepAlive() {
            return this.write(
                IO_SERVICE,
                KEEP_ALIVE_CHARACTERISTIC,
                1,
            );
        }
        // --- Position ---
        subscribeEuler() {
            if (this._eulerSubscribed) {
                return Promise.resolve();
            }
            // Synchronous state change. Multiple calls to subscribe will stop after the first
            this._eulerSubscribed = true;
            return this.subscribe(
                EULER_POSITION_SERVICE,
                EULER_POSITION_CHARACTERISTIC,
                (r) => {
                    const roll = Wand.uInt8ToUInt16(r[0], r[1]);
                    const pitch = Wand.uInt8ToUInt16(r[2], r[3]);
                    const yaw = Wand.uInt8ToUInt16(r[4], r[5]);
                    this.emit('position', [roll, pitch, yaw]);
                },
            ).catch((e) => {
                // Revert state if failed to subscribe
                this._eulerSubscribed = false;
                throw e;
            });
        }
        unsubscribeEuler() {
            if (!this._eulerSubscribed) {
                return Promise.resolve();
            }
            return this.unsubscribe(
                EULER_POSITION_SERVICE,
                EULER_POSITION_CHARACTERISTIC,
            ).then(() => {
                // Stay subscribed until unsubscribe suceeds
                this._eulerSubscribed = false;
            });
        }
        calibrateGyroscope() {
            return this.calibrateChar(EULER_POSITION_SERVICE, CALIBRATE_GYROSCOPE_CHARACTERISTIC);
        }
        calibrateMagnetometer() {
            return this.calibrateChar(EULER_POSITION_SERVICE, CALIBRATE_MAGNOMETER_CHARACTERISTIC);
        }
        calibrateChar(sId, cId) {
            const message = 1;
            const wasSubscribed = this._eulerSubscribed;

            return this.unsubscribeEuler()
                .then(() => {
                    // Promise that will resolve once the calibration is done
                    return new Promise((resolve, reject) => {
                        this.subscribe(
                            sId,
                            cId,
                            (data) => {
                                // Once the status means calibrated, resolve the promise
                                const status = data[0];
                                if (status === 2) {
                                    resolve();
                                } else if (status === 3) {
                                    reject(new Error('Calibration failed'));
                                }
                            },
                        ).then(() => this.write(sId, cId, message));
                    });
                })
                .then(() => {
                    if (wasSubscribed) {
                        return this.subscribeEuler();
                    }
                    return null;
                });
        }
    }

    return Wand;
};

class Devices extends events.EventEmitter {
    constructor(opts) {
        super();
        // If no bluetooth configuration is provided, disable bluetooth devices
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

module.exports = Devices;
