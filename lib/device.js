import { EventEmitter } from './event-emitter.js';

let counter = 0;

class Device extends EventEmitter {
    constructor(manager, abstract = false) {
        super();
        this.manager = manager;
        this.abstract = abstract;
        this.type = 'device';
        // Abstract devices don't have an id, or increement the counter
        if (this.abstract) {
            return;
        }
        this.id = counter.toString();
        counter += 1;
    }
    terminate() {
        this.manager.removeDevice(this);
        return Promise.resolve(this.id);
    }
}

export default Device;
