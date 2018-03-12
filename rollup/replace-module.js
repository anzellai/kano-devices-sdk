import path from 'path';

// Helper functions
const noop = () => null;

export default function alias(options = {}) {
    const aliasKeys = Object.keys(options);

    let entryPath;

    // No aliases?
    if (!aliasKeys.length) {
        return {
            resolveId: noop,
        };
    }

    return {
        resolveId(importee, importer) {
            if (!importer) {
                entryPath = path.resolve(path.dirname(importee));
                return null;
            }
            const importeeId = path.join(path.dirname(importer), importee);

            // First match is supposed to be the correct one
            const toReplace = aliasKeys.find(p => path.join(entryPath, p) === importeeId);

            if (!toReplace) {
                return null;
            }

            const entry = options[toReplace];

            return entry;
        },
    };
}
