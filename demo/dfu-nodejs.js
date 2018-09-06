const Devices = require('../platforms/nodejs');
const fs = require('fs');

Devices.searchForDevice('Kano-Wand-75')
    .then((device) => {
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

process.on('exit', () => {
    Devices.terminate();
});
