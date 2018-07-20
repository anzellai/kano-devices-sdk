/* eslint global-require: "warn" */
const os = require('os');
const { EventEmitter } = require('events');

let NobleWatcher;

if (os.platform() === 'win32') {
    NobleWatcher = require('./ble-watcher-uwp');
} else {
    NobleWatcher = require('./ble-watcher-noble');
}

class BLEWatcher extends EventEmitter {
    constructor() {
        super();
        this.watcher = new NobleWatcher();
    }

    /**
     * Starts scanning for bluetooth devices. Resolves when a device found matches the test function
     * Automatically stops scanning when found or when the provided timeout is reached.
     * @param {Function} testFunc A test function. Will  receive a noble peripheral. Must return
     *                            true or false.
     * @param {Number} timeout How long to scan for a device. Will reject the promise if none of the
     *                         devices found matches the search.
     */
    searchForDevice(testFunc, timeout = 10000) {
        return new Promise((resolve, reject) => {
            let to;
            const onDiscover = (peripheral) => {
                const isMatch = testFunc(peripheral);
                if (!isMatch) {
                    return;
                }
                clearTimeout(to);
                this.watcher.removeListener('discover', onDiscover);
                this.watcher.stop();
                resolve(peripheral);
            };
            to = setTimeout(() => {
                this.watcher.removeListener('discover', onDiscover);
                this.watcher.stop();
                reject(new Error(`Could not find device after ${timeout}ms`));
            }, timeout);
            this.watcher.on('discover', onDiscover);
            this.watcher.start();
        });
    }

    uncacheDevice(deviceAddress) {
        this.watcher.uncacheDevice(deviceAddress);
    }
}

module.exports = BLEWatcher;
