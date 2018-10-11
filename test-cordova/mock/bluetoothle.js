import { generateRandomName, generateAddress } from '../helpers.js';

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
    connect(resolve, reject, opts) {
        setTimeout(() => {
            resolve({
                status: 'connected'
            });
        }, 1000);
    }
    close(resolve, reject, opts) {
        let index = -1;
        this.emittedDevices.some((device, i) => {
            if (device.address == opts.address) {
                index = i;
                return true;
            }
            return false;
        });

        if (index >= 0) {
            this.emittedDevices.splice(index, 1);
        }

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