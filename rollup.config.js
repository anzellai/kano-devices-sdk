import replace from './rollup/replace-module.js';

export default [{
    input: './kano-devices-sdk.js',
    output: {
        file: 'index.js',
        format: 'cjs',
    },
    external: 'events',
    plugins: [
        replace({
            './lib/event-emitter.js': 'events',
        }),
    ],
}, {
    input: './bus-adapter/bus-adapter.js',
    output: {
        file: './bus-adapter/index.js',
        format: 'cjs',
    },
}];
