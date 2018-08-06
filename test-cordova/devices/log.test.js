import { assert, test, suite, teardown } from '../tools.js';
import Manager from '../../../platforms/cordova/index.js';

suite('#Logger', () => {
    test('setLogger()', () => {
        Manager.setLogger({
            info(msg) {
                assert(msg === 'test');
            },
            trace() {}
        });

        Manager.log.info('test');
    });
    teardown(() => {
        Manager.terminate();
    });
});
