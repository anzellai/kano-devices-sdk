let chai = require('chai');
let assert = chai.assert;

const Devices = require('../platforms/nodejs');

describe('Search for devices', () => {
    it('setLogger updates the Devices logger', () => {
        Devices.setLogger({
            info(msg) {
                assert(msg === 'test');
            }
        });

        Devices.log.info('test');
    });
});

process.on('exit', () => {
    Devices.terminate();
});
