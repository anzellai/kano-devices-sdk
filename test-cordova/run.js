export const loadTests = (testFiles) => {
    mocha.setup('tdd');
    mocha.timeout(30000);
    return Promise.all(testFiles.map(t => import(t)))
        .then(() => {
            mocha.checkLeaks();
            mocha.run();
        });
};
