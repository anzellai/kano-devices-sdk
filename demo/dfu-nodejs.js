const Devices = require('../platforms/nodejs');
const fs = require('fs');

Devices.on('new-device', (device) => {
    console.log('Found device');
    if (device.type === 'wand') {
        const zipFile = fs.readFileSync(process.argv[2]);
        const fileBuffer = new Uint8Array(zipFile).buffer;
        device.on('update-progress', (transfer) => {
            console.log(`${transfer.type}: ${(transfer.currentBytes / transfer.totalBytes) * 100}%`);
        });
        Devices.updateDFUDevice(device, fileBuffer)
            .then(() => {
                console.log('UPDATE COMPLETE');
            })
            .catch(e => console.error(e));
    }
});

Devices.wandPrefix = 'Kano-Wand-75';

Devices.startBluetoothScan();
console.log('Scanning');


process.on('exit', () => {
    Devices.terminate();
});
