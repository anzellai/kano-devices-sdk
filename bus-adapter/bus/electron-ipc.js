class ElectronIpcBus {
    constructor(ipc, window) {
        this.ipc = ipc;
        this.window = window;
        this.window.on('close', () => {
            this.closed = true;
        });
    }
    emit(name, data) {
        if (this.closed || !this.window || !this.window.webContents) {
            return;
        }
        this.window.webContents.send(name, data);
    }
    on(name, callback) {
        this.ipc.on(name, (event, message) => {
            if (event.sender === this.window.webContents) {
                callback(message);
            }
        });
    }
}

module.exports = ElectronIpcBus;
