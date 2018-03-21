

class DeviceAdapter {
    constructor(busAdapter) {
        this.busAdapter = busAdapter;
    }

    setupDevice(device) {
        this.device = device;
    }

    /* eslint class-methods-use-this: "warn" */
    onRequest(message) {
        throw new Error(`Adapter doesn't implement request ${message.data.name}`);
    }

    static test() {
        return false;
    }
}


export default DeviceAdapter;
