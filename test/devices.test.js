const mock = require('mock-require');
const MockNoble = require('./mock/noble');
const chaiAsPromised = require('chai-as-promised');

let noble = new MockNoble();

let chai = require('chai').use(chaiAsPromised);
let assert = chai.assert;

mock('noble', noble);
mock('noble-uwp', noble);

const Devices = require('../platforms/nodejs');

describe('Search for devices', () => {
    it('searchForDevice(): returned a device', () => {
        return assert.isFulfilled(new Promise((resolve, reject) => {
            let devicePrefix = 'Kano-Wand'; // add more devices if needed.
            Devices.searchForDevice(devicePrefix, 3000)
                .then(device => {
                    if (device.device.advertisement.localName.startsWith(devicePrefix)) {
                        resolve();
                    }
                    reject();
                })
                .catch(reject);
        }));
    });
    it('searchForClosestDevice(): returned the closest device', () => {
        return assert.isFulfilled(new Promise((resolve, reject) => {
            Devices.searchForClosestDevice('wand')
                .then(device => {
                    // Check if there's any device closer than the one returned.
                    noble.emittedDevices.forEach(dev => {
                        if (Devices.getDeviceID(dev.name) == device.type && dev.rssi > device.rssi) {
                            reject(new Error('Found a closer device.'));
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
