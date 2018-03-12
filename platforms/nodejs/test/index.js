const Devices = require('../');

Devices.on('new-device', (device) => {
    console.log(device);
});

Devices.startBluetoothScan();
console.log('started scanning');
