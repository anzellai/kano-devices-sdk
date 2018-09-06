const Devices = require('../platforms/nodejs');

const logger = {};

['trace', 'debug', 'info', 'warn', 'error', 'log'].forEach((name) => {
    logger[name] = (...args) => console.log(...args);
});

Devices.setLogger(logger);

// Devices.searchForDevice('Kano-Wand-fe')
Devices.searchForClosestDevice('wand')
    .then((device) => console.log("Closest device:", device))
    .catch((e) => console.log("Unable to get the closest device, err: ", e));

process.on('exit', () => {
    Devices.terminate();
});
