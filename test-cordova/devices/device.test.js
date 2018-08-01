import {CordovaSetup, CordovaTeardown} from '../mock/cordova.js';

import { setup, test, assert, suite, teardown } from '../tools.js';
import Manager from '../../../platforms/cordova/index.js';

suite('Device', () => {
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
        teardown(() => {
            Manager.terminate();
            CordovaTeardown();
        });
    });
});
