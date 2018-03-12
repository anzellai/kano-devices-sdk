import { EventEmitter } from './event-emitter.js';

let counter = 0;

class Device extends EventEmitter {
    constructor() {
        super();
        this.id = counter.toString();
        this.type = 'device';
        counter += 1;
    }
    terminate() {
        return Promise.resolve(this.id);
    }
}

export default Device;
