import { CordovaSetup, CordovaTeardown, TriggerResume, TriggerPause } from '../mock/cordova.js';
import Manager from '../../../platforms/cordova/index.js';


suite('#Cordova', () => {
    setup(() => {
        CordovaSetup();
    });
    test('searches should be rejected when pause is triggered', () => {
        return new Promise((resolve, reject) => {
            let searches = [];
            for (let i = 0; i < 100; i++) {
                searches.push(Manager.searchForDevice(`Kano-Wand-bad-device`));
            }

            setTimeout(() => {
                TriggerPause();
                
                setTimeout(() => {
                    Promise.all(searches)
                        .then(() => reject(new Error('A device was returned after cordova was paused')))
                        .catch(resolve); // Expect all the promises to fail once cordova was paused.
                    TriggerResume();
                });
            });
        });
    });
    test('pause event', () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                TriggerPause();
            }, parseInt(Math.random() * 500));

            Manager.searchForClosestDevice('wand', 800)
                .then(device => {
                    TriggerResume();
                    reject(new Error('A device was returned after pause was triggered.'));
                })
                .catch(e => {
                    // We expect an error after the pause was triggered.
                    TriggerResume();
                    resolve();
                });
        });
    });
    teardown(() => {
        Manager.terminate();
        CordovaTeardown();
    });
});
