const NobleWatcherBase = require('./noble-watcher-base');
const noble = require('noble');

class NobleWatcher extends NobleWatcherBase {
    constructor() {
        super(noble);
    }
    onDiscovered(peripheral) {
        // Can't cache device per address. See: https://github.com/noble/noble/blob/master/README.md#peripheral-discovered
        // Will apply the test function on all advertisements
        this.emit('discover', peripheral);
    }
}

module.exports = NobleWatcher;
