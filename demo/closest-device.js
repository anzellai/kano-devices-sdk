const Devices = require('../platforms/nodejs');

// Devices.searchForDevice('Kano-Wand-fe')
Devices.searchForClosestDevice('wand')
    .then(device => console.log("Closest device:", device))
    .catch(e => console.log("Unable to get the closest device, err: ", e));

process.on('exit', () => {
    Devices.terminate();
});
