import SubscriptionsManager from '../../../lib/subscriptions-manager.js';

const BLEDeviceMixin = (Device) => {
    class BLEDevice extends Device {
        constructor(device) {
            super();
            this.type = 'ble-device';
            this.device = device;
            this._setupPromise = null;
            this.subManager = new SubscriptionsManager({
                subscribe: this._subscribe.bind(this),
                unsubscribe: this._unsubscribe.bind(this),
            });
            this.device.on('disconnect', () => {
                this._setupPromise = null;
                this.emit('disconnect');
            });
        }
        setup() {
            if (!this._setupPromise) {
                this._setupPromise = this.connect()
                    .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
                    .then(() => this.discover());
            }
            return this._setupPromise;
        }
        connect() {
            return this.device.connect();
        }
        discover() {
            return this.device.discover();
        }
        disconnect() {
            return this.device.disconnect();
        }
        write(sId, cId, value) {
            const char = this.getCharacteristic(sId, cId);
            return this.setup().then(() => char.write(value));
        }
        read(sId, cId) {
            const char = this.getCharacteristic(sId, cId);
            return this.setup().then(() => char.read());
        }
        subscribe(sId, cId, onValue) {
            return this.setup()
                .then(() => this.subManager.subscribe(sId, cId, onValue));
        }
        unsubscribe(sId, cId, onValue) {
            return this.setup()
                .then(() => this.subManager.unsubscribe(sId, cId, onValue));
        }
        _subscribe(sId, cId, callback) {
            const char = this.getCharacteristic(sId, cId);
            return char.subscribe(callback);
        }
        _unsubscribe(sId, cId) {
            const char = this.getCharacteristic(sId, cId);
            return char.unsubscribe();
        }
        getCharacteristic(sId, cId) {
            const service = this.device.services.get(sId);
            return service.characteristics.get(cId);
        }
        toJSON() {
            return {
                id: this.id,
                address: this.device.address,
                bluetooth: {
                    name: this.device.name,
                    address: this.device.address,
                    dfuName: 'DfuTarg',
                },
            };
        }
        terminate() {
            return this.disconnect();
        }

        static localUuid(uuid) {
            return uuid.toUpperCase();
        }

        static normalizeAddress(address) {
            return address.toUpperCase();
        }
    }
    return BLEDevice;
};

export default BLEDeviceMixin;
