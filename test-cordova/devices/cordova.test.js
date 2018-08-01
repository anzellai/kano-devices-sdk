import {CordovaSetup, CordovaTeardown, TriggerResume, TriggerPause} from '../mock/cordova.js';

import { setup, test, assert, suite, teardown } from '../tools.js';
import Manager from '../../../platforms/cordova/index.js';


suite('#Cordova', () => {
    setup(() => {
        CordovaSetup();
    });
    test('pause event', () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                TriggerPause();
            }, parseInt(Math.random() * 1000));

            Manager.searchForClosestDevice('wand')
                .then(device => {
                    reject(new Error('A device was returned after pause was triggered.'));
                })
                .catch(e => {
                    // We expect an error after the pause was triggered.
                    resolve();
                });
        });
    });
    teardown(() => {
        Manager.terminate();
        CordovaTeardown();
    });
});
