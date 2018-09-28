const os = require('os');
const NobleWatcherBase = require('./noble-watcher-base');

let noble;

if (os.release() === '18.0.0') {    // macOS Mojave
    noble = require('noble-mac');
} else {
    noble = require('noble');
}

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
