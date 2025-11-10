const express = require('express');
const { WebSocketServer } = require('ws');
const { smarthome } = require('actions-on-google');

const app = express();
app.use(express.json());

let esp32Socket = null;
const ESP32_ID = 'esp32_001';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

wss.on('connection', (ws, req) => {
  if (req.url && req.url.includes(ESP32_ID)) {
    esp32Socket = ws;
    console.log('ESP32 connecté !');
    ws.send('{"status":"connected"}');
    ws.on('close', () => esp32Socket = null);
  }
});

const smartHomeApp = smarthome();

smartHomeApp.onSync((body) => ({
  requestId: body.requestId,
  payload: {
    agentUserId: '123',
    devices: [{
      id: 'light1',
      type: 'action.devices.types.LIGHT',
      traits: ['action.devices.traits.OnOff'],
      name: { name: 'Lampe ESP32' },
      willReportState: false
    }]
  }
}));

smartHomeApp.onExecute(async (body) => {
  const commands = [];
  for (const cmd of body.inputs[0].payload.commands) {
    for (const exec of cmd.execution) {
      if (exec.command === 'action.devices.commands.OnOff' && esp32Socket) {
        esp32Socket.send(JSON.stringify({
          command: 'set_light',
          value: exec.params.on
        }));
        commands.push({
          ids: ['light1'],
          status: 'SUCCESS',
          states: { on: exec.params.on }
        });
      }
    }
  }
  return { requestId: body.requestId, payload: { commands } };
});

app.post('/webhook', (req, res) => smartHomeApp(req, res));
app.get('/', (req, res) => res.send('Serveur OK'));

app.listen(process.env.PORT || 8080, () => {
  console.log('Serveur démarré');
});
