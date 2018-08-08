import {CordovaSetup, CordovaTeardown} from '../mock/cordova.js';

import { setup, test, assert, suite, teardown } from '../tools.js';
import Manager from '../../../platforms/cordova/index.js';

suite('#Device', () => {
    setup(() => {
        CordovaSetup();
    });
    test('dispose()', () => {
        return new Promise((resolve, reject) => {
            Manager.searchForClosestDevice('wand', 1000)
                .then(device => {
                    device.dispose()
                        .then(() => {
                            if (Manager.devices.has(device.id)) {
                                reject();
                            }
                        });
                    resolve();
                })
                .catch(reject);
        });
    });
    test('connect(): should reject if it takes too long to connect.', () => {
        return new Promise((resolve, reject) => {
            Manager.searchForDevice('Kano-Wand-')
                .then(device => {
                    device.connect(0)
                        .then(() => {
                            reject(new Error('Connected too fast.'));   
                        })
                        .catch(resolve);
                })
                .catch(e => {
                    reject(new Error('Unable to find a device', e));
                });
        });
    });
    teardown(() => {
        Manager.terminate();
        CordovaTeardown();
    });
});
