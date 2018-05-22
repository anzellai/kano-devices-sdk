import { EventEmitter } from '../../../lib/event-emitter.js';

/* global cordova */

let BluetoothManager;

function pCall(name, opts) {
    return new Promise((resolve, reject) => BluetoothManager.adapter[name](resolve, reject, opts));
}

class Characteristic {
    constructor(result, service) {
        this.uuid = result.uuid;
        this.properties = result.properties;
        this.permissions = result.permissions;
        this.descriptors = result.descriptors;
        this.service = service;
        this.subscriptions = [];
    }
    subscribe(callback) {
        this.subscriptions.push(callback);
        if (this.subscriptions.length === 1) {
            return this._subscribe();
        }
        return Promise.resolve();
    }
    _subscribe() {
        return new Promise((resolve, reject) => BluetoothManager.adapter.subscribe(
            (result) => {
                if (result.status === 'subscribed') {
                    resolve();
                } else if (result.status === 'subscribedResult') {
                    this.subscriptions.forEach((callback) => {
                        callback(BluetoothManager.adapter.encodedStringToBytes(result.value));
                    });
                }
            },
            reject,
            {
                address: this.service.device.address,
                service: this.service.uuid,
                characteristic: this.uuid,
            },
        ));
    }
    unsubscribe(callback) {
        const index = this.subscriptions.indexOf(callback);
        this.subscriptions.splice(index, 1);
        if (this.subscriptions.length === 0) {
            return this._unsubscribe();
        }
        return Promise.resolve();
    }
    _unsubscribe() {
        return pCall('unsubscribe', {
            address: this.service.device.address,
            service: this.service.uuid,
            characteristic: this.uuid,
        });
    }
    static getResponseValue(response) {
        if (!response.value) {
            return null;
        }
        return BluetoothManager.adapter.encodedStringToBytes(response.value);
    }
    read() {
        return pCall('read', {
            address: this.service.device.address,
            service: this.service.uuid,
            characteristic: this.uuid,
        }).then(result => Characteristic.getResponseValue(result));
    }
    write(value) {
        const bytes = new Uint8Array(value);
        const type = this.properties.writeWithoutResponse ? 'noResponse' : 'write';
        return pCall('write', {
            address: this.service.device.address,
            service: this.service.uuid,
            characteristic: this.uuid,
            value: this.service.device.manager.adapter.bytesToEncodedString(bytes),
            type,
        }).then(result => Characteristic.getResponseValue(result));
    }
}

class Service {
    constructor(uuid, characteristics, device) {
        this.uuid = uuid;
        this.characteristics = new Map();
        characteristics.forEach(cData =>
            this.characteristics.set(cData.uuid, new Characteristic(cData, this)));
        this.device = device;
    }
}

class Device extends EventEmitter {
    constructor(result, manager) {
        super();
        this.address = result.address;
        this.name = result.name;
        this.rssi = result.rssi;
        this.services = new Map();
        this.manager = manager;
        this.discovered = false;
    }
    connect() {
        return this.isConnected()
            .then((isConnected) => {
                if (isConnected) {
                    return Promise.resolve();
                }
                return this._connect();
            });
    }
    _connect() {
        return new Promise((resolve, reject) => {
            BluetoothManager.adapter.connect((result) => {
                if (result.status === 'connected') {
                    resolve();
                } else if (result.status === 'disconnected') {
                    // Clear services cache on disconnect
                    this.services = new Map();
                    this.discovered = false;
                    this.close()
                        .then(() => {
                            this.emit('disconnect');
                        });
                }
            }, reject, { address: this.address });
        });
    }
    isConnected() {
        return pCall('isConnected', { address: this.address })
            .then(status => status.isConnected)
            .catch(() => false);
    }
    reconnect() {
        return pCall('reconnect', { address: this.address });
    }
    close() {
        return pCall('close', { address: this.address });
    }
    disconnect() {
        return pCall('disconnect', { address: this.address });
    }
    discover() {
        if (this.discovered) {
            return Promise.resolve(this.services);
        }
        this.discovered = true;
        return pCall('discover', { address: this.address, clearCache: true })
            .then((result) => {
                result.services.forEach(serviceData =>
                    this.services.set(serviceData.uuid, new Service(
                        serviceData.uuid,
                        serviceData.characteristics,
                        this,
                    )));
                return this.services;
            });
    }
}

class Bluetooth extends EventEmitter {
    constructor() {
        super();
        this.devices = new Map();
        this.adapter = window.bluetoothle;
    }
    updateAdapter() {
        this.adapter = window.bluetoothle;
    }
    initialize(options) {
        return new Promise(resolve => this.adapter.initialize(resolve, options));
    }
    setup() {
        return this.initialize({ request: true })
            .then((res) => {
                let p = Promise.resolve();
                if (res.status === 'disabled') {
                    p = this.enable();
                }
                return p.then(() => (
                    this.hasPermission().then((doesIt) => {
                        if (!doesIt.hasPermission) {
                            return this.requestPermission();
                        }
                        return null;
                    })
                ));
            });
    }
    isScanning() {
        return new Promise((resolve, reject) => this.adapter.isScanning(
            result => resolve(result.isScanning),
            reject,
        ));
    }
    startScan(options) {
        return this.isScanning().then((itIs) => {
            if (itIs) {
                return Promise.resolve();
            }
            return new Promise((resolve, reject) => {
                this.adapter.startScan((result) => {
                    if (result.status === 'scanStarted') {
                        resolve();
                    } else if (result.status === 'scanResult') {
                        const device = new Device(result, this);
                        this.devices.set(result.address, device);
                        this.emit('scan-result', device);
                    }
                }, reject, options);
            });
        });
    }
    stopScan() {
        return new Promise((resolve, reject) => this.adapter.stopScan(resolve, reject));
    }
    hasPermission() {
        if (cordova.platformId === 'ios') {
            return Promise.resolve({ hasPermission: true });
        }
        return new Promise(resolve => this.adapter.hasPermission(resolve));
    }
    requestPermission() {
        if (cordova.platformId === 'ios') {
            return Promise.resolve({ requestPermission: true });
        }
        return new Promise((resolve, reject) => this.adapter.requestPermission(resolve, reject));
    }
    enable() {
        if (cordova.platformId === 'ios') {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => this.adapter.enable(resolve, reject));
    }
    isLocationEnabled() {
        if (cordova.platformId === 'ios') {
            return Promise.resolve({ isLocationEnabled: true });
        }
        return new Promise((resolve, reject) => this.adapter.isLocationEnabled(resolve, reject));
    }
    requestLocation() {
        if (cordova.platformId === 'ios') {
            return Promise.resolve({ requestLocation: true });
        }
        return new Promise((resolve, reject) => this.adapter.requestLocation(resolve, reject));
    }
}

BluetoothManager = new Bluetooth();

const Exportable = BluetoothManager;

export default Exportable;
