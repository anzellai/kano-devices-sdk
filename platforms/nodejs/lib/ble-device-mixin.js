const BLEDeviceMixin = (Device) => {
    class BLEDevice extends Device {
        constructor(device) {
            super();
            this.type = 'ble-device';
            this.device = device;
            this.serviceCache = new Map();
            this.charCache = new Map();
            this._setupPromise = null;
            this.device.on('disconnect', this.onDisconnect.bind(this));
        }
        onDisconnect() {
            this.emit('disconnect');
        }
        setup() {
            if (!this._setupPromise) {
                this._setupPromise = this.connect();
            }
            return this._setupPromise;
        }
        connect() {
            return BLEDevice.connectToPeripheral(this.device);
        }
        disconnect() {
            return BLEDevice.disconnectFromPeripheral(this.device);
        }
        getService(uuid) {
            if (this.serviceCache.has(uuid)) {
                return Promise.resolve(this.serviceCache.get(uuid));
            }
            return this.setup()
                .then(() => BLEDevice.getService(this.device, uuid))
                .then((service) => {
                    if (service) {
                        this.serviceCache.set(uuid, service);
                    }
                    return service;
                });
        }
        getCharacteristic(sId, cId) {
            if (this.charCache.has(cId)) {
                return Promise.resolve(this.charCache.get(cId));
            }
            return this.getService(sId)
                .then(service => BLEDevice.getCharacteristic(service, cId))
                .then((char) => {
                    if (char) {
                        this.charCache.set(cId, char);
                    }
                    return char;
                });
        }
        subscribe(sId, cId, onValue) {
            return this.getCharacteristic(sId, cId)
                .then(char => BLEDevice.subscribe(char, onValue));
        }
        unsubscribe(sId, cId) {
            return this.getCharacteristic(sId, cId)
                .then(char => BLEDevice.unsubscribe(char));
        }
        write(sId, cId, value) {
            return this.getCharacteristic(sId, cId)
                .then(char => new Promise((resolve, reject) => {
                    const withoutResponse = char.properties.indexOf('writeWithoutResponse') === -1;
                    char.write(Buffer.from(value), withoutResponse, (err, response) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(response);
                    });
                }));
        }
        read(sId, cId) {
            return this.getCharacteristic(sId, cId)
                .then(char => new Promise((resolve, reject) => {
                    char.read((err, data) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(data);
                    });
                }));
        }
        static connectToPeripheral(peripheral) {
            if (peripheral.state === 'connected') {
                return Promise.resolve(peripheral);
            }
            return new Promise((resolve, reject) => {
                peripheral.connect((err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(peripheral);
                });
            });
        }
        static disconnectFromPeripheral(peripheral) {
            return new Promise((resolve, reject) => {
                peripheral.disconnect((err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            });
        }
        static getService(peripheral, uuid, retried = false) {
            return new Promise((resolve, reject) => {
                peripheral.discoverServices([uuid], (err, services) => {
                    if (err) {
                        return reject(err);
                    }
                    // Services can sometime not be ready right away. Retry shortly after
                    if (!services[0] && !retried) {
                        return new Promise(r => setTimeout(r, 100))
                            .then(() => BLEDevice.getService(peripheral, uuid, true));
                    }
                    return resolve(services[0]);
                });
            });
        }
        static getCharacteristic(service, charUuid) {
            return new Promise((resolve, reject) => {
                service.discoverCharacteristics([charUuid], (err, characteristics) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(characteristics[0]);
                });
            });
        }
        static subscribe(char, valueCallback) {
            char.on('data', valueCallback);
            return new Promise((resolve, reject) => {
                char.subscribe((err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            });
        }
        static unsubscribe(char) {
            return new Promise((resolve, reject) => {
                char.unsubscribe((err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            });
        }
        toJSON() {
            return {
                id: this.id,
                address: this.device.address,
                bluetooth: {
                    name: this.device.advertisement.localName,
                    address: this.device.address,
                },
            };
        }
        terminate() {
            return this.disconnect();
        }
        static localUuid(uuid) {
            return uuid.replace(/-/g, '').toLowerCase();
        }
    }
    return BLEDevice;
};

module.exports = BLEDeviceMixin;
