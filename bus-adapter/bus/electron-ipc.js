class ElectronIpcBus {
    constructor(ipc, window) {
        this.ipc = ipc;
        this.window = window;
        this.window.on('close', () => {
            this.closed = true;
        });
        this.listeners = new Map();
    }
    emit(name, data) {
        if (this.closed || !this.window || !this.window.webContents) {
            return;
        }
        this.window.webContents.send(name, data);
    }
    on(name, callback) {
        const cb = (event, message) => {
            if (event.sender === this.window.webContents) {
                callback(message);
            }
        }
        this.listeners.set(callback, cb);
        this.ipc.on(name, cb);
    }
    removeListener(name, callback) {
        const cb = this.listeners.get(callback);
        this.listeners.delete(callback);
        this.ipc.removeListener(name, cb);
    }
}

module.exports = ElectronIpcBus;
