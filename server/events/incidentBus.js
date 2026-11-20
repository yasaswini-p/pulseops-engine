// Central event bus — publishers and subscribers never call each other directly
const { EventEmitter } = require("events");

class IncidentBus extends EventEmitter {
  // setImmediate defers listeners until after the current operation (e.g. the HTTP response) finishes
  publish(event, payload) {
    setImmediate(() => this.emit(event, payload));
  }
}

module.exports = new IncidentBus();