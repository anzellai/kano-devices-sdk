class ElectronIpcBus {
    constructor(ipc, window) {
        this.ipc = ipc;
        this.window = window;
    }
    emit(name, data) {
        if (!this.window || !this.window.webContents) {
            return;
        }
        this.window.webContents.send(name, data);
    }
    on(name, callback) {
        this.ipc.on(name, (event, message) => {
            if (event.sender === window.webContents) {
                callback(message);
            }
        });
    }
}

module.exports = ElectronIpcBus;
