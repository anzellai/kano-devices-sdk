const NobleWatcherBase = require('./noble-watcher-base');
const noble = require('noble-uwp');

class NobleUWPWatcher extends NobleWatcherBase {
    constructor() {
        super(noble);
    }
}

module.exports = NobleUWPWatcher;
