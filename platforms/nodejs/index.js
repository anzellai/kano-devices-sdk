const Watcher = require('./lib/ble-watcher');
const BLEDeviceMixin = require('./lib/ble-device-mixin');
const { Devices } = require('../../index.js');
const JSZip = require('jszip');

const DevicesManager = new Devices({
    bluetooth: {
        watcher: new Watcher(),
        deviceMixin: BLEDeviceMixin,
        extractor: JSZip,
    },
});

module.exports = DevicesManager;
