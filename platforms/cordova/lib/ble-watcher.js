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
            this.maybeStartScan();
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
    maybeStartScan() {
        // Searches already in progress, don't start again
        if (this.searches.length > 0) {
            return;
        }
        Bluetooth.setup({ request: true })
            .then(() => Bluetooth.startScan())
            .then(() => {
                Bluetooth.on('scan-result', (device) => {
                    this.devices.set(device.address, device);
                    this.searches.forEach((search, index) => {
                        const isMatch = search.test(device);
                        if (!isMatch) {
                            return;
                        }
                        clearTimeout(search.to);
                        this.searches.splice(index, 1);
                        this.maybeStopScan()
                            .then(() => search.resolve(device))
                            .catch(e => search.reject(e));
                    });
                });
            });
    }
    maybeStopScan() {
        if (this.searches.length) {
            return Promise.resolve();
        }
        return Bluetooth.stopScan();
    }
}

export default BLEWatcher;
