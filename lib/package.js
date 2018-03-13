class Package {
    constructor(extractor, buffer) {
        this.extractor = extractor;
        this.buffer = buffer;
        this.zipFile = null;
        this.manifest = null;
    }
    load() {
        return this.extractor.loadAsync(this.buffer)
            .then((zipFile) => {
                this.zipFile = zipFile;
                try {
                    return this.zipFile.file('manifest.json').async('string');
                } catch (e) {
                    throw new Error('Unable to find manifest, is this a proper DFU package?');
                }
            })
            .then((content) => {
                this.manifest = JSON.parse(content).manifest;
                return this;
            });
    }
    getImage(types) {
        let type;
        for (let i = 0; i < types.length; i += 1) {
            type = types[i];
            if (this.manifest[type]) {
                const entry = this.manifest[type];
                const result = {
                    type,
                    initFile: entry.dat_file,
                    imageFile: entry.bin_file,
                };

                return this.zipFile.file(result.initFile).async('arraybuffer')
                    .then((data) => {
                        result.initData = data;
                        return this.zipFile.file(result.imageFile).async('arraybuffer');
                    })
                    .then((data) => {
                        result.imageData = data;
                        return result;
                    });
            }
        }
        return null;
    }
    getBaseImage() {
        return this.getImage(['softdevice', 'bootloader', 'softdevice_bootloader']);
    }
    getAppImage() {
        return this.getImage(['application']);
    }
}

export default Package;
