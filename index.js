'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var events = require('events');

class Package {
    constructor(extractor, buffer) {
        this.extractor = extractor;
        this.buffer = buffer;
        this.zipFile = null;
        this.manifest = null;
    }
    load() {
        return this.extractor.loadAsync(this.buffer)
            .then((zipFile) => {
                this.zipFile = zipFile;
                try {
                    return this.zipFile.file('manifest.json').async('string');
                } catch (e) {
                    throw new Error('Unable to find manifest, is this a proper DFU package?');
                }
            })
            .then((content) => {
                this.manifest = JSON.parse(content).manifest;
                return this;
            });
    }
    getImage(types) {
        let type;
        for (let i = 0; i < types.length; i += 1) {
            type = types[i];
            if (this.manifest[type]) {
                const entry = this.manifest[type];
                const result = {
                    type,
                    initFile: entry.dat_file,
                    imageFile: entry.bin_file,
                };

                return this.zipFile.file(result.initFile).async('arraybuffer')
                    .then((data) => {
                        result.initData = data;
                        return this.zipFile.file(result.imageFile).async('arraybuffer');
                    })
                    .then((data) => {
                        result.imageData = data;
                        return result;
                    });
            }
        }
        return null;
    }
    getBaseImage() {
        return this.getImage(['softdevice', 'bootloader', 'softdevice_bootloader']);
    }
    getAppImage() {
        return this.getImage(['application']);
    }
}

let counter = 0;

class Device extends events.EventEmitter {
    constructor(manager, abstract = false) {
        super();
        this.manager = manager;
        this.abstract = abstract;
        this.type = 'device';
        // Abstract devices don't have an id, or increement the counter
        if (this.abstract) {
            return;
        }
        this.id = counter.toString();
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
    const DFU_NAME_CHARACTERISTIC = BLEDevice.localUuid('64A70003-F691-4B93-A6F4-0968F5B648F8');

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
        getDFUName() {
            return this.read(INFO_SERVICE, DFU_NAME_CHARACTERISTIC)
                .then(data => BLEDevice.uInt8ArrayToString(data));
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
                // Stay subscribed until unsubscribe suceeds
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
                // Stay subscribed until unsubscribe suceeds
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

const CRC32 = {};

CRC32.version = '1.2.0';
/* see perf/crc32table.js */
function signed_crc_table() {
	var c = 0, table = new Array(256);

	for(var n =0; n != 256; ++n){
		c = n;
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		table[n] = c;
	}

	return typeof Int32Array !== 'undefined' ? new Int32Array(table) : table;
}

var T = signed_crc_table();
function crc32_bstr(bstr, seed) {
	var C = seed ^ -1, L = bstr.length - 1;
	for(var i = 0; i < L;) {
		C = (C>>>8) ^ T[(C^bstr.charCodeAt(i++))&0xFF];
		C = (C>>>8) ^ T[(C^bstr.charCodeAt(i++))&0xFF];
	}
	if(i === L) C = (C>>>8) ^ T[(C ^ bstr.charCodeAt(i))&0xFF];
	return C ^ -1;
}

function crc32_buf(buf, seed) {
	if(buf.length > 10000) return crc32_buf_8(buf, seed);
	var C = seed ^ -1, L = buf.length - 3;
	for(var i = 0; i < L;) {
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	}
	while(i < L+3) C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	return C ^ -1;
}

function crc32_buf_8(buf, seed) {
	var C = seed ^ -1, L = buf.length - 7;
	for(var i = 0; i < L;) {
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
		C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	}
	while(i < L+7) C = (C>>>8) ^ T[(C^buf[i++])&0xFF];
	return C ^ -1;
}

function crc32_str(str, seed) {
	var C = seed ^ -1;
	for(var i = 0, L=str.length, c, d; i < L;) {
		c = str.charCodeAt(i++);
		if(c < 0x80) {
			C = (C>>>8) ^ T[(C ^ c)&0xFF];
		} else if(c < 0x800) {
			C = (C>>>8) ^ T[(C ^ (192|((c>>6)&31)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|(c&63)))&0xFF];
		} else if(c >= 0xD800 && c < 0xE000) {
			c = (c&1023)+64; d = str.charCodeAt(i++)&1023;
			C = (C>>>8) ^ T[(C ^ (240|((c>>8)&7)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|((c>>2)&63)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|((d>>6)&15)|((c&3)<<4)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|(d&63)))&0xFF];
		} else {
			C = (C>>>8) ^ T[(C ^ (224|((c>>12)&15)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|((c>>6)&63)))&0xFF];
			C = (C>>>8) ^ T[(C ^ (128|(c&63)))&0xFF];
		}
	}
	return C ^ -1;
}
CRC32.table = T;
// $FlowIgnore
CRC32.bstr = crc32_bstr;
// $FlowIgnore
CRC32.buf = crc32_buf;
// $FlowIgnore
CRC32.str = crc32_str;

const OPERATIONS = {
    BUTTON_COMMAND: [0x01],
    CREATE_COMMAND: [0x01, 0x01],
    CREATE_DATA: [0x01, 0x02],
    RECEIPT_NOTIFICATIONS: [0x02],
    CACULATE_CHECKSUM: [0x03],
    EXECUTE: [0x04],
    SELECT_COMMAND: [0x06, 0x01],
    SELECT_DATA: [0x06, 0x02],
    RESPONSE: [0x60, 0x20],
};

const RESPONSE = {
    // Invalid code
    0x00: 'Invalid opcode',
    // Success
    0x01: 'Operation successful',
    // Opcode not supported
    0x02: 'Opcode not supported',
    // Invalid parameter
    0x03: 'Missing or invalid parameter value',
    // Insufficient resources
    0x04: 'Not enough memory for the data object',
    // Invalid object
    0x05: 'Data object does not match the firmware and hardware requirements, the signature is wrong, or parsing the command failed',
    // Unsupported type
    0x07: 'Not a valid object type for a Create request',
    // Operation not permitted
    0x08: 'The state of the DFU process does not allow this operation',
    // Operation failed
    0x0A: 'Operation failed',
    // Extended error
    0x0B: 'Extended error',
};

const EXTENDED_ERROR = {
    // No error
    0x00: 'No extended error code has been set. This error indicates an implementation problem',
    // Invalid error code
    0x01: 'Invalid error code. This error code should never be used outside of development',
    // Wrong command format
    0x02: 'The format of the command was incorrect',
    // Unknown command
    0x03: 'The command was successfully parsed, but it is not supported or unknown',
    // Init command invalid
    0x04: 'The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type',
    // Firmware version failure
    0x05: 'The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version',
    // Hardware version failure
    0x06: 'The hardware version of the device does not match the required hardware version for the update',
    // Softdevice version failure
    0x07: 'The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice',
    // Signature missing
    0x08: 'The init packet does not contain a signature',
    // Wrong hash type
    0x09: 'The hash type that is specified by the init packet is not supported by the DFU bootloader',
    // Hash failed
    0x0A: 'The hash of the firmware image cannot be calculated',
    // Wrong signature type
    0x0B: 'The type of the signature is unknown or not supported by the DFU bootloader',
    // Verification failed
    0x0C: 'The hash of the received firmware image does not match the hash in the init packet',
    // Insufficient space
    0x0D: 'The available space on the device is insufficient to hold the firmware',
};

const LITTLE_ENDIAN = true;
const PACKET_SIZE = 20;

const EVENT_PROGRESS = 'progress';


// Mixin extending a BLEDevice
const DFUMixin = (BLEDevice) => {
    const DFU_SERVICE = BLEDevice.localUuid('fe59');
    const CONTROL_UUID = BLEDevice.localUuid('8ec90001-f315-4f60-9fb8-838830daea50');
    const PACKET_UUID = BLEDevice.localUuid('8ec90002-f315-4f60-9fb8-838830daea50');
    const BUTTON_UUID = BLEDevice.localUuid('8ec90003-f315-4f60-9fb8-838830daea50');

    /**
     * Emits: position, battery-status, user-button, sleep
     */
    class DFU extends BLEDevice {
        constructor(...args) {
            super(...args);
            this.type = 'dfu';
            this._transfer = {
                type: 'none',
                totalBytes: 0,
            };
        }

        setDfuMode() {
            return new Promise((resolve, reject) => {
                this.on('disconnect', () => resolve());
                const onResponse = (response) => {
                    DFU.handleResponse(response.buffer).catch(reject);
                };
                this.subscribe(DFU_SERVICE, BUTTON_UUID, onResponse)
                    .then(() => new Promise(r => setTimeout(r, 100)))
                    .then(() => this.sendOperation(BUTTON_UUID, OPERATIONS.BUTTON_COMMAND))
                    .catch(reject);
            });
        }

        static handleResponse(buffer) {
            return new Promise((resolve, reject) => {
                const view = new DataView(buffer);
                let error;
                if (OPERATIONS.RESPONSE.indexOf(view.getUint8(0)) < 0) {
                    throw new Error('Unrecognised control characteristic response notification');
                }
                const result = view.getUint8(2);
                if (result === 0x01) {
                    const data = new DataView(view.buffer, 3);
                    return resolve(data);
                } else if (result === 0x0B) {
                    const code = view.getUint8(3);
                    error = `Error: ${EXTENDED_ERROR[code]}`;
                } else {
                    error = `Error: ${RESPONSE[result]}`;
                }
                return reject(new Error(error));
            });
        }

        static checkCrc(buffer, crc) {
            console.log('expected', crc);
            console.log('found', CRC32.buf(new Uint8Array(buffer)));
            return crc === CRC32.buf(new Uint8Array(buffer));
        }

        transferInit(buffer) {
            return this.transfer(buffer, 'init', OPERATIONS.SELECT_COMMAND, OPERATIONS.CREATE_COMMAND);
        }

        transferFirmware(buffer) {
            return this.transfer(buffer, 'firmware', OPERATIONS.SELECT_DATA, OPERATIONS.CREATE_DATA);
        }

        transfer(buffer, type, selectType, createType) {
            return this.sendControl(selectType)
                .then((response) => {
                    const maxSize = response.getUint32(0, LITTLE_ENDIAN);
                    const offset = response.getUint32(4, LITTLE_ENDIAN);
                    const crc = response.getInt32(8, LITTLE_ENDIAN);

                    if (type === 'init' && offset === buffer.byteLength && DFU.checkCrc(buffer, crc)) {
                        return Promise.resolve();
                    }

                    this.startTransfer(type, buffer.byteLength);

                    return this.transferObject(buffer, createType, maxSize, offset);
                });
        }

        startTransfer(type, totalBytes) {
            this._transfer.type = type;
            this._transfer.totalBytes = totalBytes;
            this._transfer.currentBytes = 0;
        }

        transferObject(buffer, createType, maxSize, o) {
            let offset = o;
            const start = offset - (offset % maxSize);
            const end = Math.min(start + maxSize, buffer.byteLength);

            const view = new DataView(new ArrayBuffer(4));
            view.setUint32(0, end - start, LITTLE_ENDIAN);

            return this.sendControl(createType, view.buffer)
                .then(() => {
                    const data = buffer.slice(start, end);
                    return this.transferData(data, start);
                })
                .then(() => this.sendControl(OPERATIONS.CACULATE_CHECKSUM))
                .then((response) => {
                    const crc = response.getInt32(4, LITTLE_ENDIAN);
                    const transferred = response.getUint32(0, LITTLE_ENDIAN);
                    const data = buffer.slice(0, transferred);

                    if (DFU.checkCrc(data, crc)) {
                        offset = transferred;
                        return this.sendControl(OPERATIONS.EXECUTE);
                    }
                    return Promise.resolve();
                })
                .then(() => {
                    if (end < buffer.byteLength) {
                        return this.transferObject(buffer, createType, maxSize, offset);
                    }
                    return Promise.resolve();
                });
        }

        transferData(data, offset, s) {
            const start = s || 0;
            const end = Math.min(start + PACKET_SIZE, data.byteLength);
            const packet = data.slice(start, end);

            return this.writePacket(packet)
                .then(() => {
                    this.progress(offset + end);

                    if (end < data.byteLength) {
                        return this.transferData(data, offset, end);
                    }
                    return null;
                });
        }

        writePacket(packet) {
            return this.write(DFU_SERVICE, PACKET_UUID, packet, true);
        }

        sendControl(operation, buffer) {
            return this.sendOperation(CONTROL_UUID, operation, buffer);
        }

        sendOperation(cId, operation, buffer) {
            let size = operation.length;
            if (buffer) size += buffer.byteLength;

            const value = new Uint8Array(size);
            value.set(operation);
            if (buffer) {
                const data = new Uint8Array(buffer);
                value.set(data, operation.length);
            }
            return new Promise((resolve, reject) => {
                const onResponse = (response) => {
                    this.unsubscribe(DFU_SERVICE, cId, onResponse);
                    DFU.handleResponse(response.buffer)
                        .then(resolve, reject);
                };
                this.subscribe(DFU_SERVICE, cId, onResponse)
                    .then(() => this.write(DFU_SERVICE, cId, value))
                    .catch(reject);
            });
        }

        progress(n) {
            this._transfer.currentBytes = n;
            this.emit(EVENT_PROGRESS, this._transfer);
        }

        update(init, firmware) {
            if (!init) {
                throw new Error('Init not specified');
            }
            if (!firmware) {
                throw new Error('Firmware not specified');
            }
            return this.transferInit(init)
                .then(() => this.transferFirmware(firmware));
        }
    }

    return DFU;
};

const WAND_PREFIX = 'Kano-Wand';

class Devices extends events.EventEmitter {
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
                    .then(image => dfuTarget.update(image.initData, image.imageData));
            })
            .then(() => device.connect());
    }
    addDevice(device) {
        let alreadyAdded = false;
        this.devices.forEach(dev => {
            if (dev.device.address === device.device.address) {
                alreadyAdded = true;
            }
        });
        // Check if the device exists already
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

class SubscriptionsManager {
    constructor(opts = {}) {
        this.options = Object.assign({}, {
            subscribe() { return Promise.resolve(); },
            unsubscribe() { return Promise.resolve(); },
        }, opts);
        this.subscriptions = new Map();
    }

    static getSubscriptionKey(sId, cId) {
        return `${sId}:${cId}`;
    }

    clear() {
        this.subscriptions = new Map();
    }

    flagAsUnsubscribe() {
        this.subscriptions.forEach((sub) => {
            sub.subscribed = false;
        });
    }

    resubscribe() {
        this.subscriptions.forEach((entry) => {
            this.maybeSubscribe(entry.sId, entry.cId);
        });
    }

    subscribe(sId, cId, onValue) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, {
                subscribed: false,
                callbacks: [],
                sId,
                cId,
            });
        }
        const subscriptions = this.subscriptions.get(key);
        subscriptions.callbacks.push(onValue);
        return this.maybeSubscribe(sId, cId);
    }
    maybeSubscribe(sId, cId) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        const subscriptions = this.subscriptions.get(key);
        if (!subscriptions.subscribed) {
            subscriptions.subscribed = true;
            return this._subscribe(sId, cId, (value) => {
                subscriptions.callbacks.forEach(callback => callback(value));
            });
        }
        return Promise.resolve();
    }
    unsubscribe(sId, cId, onValue) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);        if (!this.subscriptions.has(key)) {
            return Promise.resolve();
        }
        const subscriptions = this.subscriptions.get(key);
        const index = subscriptions.callbacks.indexOf(onValue);
        subscriptions.callbacks.splice(index, 1);
        return this.maybeUnsubscribe(sId, cId);
    }
    maybeUnsubscribe(sId, cId) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        const subscriptions = this.subscriptions.get(key);
        if (subscriptions.subscribed) {
            subscriptions.subscribed = false;
            this._unsubscribe(sId, cId);
        }
        return Promise.resolve();
    }
    _subscribe(sId, cId, callback) {
        return this.options.subscribe(sId, cId, callback);
    }
    _unsubscribe(sId, cId) {
        return this.options.unsubscribe(sId, cId);
    }
}

exports.default = Devices;
exports.Package = Package;
exports.Devices = Devices;
exports.SubscriptionsManager = SubscriptionsManager;
