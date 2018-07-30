import '../mock/bluetoothle.js';
import '../mock/cordova.js';

import { setup, test, assert, suite, teardown } from '../tools.js';
import Manager from '../../../platforms/cordova/index.js';

suite('Device', () => {
    suite('#Device', () => {
        test('dispose()', () => {
            return new Promise((resolve, reject) => {
                Manager.searchForClosestDevice('wand')
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
        });
    });
});
