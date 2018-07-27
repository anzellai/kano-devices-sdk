

// Mixin extending a BLEDevice
const WandMixin = (BLEDevice) => {
    const BLE_UUID_INFORMATION_SERVICE              = BLEDevice.localUuid('64A70010-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_INFORMATION_ORGANISATION_CHAR    = BLEDevice.localUuid('64A7000B-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_INFORMATION_SW_CHAR              = BLEDevice.localUuid('64A70013-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_INFORMATION_HW_CHAR              = BLEDevice.localUuid('64A70001-F691-4B93-A6F4-0968F5B648F8');

    const BLE_UUID_IO_SERVICE                       = BLEDevice.localUuid('64A70012-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_IO_BATTERY_CHAR                  = BLEDevice.localUuid('64A70007-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_IO_USER_BUTTON_CHAR              = BLEDevice.localUuid('64A7000D-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_IO_VIBRATOR_CHAR                 = BLEDevice.localUuid('64A70008-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_IO_LED_CHAR                      = BLEDevice.localUuid('64A70009-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_IO_KEEP_ALIVE_CHAR               = BLEDevice.localUuid('64A7000F-F691-4B93-A6F4-0968F5B648F8');

    const BLE_UUID_SENSOR_SERVICE                   = BLEDevice.localUuid('64A70011-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_SENSOR_QUATERNIONS_CHAR          = BLEDevice.localUuid('64A70002-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_SENSOR_RAW_CHAR                  = BLEDevice.localUuid('64A7000A-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_SENSOR_MOTION_CHAR               = BLEDevice.localUuid('64A7000C-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_SENSOR_MAGN_CALIBRATE_CHAR       = BLEDevice.localUuid('64A70021-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_SENSOR_QUATERNIONS_RESET_CHAR    = BLEDevice.localUuid('64A70004-F691-4B93-A6F4-0968F5B648F8');
    const BLE_UUID_SENSOR_TEMP_CHAR                 = BLEDevice.localUuid('64A70014-F691-4B93-A6F4-0968F5B648F8');


    /**
     * Emits: position, temperature, battery-status, user-button, sleep
     */
    class Wand extends BLEDevice {
        constructor(...args) {
            super(...args);
            this.type = 'wand';
            this._eulerSubscribed = false;
            this._temperatureSubscribed = false;
            this._buttonSubscribed = false;
            this.onUserButton = this.onUserButton.bind(this);
            this.onPosition = this.onPosition.bind(this);
            this.onBatteryStatus = this.onBatteryStatus.bind(this);
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
            return this.read(BLE_UUID_INFORMATION_SERVICE, BLE_UUID_INFORMATION_ORGANISATION_CHAR)
                .then(data => BLEDevice.uInt8ArrayToString(data));
        }
        getSoftwareVersion() {
            return this.read(BLE_UUID_INFORMATION_SERVICE, BLE_UUID_INFORMATION_SW_CHAR)
                .then(data => BLEDevice.uInt8ArrayToString(data));
        }
        getHardwareBuild() {
            return this.read(BLE_UUID_INFORMATION_SERVICE, BLE_UUID_INFORMATION_HW_CHAR)
                .then(data => data[0]);
        }
        // --- IO ---
        getBatteryStatus() {
            return this.read(BLE_UUID_IO_SERVICE, BLE_UUID_IO_BATTERY_CHAR)
                .then(data => data[0]);
        }
        subscribeBatteryStatus() {
            return this.subscribe(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_BATTERY_CHAR,
                this.onBatteryStatus,
            );
        }
        unsubscribeBatteryStatus() {
            return this.unsubscribe(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_BATTERY_CHAR,
                this.onBatteryStatus,
            );
        }
        getVibratorStatus() {
            return this.read(BLE_UUID_IO_SERVICE, BLE_UUID_IO_VIBRATOR_CHAR)
                .then(data => data[0]);
        }
        vibrate(pattern) {
            return this.write(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_VIBRATOR_CHAR,
                [pattern],
            );
        }
        getLedStatus() {
            return this.read(BLE_UUID_IO_SERVICE, BLE_UUID_IO_LED_CHAR)
                .then(data => data[0]);
        }
        setLed(state, color = 0x000000) {
            /* eslint no-bitwise: "warn" */
            const message = new Uint8Array(3);
            message.set([state ? 1 : 0]);
            const r = (color >> 16) & 255;
            const g = (color >> 8) & 255;
            const b = color & 255;
            const rgb565 = (((r & 248) << 8) + ((g & 252) << 3) + ((b & 248) >> 3));
            message.set([rgb565 >> 8], 1);
            message.set([rgb565 & 0xff], 2);
            return this.write(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_LED_CHAR,
                message,
            );
        }
        subscribePosition() {
            if (this._eulerSubscribed) {
                return Promise.resolve();
            }
            // Synchronous state change. Multiple calls to subscribe will stop after the first
            this._eulerSubscribed = true;
            return this.subscribe(
                BLE_UUID_SENSOR_SERVICE,
                BLE_UUID_SENSOR_QUATERNIONS_CHAR,
                this.onPosition,
            ).catch((e) => {
                // Revert state if failed to subscribe
                this._eulerSubscribed = false;
                throw e;
            });
        }
        subscribeButton() {
            if (this._buttonSubscribed) {
                return Promise.resolve();
            }
            // Synchronous state change. Multiple calls to subscribe will stop after the first
            this._buttonSubscribed = true;
            return this.subscribe(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_USER_BUTTON_CHAR,
                this.onUserButton,
            ).catch((e) => {
                // Revert state if failed to subscribe
                this._buttonSubscribed = false;
                throw e;
            });
        }
        unsubscribeButton() {
            if (!this._buttonSubscribed) {
                return Promise.resolve();
            }
            return this.unsubscribe(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_USER_BUTTON_CHAR,
            ).then(() => {
                // Stay subscribed until unsubscribe suceeds
                this._buttonSubscribed = false;
            });
        }
        getButtonStatus() {
            return this.read(BLE_UUID_IO_SERVICE, BLE_UUID_IO_USER_BUTTON_CHAR)
                .then(data => data[0]);
        }
        keepAlive() {
            return this.write(
                BLE_UUID_IO_SERVICE,
                BLE_UUID_IO_KEEP_ALIVE_CHAR,
                [1],
            );
        }
        // --- Position ---
        subscribePosition() {
            if (this._eulerSubscribed) {
                return Promise.resolve();
            }
            // Synchronous state change. Multiple calls to subscribe will stop after the first
            this._eulerSubscribed = true;
            return this.subscribe(
                BLE_UUID_SENSOR_SERVICE,
                BLE_UUID_SENSOR_QUATERNIONS_CHAR,
                this.onPosition,
            ).catch((e) => {
                // Revert state if failed to subscribe
                this._eulerSubscribed = false;
                throw e;
            });
        }
        unsubscribePosition() {
            if (!this._eulerSubscribed) {
                return Promise.resolve();
            }
            return this.unsubscribe(
                BLE_UUID_SENSOR_SERVICE,
                BLE_UUID_SENSOR_QUATERNIONS_CHAR,
                this.onPosition,
            ).then(() => {
                // Stay subscribed until unsubscribe succeeds
                this._eulerSubscribed = false;
            });
        }
        subscribeTemperature() {
            if (this._temperatureSubscribed) {
                return Promise.resolve();
            }
            // Synchronous state change. Multiple calls to subscribe will stop after the first
            this._temperatureSubscribed = true;
            return this.subscribe(
                BLE_UUID_SENSOR_SERVICE,
                BLE_UUID_SENSOR_TEMP_CHAR,
                this.onTemperature,
            ).catch((e) => {
                // Revert state if failed to subscribe
                this._temperatureSubscribed = false;
                throw e;
            });
        }
        unsubscribeTemperature() {
            if (!this._temperatureSubscribed) {
                return Promise.resolve();
            }
            return this.unsubscribe(
                BLE_UUID_SENSOR_SERVICE,
                BLE_UUID_SENSOR_TEMP_CHAR,
                this.onTemperature,
            ).then(() => {
                // Stay subscribed until unsubscribe succeeds
                this._temperatureSubscribed = false;
            });
        }
        calibrateMagnetometer() {
            return this.calibrateChar(BLE_UUID_SENSOR_SERVICE, BLE_UUID_SENSOR_MAGN_CALIBRATE_CHAR);
        }
        resetQuaternions() {
            return this.write(BLE_UUID_SENSOR_SERVICE, BLE_UUID_SENSOR_QUATERNIONS_RESET_CHAR, [1]);
        }
        calibrateChar(sId, cId) {
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
                        ).then(() => this.write(sId, cId, [1]));
                    });
                })
                .then(() => {
                    if (wasSubscribed) {
                        return this.subscribeEuler();
                    }
                    return null;
                });
        }
        update(buffer) {
            return this.manager.updateDFUDevice(this, buffer);
        }
        onUserButton(data) {
            this.emit('user-button', data[0]);
        }
        onPosition(r) {
            const w = Wand.uInt8ToUInt16(r[0], r[1]);
            const x = Wand.uInt8ToUInt16(r[2], r[3]);
            const y = Wand.uInt8ToUInt16(r[4], r[5]);
            const z = Wand.uInt8ToUInt16(r[6], r[7]);
            this.emit('position', [w, x, y, z]);
        }
        onTemperature(temperature) {
            let auxTemperature = Wand.uInt8ToUInt16(temperature[0], temperature[1]);
            this.emit('temperature', auxTemperature);
        }
        onBatteryStatus(data) {
            this.emit('battery-status', data[0]);
        }
    }

    return Wand;
};

export default WandMixin;
