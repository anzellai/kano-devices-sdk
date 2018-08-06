export class Logger {
    trace() {}
    debug() {}
    info(...args) {
        console.log(...args);
    }
    warn(...args) {
        console.log(...args);
    }
    error(...args) {
        console.log(...args);
    }
    log(...args) {
        console.log(...args);
    }
}

export default Logger;
