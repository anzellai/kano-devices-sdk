const { EventEmitter } = require('events');

let instances = 0;

class NobleWatcherBase extends EventEmitter {
    constructor(adapter) {
        super();
        this.onDiscovered = this.onDiscovered.bind(this);
        this.started = false;
        this.cache = {};
        this.adapter = adapter;
    }

    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        this.adapter.on('discover', this.onDiscovered);
        this._waitForPoweredOn()
            .then(() => {
                if (!this.started) {
                    return;
                }
                this._startScanning();
            });
    }

    stop() {
        if (!this.started) {
            return;
        }
        this.started = false;
        this.adapter.removeListener('discover', this.onDiscovered);
        instances -= 1;
        if (!instances) {
            this.adapter.stopScanning();
            this.cache = {};
        }
    }

    _waitForPoweredOn() {
        if (this.adapter.state === 'poweredOn') {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const onStateChanged = (state) => {
                if (state === 'poweredOn') {
                    this.adapter.removeListener('stateChange', onStateChanged);
                    resolve();
                }
            };
            this.adapter.on('stateChange', onStateChanged);
        });
    }

    _startScanning() {
        this.adapter.startScanning();
        instances += 1;
    }

    onDiscovered(peripheral) {
        if (!this.cache[peripheral.address]) {
            this.emit('discover', peripheral);
        }
        this.cache[peripheral.address] = peripheral;
    }

    uncacheDevice(deviceAddress) {
        this.cache[deviceAddress] = null;
    }
}

module.exports = NobleWatcherBase;
