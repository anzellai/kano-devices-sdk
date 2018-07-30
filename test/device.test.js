const mock = require('mock-require');
const MockNoble = require('./mock/noble');
const chaiAsPromised = require('chai-as-promised');

let noble = new MockNoble();

let chai = require('chai').use(chaiAsPromised);
let assert = chai.assert;

mock('noble', noble);
mock('noble-uwp', noble);

const Devices = require('../platforms/nodejs');

describe('Device', () => {
    it('dispose(): terminated the device and removed it', () => {
        return assert.isFulfilled(new Promise((resolve, reject) => {
            Devices.searchForClosestDevice('wand')
                .then(device => {
                    device.dispose()
                        .then(() => {
                            if (Devices.devices.has(device.id)) {
                                reject();
                            }
                        });
                    resolve();
                })
                .catch(reject);
        }));
    });
});

process.on('exit', () => {
    Devices.terminate();
});
