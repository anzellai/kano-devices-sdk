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
                `${DEVICE_PREFIX}-button`,
                adapter.constructor.buildEvent(deviceData.id, value),
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
            return device.subscribeBatteryStatus().then(() => null);
        }
        case 'unsubscribe-battery-status': {
            return device.unsubscribeBatteryStatus().then(() => null);
        }
        case 'vibrate': {
            return device.vibrate(message.data.detail).then(() => null);
        }
        case 'led-status': {
            return device.getLedStatus();
        }
        case 'led': {
            return device.setLed(
                message.data.detail.pattern,
                message.data.detail.value,
            ).then(() => null);
        }
        case 'reset-pairing': {
            return device.resetPairing().then(() => null);
        }
        case 'subscribe-button': {
            return device.subscribeButton().then(() => null);
        }
        case 'unsubscribe-button': {
            return device.unsubscribeButton().then(() => null);
        }
        case 'subscribe-sleep': {
            return device.subscribeSleep().then(() => null);
        }
        case 'unsubscribe-sleep': {
            return device.unsubscribeSleep().then(() => null);
        }
        case 'keep-alive': {
            return device.keepAlive().then(() => null);
        }
        case 'subscribe-position': {
            return device.subscribeEuler().then(() => null);
        }
        case 'unsubscribe-position': {
            return device.unsubscribeEuler().then(() => null);
        }
        case 'calibrate-gyroscope': {
            return device.calibrateGyroscope().then(() => null);
        }
        case 'calibrate-magnetometer': {
            return device.calibrateMagnetometer().then(() => null);
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
