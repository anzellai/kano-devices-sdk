'use strict';

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

const DEVICE_TYPE = 'wand';
const DEVICE_PREFIX = 'harry-potter-wand';

class WandAdapter extends DeviceAdapter {
    static getDeviceSetupInfo(device) {
        const deviceData = device.toJSON();
        return {
            deviceId: deviceData.id,
            deviceType: DEVICE_PREFIX,
            availableChannels: [{
                channel: 'ble',
                address: deviceData.address.toString(),
                status: 'connected',
            }],
            activeChannel: 'ble',
        };
    }

    static onDiscover(device, adapter) {
        const deviceData = device.toJSON();
        device.on('position', (position) => {
            adapter.bus.emit(
                `${DEVICE_PREFIX}-position`,
                adapter.constructor.buildEvent(deviceData.id, position),
            );
        });
        device.on('user-button', (value) => {
            adapter.bus.emit(
                `${DEVICE_PREFIX}-user-button`,
                adapter.constructor.buildEvent(deviceData.id, Boolean(value)),
            );
        });
        device.on('battery-status', (value) => {
            adapter.bus.emit(
                `${DEVICE_PREFIX}-battery-status`,
                adapter.constructor.buildEvent(deviceData.id, value),
            );
        });
    }

    static onRequest(message, device) {
        switch (message.data.name) {
        case 'organisation': {
            return device.getOrganisation();
        }
        case 'software-version': {
            return device.getSoftwareVersion();
        }
        case 'hardware-build': {
            return device.getHardwareBuild();
        }
        case 'battery-status': {
            return device.getBatteryStatus();
        }
        case 'subscribe-battery-status': {
            return device.subscribeBatteryStatus();
        }
        case 'unsubscribe-battery-status': {
            return device.unsubscribeBatteryStatus();
        }
        case 'vibrate': {
            return device.vibrate(message.data.detail);
        }
        case 'led-status': {
            return device.getLedStatus();
        }
        case 'led': {
            return device.setLed(
                message.data.detail.pattern,
                message.data.detail.value,
            );
        }
        case 'reset-pairing': {
            return device.resetPairing();
        }
        case 'subscribe-button': {
            return device.subscribeButton();
        }
        case 'subscribe-sleep': {
            return device.subscribeSleep();
        }
        case 'keep-alive': {
            return device.keepAlive();
        }
        case 'subscribe-position': {
            return device.subscribeEuler();
        }
        case 'unsubscribe-position': {
            return device.unsubscribeEuler();
        }
        case 'calibrate-gyroscope': {
            return device.calibrateGyroscope();
        }
        case 'calibrate-magnetometer': {
            return device.calibrateMagnetometer();
        }
        default: {
            return null;
        }
        }
    }

    static test(device) {
        return device.type === DEVICE_TYPE;
    }
}

const DEVICE_ADAPTERS = [WandAdapter];


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
    reply(message, value = null) {
        this.bus.emit('response', BusAdapter.buildResponse(message, value));
    }
    setupDiscovery() {
        this.Devices.on('new-device', (device) => {
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
            adapter.onDiscover(device);
            this.bus.emit('device-available', {
                eventId: 0,
                error: null,
                data: adapter.getDeviceSetupInfo(device),
            });
        });
    }
    setupRequests() {
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

module.exports = BusAdapter;
