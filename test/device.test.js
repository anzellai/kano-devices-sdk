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
    it('connect(): timeout should return after 1ms', () => {
        return assert.isFulfilled(new Promise((resolve, reject) => {
            Devices.searchForDevice('Kano-Wand-')
                .then(device => {
                    device.connect(1)
                        .then(() => {
                            reject(new Error('Connected too fast.'));
                        })
                        .catch(resolve);
                })
                .catch(reject);
        }));
    });
});

process.on('exit', () => {
    Devices.terminate();
});
