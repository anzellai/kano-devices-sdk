const Devices = require('../platforms/nodejs');

Devices.on('new-device', (device) => {
    console.log('Found device');
    if (device.type === 'wand') {
        device.on('user-button', value => console.log(value));
        device.on('position', value => console.log(value));
        device.subscribeButton()
            .then(() => device.subscribeEuler())
            .catch(e => console.log(e.stack || e));
    }
});

Devices.startBluetoothScan();
console.log('Scanning');


process.on('exit', () => {
    Devices.terminate();
});

process.on('SIGINT', () => {
    Devices.terminate();
});
