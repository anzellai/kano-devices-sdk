let devicesPrefixes = [
    generateWrongName,
    generateWandName
];

export function generateWrongName() {
    return null;
}

export function generateWandName() {
    return `Kano-Wand-${parseInt(100 * Math.random())}-${parseInt(100 * Math.random())}-${parseInt(100 * Math.random())}`;
}

export function generateAddress() {
    return `${parseInt(100 * Math.random())}:${parseInt(100 * Math.random())}:${parseInt(100 * Math.random())}:${parseInt(100 * Math.random())}:${parseInt(100 * Math.random())}:${parseInt(100 * Math.random())}`;
}

export function generateRandomName() {
    return devicesPrefixes[parseInt(devicesPrefixes.length * Math.random())]();
}