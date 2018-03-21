import DeviceAdapter from './device-adapter.js';

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

export default WandAdapter;
