import { subscribe } from '@kano/common/index.js';
import SubscriptionsManager from '../../../lib/subscriptions-manager.js';

const RECONNECT_SCAN_TIMEOUT = 30000;

const STATES = Object.freeze({
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    RECONNECTING: 'reconnecting',
});

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
            this.subManager = new SubscriptionsManager({
                subscribe: this._subscribe.bind(this),
                unsubscribe: this._unsubscribe.bind(this),
            });
            this.watcher = this.manager.watcher;
            this.reset(device);
        }
        reset(device, keepState = false) {
            this.device = device;
            this._setupPromise = null;
            if (this._disconnectSub) {
                this._disconnectSub.dispose();
            }
            this._disconnectSub = subscribe(
                this.device,
                'disconnect',
                this.onDisconnect.bind(this),
            );
            if (!keepState) {
                this.state = STATES.DISCONNECTED;
            }
        }
        setState(state) {
            const oldState = this.state;
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Updating state from ${oldState} to ${state}`);
            this.state = state;
            if (oldState !== state) {
                switch (state) {
                case STATES.CONNECTED: {
                    this.emit('connect');
                    break;
                }
                case STATES.DISCONNECTED: {
                    this.emit('disconnect');
                    break;
                }
                case STATES.CONNECTING: {
                    this.emit('connecting');
                    break;
                }
                case STATES.RECONNECTING: {
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
            if (this.state === STATES.DISCONNECTED
                || this.state === STATES.CONNECTING
                || this.state === STATES.RECONNECTING) {
                return;
            }
            // Flag all subscriptions as not subscribed
            this.subManager.flagAsUnsubscribe();
            if (!this._manuallyDisconnected) {
                this.reconnect();
            } else {
                this.setState(STATES.DISCONNECTED);
            }
        }
        onManualDisconnect() {
            this.subManager.clear();
        }
        setup() {
            if (this.state === STATES.RECONNECTING) {
                return Promise.reject(new Error('Cannot setup device while reconnecting'));
            }
            if (!this._setupPromise) {
                this._setupPromise = this.connect()
                    .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
                    .then(() => this.discover())
                    .then(() => {
                        this.setState(STATES.CONNECTED);
                    });
            }
            return this._setupPromise;
        }
        connect(timeout = 5000) {
            if (this.state === STATES.CONNECTED) {
                return Promise.resolve();
            }
            this.setState(STATES.CONNECTING);
            return new Promise((resolve, reject) => {
                if (!this.previouslyConnected) {
                    this.device.connect(timeout)
                        .then(data => {
                            this.previouslyConnected = true;
                            this.setState(STATES.CONNECTED);
                            resolve(data);
                        }, err => {
                            this.setState(STATES.DISCONNECTED);
                            reject(err);
                        });
                } else {
                    this.device.reconnect(timeout)
                        .then(data => {
                            this.previouslyConnected = true;
                            this.setState(STATES.CONNECTED);
                            resolve(data);
                        }, err => {
                            this.setState(STATES.DISCONNECTED);
                            reject(err);
                        });
                }
            });
        }
        reconnect() {
            this.setState(STATES.RECONNECTING);
            const testFunc = p => BLEDevice.normalizeAddress(p.address) === this.device.address;
            // Was connected before, so address should be available on apple devices
            return this.watcher.searchForDevice(testFunc, RECONNECT_SCAN_TIMEOUT)
                .then((device) => {
                    // Reset this device with the device found through scan
                    this.reset(device, true);
                    // Custom setup method after a reconnect. Avoids the `connecting` state
                    this._setupPromise = this.device.connect()
                        .then(() => this.discover())
                        .then(() => {
                            // Resubsribe to the characteristics if needed
                            this.subManager.resubscribe();
                            this.setState(STATES.CONNECTED);
                        });
                    return this._setupPromise;
                })
                .catch((e) => {
                    this.setState(STATES.DISCONNECTED);
                    throw e;
                });
        }
        discover() {
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Discovering all services and characteristics...`);
            return this.device.discover();
        }
        disconnect() {
            this._manuallyDisconnected = true;
            return this.device.disconnect()
                .then(() => this.setState(STATES.DISCONNECTED))
                .then(() => this.onManualDisconnect());
        }
        write(sId, cId, value) {
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Write: ${sId}:${cId} => ${value}`);
            return this.setup().then(() => {
                const char = this.getCharacteristic(sId, cId);
                return char.write(value);
            });
        }
        read(sId, cId) {
            this.manager.log.trace(`[${this.getAdvertisementName()}]: Read: ${sId}:${cId}`);
            return this.setup().then(() => {
                const char = this.getCharacteristic(sId, cId);
                return char.read();
            });
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
            return char.subscribe(callback);
        }
        _unsubscribe(sId, cId) {
            const char = this.getCharacteristic(sId, cId);
            return char.unsubscribe();
        }
        getCharacteristic(sId, cId) {
            const service = this.device.services.get(sId);
            return service.characteristics.get(cId);
        }
        getAdvertisementName() {
            return this.device.name;
        }
        toJSON() {
            return {
                id: this.id,
                address: this.device.address,
                bluetooth: {
                    name: this.device.name,
                    address: this.device.address,
                    state: this.state,
                },
            };
        }
        dispose() {
            return Promise.resolve()
                .then(() => {
                    if (this.state !== STATES.DISCONNECTED) {
                        return this.disconnect();
                    }
                })
                .then(() => {
                    if (this.previouslyConnected) {
                        return this.device.close();
                    }
                })
                .then(() => {
                    this.watcher.deleteCachedDevice(this.device.address);
                    this.device.removeAllListeners();
                    this.manager.removeDevice(this);
                    return Promise.resolve();
                });
        }
        terminate() {
            return super.terminate()
                .then(() => {
                    this.device.removeAllListeners();
                    return this.disconnect();
                });
        }

        static localUuid(uuid) {
            return uuid.toUpperCase();
        }

        static normalizeAddress(address) {
            return address.toUpperCase();
        }
        static uInt8ArrayToString(array) {
            return new TextDecoder('utf-8').decode(array);
        }
    }
    return BLEDevice;
};

export default BLEDeviceMixin;
