const robot = require('robotjs');
const Devices = require('../../platforms/nodejs');
const Conv = require('./conversion');

robot.setMouseDelay(2);

Devices.searchForClosestDevice('wand')
    .then((device) => {
        return device.subscribePosition()
            .then(() => device.subscribeButton())
            .then(() => {
                const conv = new Conv(800, 600);
                device.on('position', (p) => {
                    // This will return x, y, pitch, roll and yaw
                    const pos = conv.position(p);
                    robot.moveMouse(pos.x, pos.y);
                });
                device.on('user-button', (e) => {
                    if (e === 0) {
                        // button down = mouse pointer down
                        robot.mouseToggle('up');
                    } else if (e === 1) {
                        // button down = mouse pointer down
                        robot.mouseToggle('down');
                    } else if (e === 3) {
                        // series of fast clicks = reset position
                        device.resetQuaternions();
                    }
                });
            });
    });
