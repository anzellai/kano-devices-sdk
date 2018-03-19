const Watcher = require('./ble-watcher');

const RECONNECT_SCAN_TIMEOUT = 30000;

const BLEDeviceMixin = (Device) => {
    class BLEDevice extends Device {
        constructor(device, ...args) {
            super(...args);
            this.type = 'ble-device';
            // An abstract device will not need connection or watcher
            if (this.abstract) {
                return;
            }
            this.onDisconnect = this.onDisconnect.bind(this);
            this.watcher = new Watcher();
            // Subscriptions persist accross device handle switch
            this.subscriptions = new Map();
            // Reset providing the device handle found
            this.reset(device);
        }
        reset(device) {
            this.device = device;
            this.serviceCache = new Map();
            this.charCache = new Map();
            this._setupPromise = null;
            this.device.on('disconnect', this.onDisconnect);
            this.state = 'disconnected';
        }
        setState(state) {
            if (this.state !== state) {
                switch (state) {
                case 'connected': {
                    this.emit('connect');
                    break;
                }
                case 'reconnected': {
                    this.emit('reconnect');
                    break;
                }
                case 'disconnected': {
                    this.emit('disconnect');
                    break;
                }
                case 'connecting': {
                    this.emit('connecting');
                    break;
                }
                case 'reconnecting': {
                    this.emit('reconnecting');
                    break;
                }
                default: {
                    break;
                }
                }
            }
            this.state = state;
        }
        onDisconnect() {
            if (this.state === 'disconnected' || this.state === 'connecting') {
                return;
            }
            // Flag all subscriptions as not subscribed
            this.subscriptions.forEach((sub) => {
                sub.subscribed = false;
            });
            // Clean the services/characteristics map
            this.serviceCache = new Map();
            this.charCache = new Map();
            if (!this._manuallyDisconnected) {
                this.reconnect();
            } else {
                this.setState('disconnected');
            }
        }
        onManualDisconnect() {
            this.serviceCache = new Map();
            this.charCache = new Map();
            this.subscriptions = new Map();
        }
        setup() {
            if (!this._setupPromise) {
                this._setupPromise = this.connect()
                    .then(() => this.discover())
                    .then(() => {
                        this.setState('connected');
                    });
            }
            return this._setupPromise;
        }
        connect() {
            if (this.state === 'connected') {
                return Promise.resolve();
            }
            this.setState('connecting');
            return BLEDevice.connectToPeripheral(this.device);
        }
        disconnect() {
            this._manuallyDisconnected = true;
            return BLEDevice.disconnectFromPeripheral(this.device);
        }
        reconnect() {
            this.setState('reconnecting');
            const testFunc = p => BLEDevice.normalizeAddress(p.address) === this.device.address;
            // Was connected before, so address should be available on apple devices
            return this.watcher.searchForDevice(testFunc, RECONNECT_SCAN_TIMEOUT)
                .then((device) => {
                    // Reset this device with the device found through scan
                    this.reset(device);
                    // Custom setup method after a reconnect. Avoids the `connecting` state
                    this._setupPromise = BLEDevice.connectToPeripheral(this.device)
                        .then(() => this.discover())
                        .then(() => {
                            // Resubsribe to the characteristics if needed
                            this.subscriptions.forEach((entry) => {
                                this.maybeSubscribe(entry.sId, entry.cId);
                            });
                            this.setState('reconnected');
                        });
                    return this.setup();
                })
                .catch(() => {
                    this.setState('disconnected');
                });
        }
        discover() {
            this.serviceCache = new Map();
            this.charCache = new Map();
            return new Promise((resolve, reject) => {
                this.device.discoverAllServicesAndCharacteristics((err, services, chars) => {
                    if (err) {
                        return reject(err);
                    }
                    services.forEach((service) => {
                        this.serviceCache.set(service.uuid, service);
                    });
                    chars.forEach((characteristic) => {
                        this.charCache.set(characteristic.uuid, characteristic);
                    });
                    return resolve();
                });
            });
        }
        getService(uuid) {
            return this.serviceCache.get(uuid);
        }
        getCharacteristic(sId, cId) {
            return this.charCache.get(cId);
        }
        static getSubscriptionKey(sId, cId) {
            return `${sId}:${cId}`;
        }
        subscribe(sId, cId, onValue) {
            const key = BLEDevice.getSubscriptionKey(sId, cId);
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
            const key = BLEDevice.getSubscriptionKey(sId, cId);
            const subscriptions = this.subscriptions.get(key);
            if (!subscriptions.subscribed) {
                subscriptions.subscribed = true;
                const char = this.getCharacteristic(sId, cId);
                return BLEDevice.subscribe(char, (value) => {
                    subscriptions.callbacks.forEach(callback => callback(value));
                });
            }
            return Promise.resolve();
        }
        unsubscribe(sId, cId, onValue) {
            const key = [sId, cId];
            if (!this.subscriptions.has(key)) {
                return Promise.resolve();
            }
            const subscriptions = this.subscriptions.get(key);
            const index = subscriptions.indexOf(onValue);
            subscriptions.splice(index, 1);
            return this.maybeUnsubscribe(sId, cId);
        }
        maybeUnsubscribe(sId, cId) {
            const key = BLEDevice.getSubscriptionKey(sId, cId);
            const subscriptions = this.subscriptions.get(key);
            if (subscriptions.subscribed) {
                subscriptions.subscribed = false;
                const char = this.getCharacteristic(sId, cId);
                return BLEDevice.unsubscribe(char);
            }
            return Promise.resolve();
        }
        write(sId, cId, value) {
            const char = this.getCharacteristic(sId, cId);
            return new Promise((resolve, reject) => {
                const withoutResponse = char.properties.indexOf('writeWithoutResponse') === -1;
                char.write(Buffer.from(value), withoutResponse, (err, response) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(response);
                });
            });
        }
        read(sId, cId) {
            const char = this.getCharacteristic(sId, cId);
            return new Promise((resolve, reject) => {
                char.read((err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(data);
                });
            });
        }
        static connectToPeripheral(peripheral) {
            if (peripheral.state === 'connected') {
                return Promise.resolve();
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
        static updateRssi(peripheral) {
            return new Promise((resolve, reject) => {
                peripheral.updateRssi((err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(result);
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
        static normalizeAddress(address) {
            return address.toLowerCase();
        }
    }
    return BLEDevice;
};

module.exports = BLEDeviceMixin;
