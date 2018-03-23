const Devices = require('../../platforms/nodejs');
const BusAdapter = require('../../bus-adapter');
const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const index = fs.readFileSync(`${__dirname}/index.html`);

const app = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(index);
});

const io = socketio.listen(app);

io.on('connection', (socket) => {
    console.log('new connection, started scanning');
    const adapter = new BusAdapter({ bus: socket, Devices });

    Devices.wandPrefix = 'Kano-Wand-75';
    Devices.startBluetoothScan();
});

app.listen(3000);
