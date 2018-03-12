const NobleWatcherBase = require('./noble-watcher-base');
const noble = require('noble');

class NobleWatcher extends NobleWatcherBase {
    constructor() {
        super(noble);
    }
}

module.exports = NobleWatcher;
