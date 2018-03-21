
class ElectronIpcBusRenderer {
    constructor(ipc) {
        this.ipc = ipc;
    }
    emit(...args) {
        this.ipc.send(...args);
    }
    on(name, callback) {
        this.ipc.on(name, (sender, data) => {
            callback(data);
        });
    }
}

module.exports = ElectronIpcBusRenderer;
