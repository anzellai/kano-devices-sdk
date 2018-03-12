const Watcher = require('./lib/ble-watcher');
const BLEDeviceMixin = require('./lib/ble-device-mixin');
const Devices = require('../../index.js');

const DevicesManager = new Devices({
    bluetooth: {
        watcher: new Watcher(),
        deviceMixin: BLEDeviceMixin,
    },
});

module.exports = DevicesManager;
