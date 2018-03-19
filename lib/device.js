import { EventEmitter } from './event-emitter.js';

let counter = 0;

class Device extends EventEmitter {
    constructor(abstract = false) {
        super();
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
        return Promise.resolve(this.id);
    }
}

export default Device;
