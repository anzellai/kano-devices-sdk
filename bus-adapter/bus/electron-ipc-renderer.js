
class ElectronIpcBusRenderer {
    constructor(ipc) {
        this.ipc = ipc;
        this.listeners = new Map();
    }
    emit(...args) {
        this.ipc.send(...args);
    }
    on(name, callback) {
        const cb = (sender, data) => {
            callback(data);
        };
        this.listeners.set(callback, cb);
        this.ipc.on(name, cb);
    }
    removeListener(name, callback) {
        const cb = this.listeners.get(callback);
        this.listeners.delete(callback);
        this.ipc.removeListener(cb);
    }
}

module.exports = ElectronIpcBusRenderer;
