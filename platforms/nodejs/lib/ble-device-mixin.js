const Watcher = require('./ble-watcher');
const { SubscriptionsManager } = require('../../../');

const RECONNECT_SCAN_TIMEOUT = 30000;

const BLEDeviceMixin = (Device) => {
    class BLEDevice extends Device {
        constructor(device, ...args) {
            super(...args);
            this.type = 'ble-device';
            this.device = device;
            // An abstract device will not need connection or watcher
            if (this.abstract) {
                return;
            }
            this.onDisconnect = this.onDisconnect.bind(this);
            this.watcher = new Watcher();
            // Subscriptions persist accross device handle switch
            this.subManager = new SubscriptionsManager({
                subscribe: this._subscribe.bind(this),
                unsubscribe: this._unsubscribe.bind(this),
            });
            // Reset providing the device handle found
            this.reset(device);
            
            this.device.on('disconnect', this.onDisconnect);
        }
        reset(device, keepState = false) {
            this.device = device;
            this.serviceCache = new Map();
            this.charCache = new Map();
            this._setupPromise = null;
            if (!keepState) {
                this.state = 'disconnected';
            }
        }
        setState(state) {
            const oldState = this.state;
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Updating state from ${oldState} to ${state}`);
            this.state = state;
            if (oldState !== state) {
                switch (state) {
                case 'connected': {
                    this.emit('connect');
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
        }
        onDisconnect() {
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Disconnect event received`);
            if (this.state === 'disconnected' || this.state === 'connecting') {
                return;
            }
            // Flag all subscriptions as not subscribed
            this.subManager.flagAsUnsubscribe();
            // Clean the services/characteristics map
            this.serviceCache = new Map();
            this.charCache = new Map();
            this.watcher.uncacheDevice(this.device.address);
            if (!this._manuallyDisconnected) {
                this.reconnect();
            } else {
                this.setState('disconnected');
            }
        }
        onManualDisconnect() {
            this.serviceCache = new Map();
            this.charCache = new Map();
            this.subManager.clear();
        }
        setup() {
            if (this.state === 'reconnecting') {
                return Promise.reject(new Error('Cannot setup device while reconnecting'));
            }
            if (!this._setupPromise) {
                this._setupPromise = this.connect()
                    .then(() => this.discover())
                    .then(() => {
                        this.setState('connected');
                    });
            }
            return this._setupPromise;
        }
        connect(timeout=5000) {
            if (this.state === 'connected') {
                return Promise.resolve();
            }
            this.setState('connecting');
            return BLEDevice.connectToPeripheral(this.device, timeout);
        }
        disconnect() {
            this._manuallyDisconnected = true;

            if (this.state == 'disconnected') {
                return Promise.resolve();
            }

            return BLEDevice.disconnectFromPeripheral(this.device)
                .then(() => this.onManualDisconnect());
        }
        reconnect() {
            this.setState('reconnecting');
            const testFunc = p => BLEDevice.normalizeAddress(p.address) === this.device.address;
            // Was connected before, so address should be available on apple devices
            return this.watcher.searchForDevice(testFunc, RECONNECT_SCAN_TIMEOUT)
                .then((device) => {
                    // Reset this device with the device found through scan
                    this.reset(device, true);
                    // Custom setup method after a reconnect. Avoids the `connecting` state
                    this._setupPromise = BLEDevice.connectToPeripheral(this.device)
                        .then(() => this.discover())
                        .then(() => {
                            // Resubsribe to the characteristics if needed
                            this.subManager.resubscribe();
                            this.setState('connected');
                        });
                    return this._setupPromise;
                })
                .catch(() => {
                    this.setState('disconnected');
                });
        }
        discover() {
            this.serviceCache = new Map();
            this.charCache = new Map();
            return new Promise((resolve, reject) => {
                this.manager.log.trace(`[${this.getAdvertisementName()}]: Discovering all services and characteristics...`);
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
        subscribe(sId, cId, onValue) {
            return this.setup()
                .then(() => this.subManager.subscribe(sId, cId, onValue));
        }
        unsubscribe(sId, cId, onValue) {
            return this.setup()
                .then(() => this.subManager.unsubscribe(sId, cId, onValue));
        }
        _subscribe(sId, cId, callback) {
            const char = this.getCharacteristic(sId, cId);
            return BLEDevice.subscribe(char, callback);
        }
        _unsubscribe(sId, cId, callback) {
            const char = this.getCharacteristic(sId, cId);
            return BLEDevice.unsubscribe(char, callback);
        }
        write(sId, cId, value) {
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Write: ${sId}:${cId} => ${value}`);
            return this.setup()
                .then(() => {
                    const char = this.getCharacteristic(sId, cId);
                    return BLEDevice.write(char, value);
                });
        }
        read(sId, cId) {
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Read: ${sId}:${cId}`);
            return this.setup().then(() => {
                const char = this.getCharacteristic(sId, cId);
                return BLEDevice.read(char);
            });
        }
        static write(char, value) {
            return new Promise((resolve, reject) => {
                const withoutResponse = char.properties.indexOf('writeWithoutResponse') !== -1;
                char.write(Buffer.from(value), withoutResponse, (err, response) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(new Uint8Array(response));
                });
            });
        }
        static read(char) {
            return new Promise((resolve, reject) => {
                char.read((err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(new Uint8Array(data));
                });
            });
        }
        static connectToPeripheral(peripheral, timeout = 5000) {
            if (peripheral.state === 'connected') {
                return Promise.resolve();
            }
            return new Promise((resolve, reject) => {
                let to = setTimeout(() => {
                    // Calling disconnect will cancel the connect try
                    peripheral.disconnect()
                        .catch(e => this.manager.log.trace(`Unable to disconnect ${e}`));
                    reject(new Error('Unable to connect in ${timeout}ms.'));
                }, timeout);
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
            return new Promise((resolve, reject) => {
                char.subscribe((err) => {
                    if (err) {
                        return reject(err);
                    }
                    char.on('data', valueCallback);
                    return resolve();
                });
            });
        }
        static unsubscribe(char, callback) {
            return new Promise((resolve, reject) => {
                char.unsubscribe((err) => {
                    if (err) {
                        return reject(err);
                    }
                    char.removeListener('data', callback);
                    return resolve();
                });
            });
        }
        getAdvertisementName() {
            return this.device.advertisement.localName;
        }
        toJSON() {
            return {
                id: this.id,
                address: this.device.address,
                bluetooth: {
                    name: this.device.advertisement.localName,
                    address: this.device.address,
                    state: this.state,
                },
            };
        }
        dispose() {
            return this.terminate()
                .then(() => {
                    return this.manager.removeDevice(this);
                });
        }
        terminate() {
            return super.terminate()
                .then(() => {
                    this.removeAllListeners();
                    return this.disconnect();
                });
        }
        static localUuid(uuid) {
            return uuid.replace(/-/g, '').toLowerCase();
        }
        static normalizeAddress(address) {
            return address.toLowerCase();
        }
        static uInt8ArrayToString(array) {
            return Buffer.from(array).toString();
        }
    }
    return BLEDevice;
};

module.exports = BLEDeviceMixin;
