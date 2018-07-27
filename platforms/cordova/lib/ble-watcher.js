import Bluetooth from './bluetooth.js';

Bluetooth.updateAdapter();
const onDeviceReady = () => {
    Bluetooth.updateAdapter();
};
document.addEventListener('deviceready', onDeviceReady, false);

class BLEWatcher {
    constructor() {
        this.searches = [];
        this.devices = new Map();
        this.isScanning = false;
    }
    searchForDevice(testFunc, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const searchIndex = this.searches.length;
            const search = {
                test: testFunc,
                resolve,
                reject,
                to: setTimeout(() => {
                    this.searches.splice(searchIndex, 1);
                    this.maybeStopScan();
                    reject(new Error(`Could not find device after ${timeout}ms`));
                }, timeout),
            };
            // See if the device was found before
            const found = this.matchDevices(search);
            if (found) {
                return;
            }
            // It wasn't found, add it to the searches and start scanning if it is the first search
            this.startScan()
                .catch(e => console.log("Unable to start scanning ", e));
            this.searches.push(search);
        });
    }
    matchDevices(search) {
        let matched = false;
        // Try to find a matching known device
        this.devices.forEach((device) => {
            const isMatch = search.test(device);
            if (!isMatch) {
                return;
            }
            matched = true;
            clearTimeout(search.to);
            this.maybeStopScan()
                .then(() => search.resolve(device))
                .catch(e => search.reject(e));
        });
        return matched;
    }
    getDevices(searchFunction) {
        const returnDevices = [];
        this.devices.forEach(device => {
            if (searchFunction(device)) {
                returnDevices.push(device);
            }
        });
        return returnDevices;
    }
    searchForClosestDevice(testFunc, timeout=3000) {
        return new Promise((resolve, reject) => {
            this.startScan()
                .then(() => {
                    setTimeout(() => {
                        let closestDevice = undefined;
                        this.getDevices(testFunc)
                            .forEach(device => {
                                closestDevice = closestDevice || device;
                                if (!closestDevice || (closestDevice.rssi < device.rssi)) {
                                    closestDevice = device;
                                }
                            });
                        if (!closestDevice) {
                            return reject(new Error(`No devices have been found after ${timeout}ms.`));
                        }
                        return resolve(closestDevice);
                    }, timeout);
                })
                .catch(reject);
        });
    }
    startScan() {
        if (this.isScanning) {
            return Promise.resolve();
        }
        return Bluetooth.setup({ request: true })
            .then(() => Bluetooth.startScan())
            .then(() => {
                this.isScanning = true;
                Bluetooth.on('scan-result', (device) => {
                    // Update the watcher devices list
                    let auxDevice = this.devices.get(device.address);
                    if (!auxDevice) {
                        this.devices.set(device.address, device);
                    } else {
                        Object.assign(auxDevice, device);
                    }

                    // If there's anyone looking for this device, resolve
                    this.searches.forEach((search, index) => {
                        const isMatch = search.test(device);
                        if (!isMatch) {
                            return;
                        }
                        clearTimeout(search.to);
                        this.searches.splice(index, 1);
                        search.resolve(this.devices.get(device.address));
                    });
                });
            });
    }
    stopScan() {
        if (!this.isScanning) {
            return Promise.resolve();
        }
        return Bluetooth.stopScan()
            .then(() => this.isScanning = false);
    }
}

export default BLEWatcher;
