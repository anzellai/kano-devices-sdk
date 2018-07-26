import Wand from './wand.js';

const DEVICE_ADAPTERS = [Wand];

class BusAdapter {
    constructor(opts = {}) {
        this.Devices = opts.Devices;
        this.bus = opts.bus;

        this.setupDiscovery();
        this.setupRequests();
    }
    static buildResponse(message, value) {
        return {
            eventId: message.eventId,
            error: null,
            data: {
                deviceId: message.data.deviceId,
                value,
            },
        };
    }
    static buildEvent(deviceId, value) {
        return {
            eventId: 0,
            error: null,
            data: { deviceId, value },
        };
    }
    static getAdapterForDevice(device) {
        let adapter;
        for (let i = 0; i < DEVICE_ADAPTERS.length; i += 1) {
            adapter = DEVICE_ADAPTERS[i];
            if (adapter.test(device)) {
                break;
            }
        }
        if (!adapter) {
            throw new Error(`No adapter found for device '${device.type}'`);
        }
        return adapter;
    }
    reply(message, value = null) {
        this.bus.emit('response', BusAdapter.buildResponse(message, value));
    }
    setupDiscovery() {
        this.Devices.on('new-device', (device) => {
            const adapter = BusAdapter.getAdapterForDevice(device);
            adapter.onDiscover(device, this);
            this.bus.emit('device-available', {
                eventId: 0,
                error: null,
                data: adapter.getDeviceSetupInfo(device),
            });
        });
    }
    static getAdapter(device) {
        let adapter;
        for (let i = 0; i < DEVICE_ADAPTERS.length; i += 1) {
            adapter = DEVICE_ADAPTERS[i];
            if (adapter.test(device)) {
                return adapter;
            }
        }
        return null;
    }
    setupRequests() {
        this.bus.on('request-available-devices', (message) => {
            const devices = this.Devices.getAll();
            const devicesData = devices.map((device) => {
                const adapter = BusAdapter.getAdapter(device);
                if (!adapter) {
                    return null;
                }
                return adapter.getDeviceSetupInfo(device);
            }).filter(deviceData => deviceData);
            this.bus.emit('available-devices', {
                eventId: message.eventId,
                error: null,
                data: devicesData,
            });
        });
        this.bus.on('search-for-closest-device', (message) => {
            this.Devices.searchForClosestDevice(message.data.deviceType, message.data.timeout)
                .then((device) => {
                    const adapter = BusAdapter.getAdapterForDevice(device);
                    adapter.onDiscover(device, this);
                    this.bus.emit('search-for-closest-device-response', {
                        eventId: message.eventId,
                        error: null,
                        data: adapter.getDeviceSetupInfo(device),
                    });
                })
                .catch((e) => {
                    this.bus.emit('search-for-closest-device-response', {
                        eventId: message.eventId,
                        error: {
                            message: e.message,
                            stack: e.stack,
                            name: e.name,
                        },
                    });
                });
        });
        this.bus.on('search-for-device', (message) => {
            this.Devices.searchForDevice(message.data.prefix, message.data.timeout)
                .then((device) => {
                    const adapter = BusAdapter.getAdapterForDevice(device);
                    adapter.onDiscover(device, this);
                    this.bus.emit('search-for-device-response', {
                        eventId: message.eventId,
                        error: null,
                        data: adapter.getDeviceSetupInfo(device),
                    });
                })
                .catch((e) => {
                    this.bus.emit('search-for-device-response', {
                        eventId: message.eventId,
                        error: {
                            message: e.message,
                            stack: e.stack,
                            name: e.name,
                        },
                    });
                });
        });
        this.bus.on('request', (message) => {
            const device = this.Devices.getById(message.data.deviceId);
            if (!device) {
                throw new Error(`Could not find device with id '${message.data.deviceId}'`);
            }
            let responsePromise;
            for (let i = 0; i < DEVICE_ADAPTERS.length; i += 1) {
                responsePromise = DEVICE_ADAPTERS[i].onRequest(message, device);
                if (responsePromise instanceof Promise) {
                    break;
                }
            }
            responsePromise.then(value => this.reply(message, value));
        });
    }
}


export default BusAdapter;
