const Devices = require('../platforms/nodejs');

function wait(n) {
    return new Promise(resolve => setTimeout(resolve, n));
}

function testButton(device) {
    return new Promise((resolve) => {
        let count = 0;
        device.on('user-button', () => {
            count += 1;
            if (count >= 2) {
                resolve();
            }
        });
        device.subscribeButton()
            .then(() => {
                console.log('Testing button, please press the button once');
            });
    });
}

Devices.searchForDevice('Kano-Wand-75')
    .then((device) => {
        console.log('Found device');
        if (device.type === 'wand') {
            device.on('f', () => {});
            device.getOrganisation()
                .then((n) => {
                    console.log(`Organisation: ${n}`);
                    return device.getHardwareBuild();
                })
                .then((n) => {
                    console.log(`Hardware build: ${n}`);
                    return device.getSoftwareVersion();
                })
                .then((n) => {
                    console.log(`Software version: ${n}`);
                    return device.getBatteryStatus();
                })
                .then((n) => {
                    console.log(`battery status: ${n}`);
                    return testButton(device);
                })
                .then(() => {
                    console.log('Button ok');
                    console.log('testing led, red');
                    return device.setLed(1, 0xff0000).then(() => wait(2000));
                })
                .then(() => {
                    console.log('testing led, green');
                    return device.setLed(1, 0x00ff00).then(() => wait(2000));
                })
                .then(() => {
                    console.log('testing led, blue');
                    return device.setLed(1, 0x0000ff).then(() => wait(2000));
                })
                .then(() => {
                    console.log('Led ok');
                    return device.setLed(0);
                })
                .then(() => {
                    console.log('testing vibration');
                    return device.vibrate(1).then(() => wait(2000));
                })
                .then(() => {
                    console.log('vibration ok');
                    return device.disconnect();
                })
                .catch(e => console.error(e));
        }
    });

process.on('exit', () => {
    Devices.terminate();
});

process.on('SIGINT', () => {
    Devices.terminate();
});
