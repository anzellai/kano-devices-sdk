class SubscriptionsManager {
    constructor(opts = {}) {
        this.options = Object.assign({}, {
            subscribe() { return Promise.resolve(); },
            unsubscribe() { return Promise.resolve(); },
        }, opts);
        this.subscriptions = new Map();
        this.subscriptionsCallbacks = {};
    }

    static getSubscriptionKey(sId, cId) {
        return `${sId}:${cId}`;
    }

    clear() {
        this.subscriptions = new Map();
    }

    flagAsUnsubscribe() {
        this.subscriptions.forEach((sub) => {
            sub.subscribed = false;
        });
    }

    resubscribe() {
        this.subscriptions.forEach((entry) => {
            this.maybeSubscribe(entry.sId, entry.cId);
        });
    }

    subscribe(sId, cId, onValue) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, {
                subscribed: false,
                callbacks: [],
                sId,
                cId,
            });
        }
        const subscriptions = this.subscriptions.get(key);
        subscriptions.callbacks.push(onValue);
        return this.maybeSubscribe(sId, cId);
    }
    maybeSubscribe(sId, cId) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        const subscriptions = this.subscriptions.get(key);
        if (!subscriptions.subscribed) {
            subscriptions.subscribed = true;
            this.subscriptionsCallbacks[key] = (value) => {
                value = new Uint8Array(value);
                subscriptions.callbacks.forEach(callback => callback(value));
            };
            return this._subscribe(sId, cId, this.subscriptionsCallbacks[key]);
        }
        return Promise.resolve();
    }
    unsubscribe(sId, cId, onValue) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        if (!this.subscriptions.has(key)) {
            return Promise.resolve();
        }
        const subscriptions = this.subscriptions.get(key);
        const index = subscriptions.callbacks.indexOf(onValue);
        subscriptions.callbacks.splice(index, 1);
        return this.maybeUnsubscribe(sId, cId);
    }
    maybeUnsubscribe(sId, cId) {
        const key = SubscriptionsManager.getSubscriptionKey(sId, cId);
        const subscription = this.subscriptions.get(key);

        if (subscription.subscribed && subscription.callbacks.length <= 0) {
            subscription.subscribed = false;
            this._unsubscribe(sId, cId, this.subscriptionsCallbacks[key]);
        }
        return Promise.resolve();
    }
    _subscribe(sId, cId, callback) {
        return this.options.subscribe(sId, cId, callback);
    }
    _unsubscribe(sId, cId, callback) {
        return this.options.unsubscribe(sId, cId, callback);
    }
}

export default SubscriptionsManager;
