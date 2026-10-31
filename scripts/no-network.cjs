// Test-only preload: fail attempted networking; never loaded by the library or game.
const deny = () => {
  throw new Error("Network access is forbidden in this verification");
};
const net = require("node:net");
net.connect = net.createConnection = deny;
net.Socket.prototype.connect = deny;
require("node:dgram").createSocket = deny;
require("node:http").request = require("node:http").get = deny;
require("node:https").request = require("node:https").get = deny;
globalThis.fetch = deny;
if (globalThis.WebSocket)
  globalThis.WebSocket = class {
    constructor() {
      deny();
    }
  };
