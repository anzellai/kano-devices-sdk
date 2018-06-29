import crc32 from './vendor/crc-32.js';

const OPERATIONS = {
    BUTTON_COMMAND: [0x01],
    SET_DFU_NAME: [0x02],
    CREATE_COMMAND: [0x01, 0x01],
    CREATE_DATA: [0x01, 0x02],
    RECEIPT_NOTIFICATIONS: [0x02],
    CALCULATE_CHECKSUM: [0x03],
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

    const RECEIPT_NOTIFICATION_PACKETS = 20;

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

            this.packetsWritten = 0;
        }

        setDfuMode() {
            return new Promise((resolve, reject) => {
                this.on('disconnect', () => resolve());
                Promise.resolve()
                    .then(() => {
                        let auxAddress = this.device.address.substr(this.device.address.length - 5).replace(':', '-');
                        this.dfuName = `DFU-${auxAddress}`;
                        return this.sendOperation(
                            BUTTON_UUID, 
                            OPERATIONS.SET_DFU_NAME.concat(this.dfuName.length), 
                            new Buffer(this.dfuName)
                        );
                    })
                    .then(() => new Promise(r => setTimeout(r, 100)))
                    .then(() => {
                        // Disable the reconnect try when the board will restart to go
                        // into DFU mode.
                        this._manuallyDisconnected = true;

                        return this.sendOperation(BUTTON_UUID, OPERATIONS.BUTTON_COMMAND);
                    })
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
            console.log('found', crc32.buf(new Uint8Array(buffer)));
            return crc === crc32.buf(new Uint8Array(buffer));
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
                    
                    // Reset the packets written after you send the CREATE
                    this.packetsWritten = 0;

                    return this.transferData(data, start);
                })
                .then(() => {
                    this.ignoreReceipt = true;
                    return this.sendControl(OPERATIONS.CALCULATE_CHECKSUM)
                })
                .then((response) => {
                    const crc = response.getInt32(4, LITTLE_ENDIAN);
                    const transferred = response.getUint32(0, LITTLE_ENDIAN);
                    const data = buffer.slice(0, transferred);

                    this.ignoreReceipt = false;
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
                    this.packetsWritten += 1;

                    this.progress(offset + end);

                    if (end < data.byteLength) {
                        return Promise.resolve()
                            .then(() => {
                                if (this.packetsWritten < RECEIPT_NOTIFICATION_PACKETS) {
                                    return Promise.resolve();
                                }

                                return new Promise((resolve, reject) => {
                                    // If we already received the CRC, we're safe to continue
                                    if (this.receivedCRC) {
                                        resolve();
                                    }

                                    let waitForCRC = setInterval(() => {
                                        if (this.receivedCRC) {
                                            resolve();
                                            clearInterval(waitForCRC);
                                        }
                                    }, 5);
                                })
                                .then(() => {
                                    this.receivedCRC = false;
                                    this.packetsWritten = 0;
                                });
                            })
                            .then(() => this.transferData(data, offset, end));
                    }
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
            return this.subscribe(DFU_SERVICE, CONTROL_UUID, response => {
                // The receipt notification is a CRC response.
                if (response[0] == 96 && response[1] == 3) {
                    if (!this.ignoreReceipt) {
                        this.receivedCRC = true;
                    }
                }
            })
                .then(() => {
                    return new Promise((resolve, reject) => {
                        // Enable the receipt notification
                        let value = new Buffer(2);
                        value.writeUInt16LE(RECEIPT_NOTIFICATION_PACKETS, 0);

                        this.sendControl(OPERATIONS.RECEIPT_NOTIFICATIONS, value)
                            .then(resolve);
                    })
                })
                .then(() => this.transferInit(init))
                .then(() => this.transferFirmware(firmware));
        }
    }

    return DFU;
};

export default DFUMixin;
