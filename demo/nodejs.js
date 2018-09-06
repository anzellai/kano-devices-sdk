const Devices = require('../platforms/nodejs');

Devices.searchForDevice('Kano-Wand-75')
    .then((device) => {
        console.log('Found device');
        if (device.type === 'wand') {
            device.on('user-button', value => console.log(value));
            device.on('position', value => console.log(value));
            device.subscribeButton()
                .then(() => device.subscribePosition())
                .catch(e => console.log(e.stack || e));
        }
    });

process.on('exit', () => {
    Devices.terminate();
});

process.on('SIGINT', () => {
    Devices.terminate();
});
