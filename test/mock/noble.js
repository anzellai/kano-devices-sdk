const { EventEmitter } = require('events');

let DeviceID = 0;

let devicesPrefixes = [
    generateWandName,
    generateWrongName
];

function generateWrongName() {
    return null;
}

function generateWandName() {
    return `Kano-Wand-${parseInt(100 * Math.random())}-${parseInt(100 * Math.random())}-${parseInt(100 * Math.random())}`;
}

class BLEDevice extends EventEmitter {
    constructor(name) {
        super();

        this.id = DeviceID++;
        this.advertisement = {
            localName: name,
            rssi: (-1 * parseInt(100 * Math.random()))
        };
    }
    disconnect() {
        return Promise.resolve();
    }
    connect(callback) {
        setTimeout(callback, 1000);
    }
}

class Noble extends EventEmitter {
	constructor(deviceClass) {
        super();

        this.emittedDevices = [];

        this.state = 'poweredOn';
        this.isScanning = false;
    }
    
    startScanning() {
        this.isScanning = true;
        this.scannerInterval = setInterval(() => {
            let nameGenerator = devicesPrefixes[parseInt(devicesPrefixes.length * Math.random())];

            this.emittedDevices.push(new BLEDevice(nameGenerator()));
            this.emit('discover', this.emittedDevices[this.emittedDevices.length - 1]);
        }, parseInt(200 * Math.random()));
    }

    stopScanning() {
        this.isScanning = false;
        clearInterval(this.scannerInterval);
    }
}

module.exports = Noble;