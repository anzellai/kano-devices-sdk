import Watcher from './lib/ble-watcher.js';
import BLEDeviceMixin from './lib/ble-device.js';
import Devices from '../../kano-devices-sdk.js';

const DevicesManager = new Devices({
    bluetooth: {
        watcher: new Watcher(),
        deviceMixin: BLEDeviceMixin,
    },
});

export default DevicesManager;
