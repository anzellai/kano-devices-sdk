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

        Bluetooth.on('pause', this.onPause.bind(this));
    }
    onPause() {
        this.stopScan();
    }
    setLogger(logger) {
        this.log = logger;
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
                    this.stopScan();
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
                .catch(e => console.log('Unable to start scanning ', e));
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
            this.stopScan()
                .then(() => search.resolve(device))
                .catch(e => search.reject(e));
        });
        return matched;
    }
    getDevices(searchFunction) {
        const returnDevices = [];
        this.devices.forEach((device) => {
            if (searchFunction(device)) {
                this.log.trace(`Discovered device: ${device.name} -> Did match`);
                returnDevices.push(device);
            } else {
                this.log.trace(`Discovered device: ${device.name} -> Not a candidate for this search`);
            }
        });
        return returnDevices;
    }
    searchForClosestDevice(testFunc, timeout = 3000) {
        return new Promise((resolve, reject) => {
            this.startScan()
                .then(() => {
                    setTimeout(() => {
                        if (Bluetooth.getState() == 'paused') {
                            return reject(new Error('The device was paused.'));
                        }
                        let closestDevice;
                        this.log.trace('Finding closest device amongst results...');
                        this.getDevices(testFunc)
                            .forEach((device) => {
                                closestDevice = closestDevice || device;
                                this.log.trace(`RSSI Sort: ${device.name} => ${device.rssi}`);
                                if (!closestDevice || (closestDevice.rssi < device.rssi)) {
                                    closestDevice = device;
                                }
                            });
                        if (!closestDevice) {
                            return reject(new Error(`No devices have been found after ${timeout}ms.`));
                        }
                        this.stopScan();
                        return resolve(closestDevice);
                    }, timeout);
                })
                .catch((e) => {
                    this.stopScan();
                    reject(e);
                });
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
                this.scanResultCallback = (device) => {
                    // Update the watcher devices list
                    const auxDevice = this.devices.get(device.address);
                    if (!auxDevice) {
                        this.devices.set(device.address, device);
                    } else {
                        Object.assign(auxDevice, device);
                    }

                    this.searches.forEach((search, index) => {
                        const isMatch = search.test(device);
                        if (!isMatch) {
                            this.log.trace(`Discovered device: ${device.name} -> Not a candidate for this search`);
                            return;
                        }
                        this.log.trace(`Discovered device: ${device.name} -> Did match`);
                        clearTimeout(search.to);
                        this.searches.splice(index, 1);
                        this.stopScan()
                            .then(() => {
                                search.resolve(this.devices.get(device.address));
                            })
                            .catch(search.reject);
                    });
                };
                Bluetooth.on('scan-result', this.scanResultCallback);
            });
    }
    stopScan() {
        if (!this.isScanning) {
            return Promise.resolve();
        }
        return Bluetooth.stopScan()
            .then(() => {
                if (this.scanResultCallback) {
                    Bluetooth.removeListener('scan-result', this.scanResultCallback);
                }

                this.isScanning = false;

                // Remove all the search queries.
                while (this.searches.length) {
                    clearTimeout(this.searches[0].to);
                    this.searches[0].reject(new Error('The device stopped scanning.'));
                    this.searches.splice(0, 1);
                }
            });
    }
    deleteCachedDevice(deviceAddress) {
        this.devices.delete(deviceAddress);
        Bluetooth.deleteCachedDevice(deviceAddress);
    }
}

export default BLEWatcher;
