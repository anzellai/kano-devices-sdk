

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
    const RESET_QUATERNIONS_CHARACTERISTIC = BLEDevice.localUuid('64A70004-F691-4B93-A6F4-0968F5B648F8');
    const TEMPERATURE_CHARACTERISTIC = BLEDevice.localUuid('64A70014-F691-4B93-A6F4-0968F5B648F8');


    /**
     * Emits: position, temperature, battery-status, user-button, sleep
     */
    class Wand extends BLEDevice {
        constructor(...args) {
            super(...args);
            this.type = 'wand';
            this._eulerSubscribed = false;
            this._temperatureSubscribed = false;
            this.onUserButton = this.onUserButton.bind(this);
            this.onPosition = this.onPosition.bind(this);
            this.onSleepStatus = this.onSleepStatus.bind(this);
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
            return this.read(INFO_SERVICE, ORGANISATION_CHARACTERISTIC)
                .then(data => BLEDevice.uInt8ArrayToString(data));
        }
        getSoftwareVersion() {
            return this.read(INFO_SERVICE, SOFTWARE_VERSION_CHARACTERISTIC)
                .then(data => BLEDevice.uInt8ArrayToString(data));
        }
        getHardwareBuild() {
            return this.read(INFO_SERVICE, HARDWARE_BUILD_CHARACTERISTIC)
                .then(data => data[0]);
        }
        // --- IO ---
        getBatteryStatus() {
            return this.read(IO_SERVICE, BATTERY_STATUS_CHARACTERISTIC)
                .then(data => data[0]);
        }
        subscribeBatteryStatus() {
            return this.subscribe(
                IO_SERVICE,
                BATTERY_STATUS_CHARACTERISTIC,
                this.onBatteryStatus,
            );
        }
        unsubscribeBatteryStatus() {
            return this.unsubscribe(
                IO_SERVICE,
                BATTERY_STATUS_CHARACTERISTIC,
                this.onBatteryStatus,
            );
        }
        getVibratorStatus() {
            return this.read(IO_SERVICE, VIBRATOR_CHARACTERISTIC)
                .then(data => data[0]);
        }
        vibrate(pattern) {
            return this.write(
                IO_SERVICE,
                VIBRATOR_CHARACTERISTIC,
                [pattern],
            );
        }
        getLedStatus() {
            return this.read(IO_SERVICE, LED_CHARACTERISTIC)
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
                IO_SERVICE,
                LED_CHARACTERISTIC,
                message,
            );
        }
        getNumber() {
            return this.read(IO_SERVICE, WAND_NUMBER_CHARACTERISTIC)
                .then(data => data[0]);
        }
        setNumber(n) {
            return this.write(
                IO_SERVICE,
                WAND_NUMBER_CHARACTERISTIC,
                [n],
            );
        }
        resetPairing() {
            return this.write(
                IO_SERVICE,
                RESET_PAIRING_CHARACTERISTIC,
                [1],
            );
        }
        subscribeButton() {
            return this.subscribe(
                IO_SERVICE,
                BUTTON_CHARACTERISTIC,
                this.onUserButton,
            );
        }
        unsubscribeButton() {
            return this.unsubscribe(
                IO_SERVICE,
                BUTTON_CHARACTERISTIC,
                this.onUserButton,
            );
        }
        getButtonStatus() {
            return this.read(IO_SERVICE, BUTTON_CHARACTERISTIC)
                .then(data => data[0]);
        }
        subscribeSleep() {
            return this.subscribe(
                IO_SERVICE,
                SLEEP_CHARACTERISTIC,
                this.onSleepStatus,
            );
        }
        unsubscribeSleep() {
            return this.unsubscribe(
                IO_SERVICE,
                SLEEP_CHARACTERISTIC,
                this.onSleepStatus,
            );
        }
        getSleepStatus() {
            return this.read(IO_SERVICE, SLEEP_CHARACTERISTIC)
                .then(data => data[0]);
        }
        keepAlive() {
            return this.write(
                IO_SERVICE,
                KEEP_ALIVE_CHARACTERISTIC,
                [1],
            );
        }
        // --- Position ---
        subscribeEuler(...args) {
            return this.subscribePosition(...args);
        }
        unsubscribeEuler(...args) {
            return this.unsubscribePosition(...args);
        }
        subscribePosition() {
            if (this._eulerSubscribed) {
                return Promise.resolve();
            }
            // Synchronous state change. Multiple calls to subscribe will stop after the first
            this._eulerSubscribed = true;
            return this.subscribe(
                EULER_POSITION_SERVICE,
                EULER_POSITION_CHARACTERISTIC,
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
                EULER_POSITION_SERVICE,
                EULER_POSITION_CHARACTERISTIC,
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
                EULER_POSITION_SERVICE,
                TEMPERATURE_CHARACTERISTIC,
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
                EULER_POSITION_SERVICE,
                TEMPERATURE_CHARACTERISTIC,
                this.onTemperature,
            ).then(() => {
                // Stay subscribed until unsubscribe succeeds
                this._temperatureSubscribed = false;
            });
        }
        calibrateGyroscope() {
            return this.calibrateChar(EULER_POSITION_SERVICE, CALIBRATE_GYROSCOPE_CHARACTERISTIC);
        }
        calibrateMagnetometer() {
            return this.calibrateChar(EULER_POSITION_SERVICE, CALIBRATE_MAGNOMETER_CHARACTERISTIC);
        }
        resetQuaternions() {
            return this.write(EULER_POSITION_SERVICE, RESET_QUATERNIONS_CHARACTERISTIC, [1]);
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
        onSleepStatus(data) {
            this.emit('sleep', data[0]);
        }
        onBatteryStatus(data) {
            this.emit('battery-status', data[0]);
        }
    }

    return Wand;
};

export default WandMixin;
