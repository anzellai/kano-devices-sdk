import {generateRandomName, generateAddress} from '../helpers.js';

class BluetoothLE {
    constructor() {
        this.scanInterval = null;
        this._isScanning = false;
        this.emittedDevices = [];
    }
    initialize(done, options) {
        done({status: 'enabled'});
    }
    isScanning(resolve, reject) {
        resolve(this._isScanning);
    }
    startScan(callback) {
        this._isScanning = true;
        this.emittedDevices = [];
        callback({status: 'scanStarted'});
        this.scanInterval = setInterval(() => {
            let newDevice = {
                status: 'scanResult',
                address: generateAddress(),
                name: generateRandomName(),
                rssi: (-1 * parseInt(100 * Math.random()))
            };
            this.emittedDevices.push(newDevice);
            callback(newDevice);
        }, parseInt(200 * Math.random()));
    }
    stopScan(resolve, reject) {
        this._isScanning = false;
        clearInterval(this.scanInterval);
        resolve();
    }
    disconnect(resolve, reject, opts) {
        resolve();
    }
}

export const BluetoothLESetup = () => {
    window.bluetoothle = new BluetoothLE();
    document.dispatchEvent(new Event('deviceready'));
};

export const BluetoothLETeardown = () => {
    delete window.bluetoothle;
};