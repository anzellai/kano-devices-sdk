import {BluetoothLESetup, BluetoothLETeardown} from '../mock/bluetoothle.js';

class Cordova {
    constructor() {
        this.platformId = 'ios';
    }
}

export const CordovaSetup = () => {
    window.cordova = new Cordova();
    BluetoothLESetup();
};

export const CordovaTeardown = () => {
    delete window.cordova;
    BluetoothLETeardown();
};

export const TriggerResume = () => {
    document.dispatchEvent(new Event('resume'));
};

export const TriggerPause = () => {
    document.dispatchEvent(new Event('pause'));
};