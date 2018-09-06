const Devices = require('../platforms/nodejs');

let intervalId;

Devices.searchForDevice('Kano-Wand-75')
    .then((device) => {
        console.log('Found device');
        if (device.type === 'wand') {
            device.on('disconnect', () => {
                console.log('device disconnected');
                clearInterval(intervalId);
            });
            device.on('connect', () => {
                console.log('connect event');
                device.subscribeButton()
                    .catch(e => console.error(e));
            });
            device.on('disconnect', () => {
                console.log('disconnect event');
            });
            device.on('connecting', () => {
                console.log('connecting event');
            });
            device.on('reconnect', () => {
                console.log('reconnect event');
            });
            device.on('reconnecting', () => {
                console.log('reconnecting event');
            });
            device.on('user-button', (value) => {
                console.log(value);
            });
            // Connects to the device and sets up its services and characteristics
            device.setup();
        }
    });

process.on('exit', () => {
    console.log('process exit');
    clearInterval(intervalId);
    Devices.terminate();
});

process.on('SIGINT', () => {
    clearInterval(intervalId);
    // Devices.terminate();
});
