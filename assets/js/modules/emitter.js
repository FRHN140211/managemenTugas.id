/* ============================================================
   modules/emitter.js — Lightweight event emitter.
   Used for cross-module communication instead of direct calls.
   ============================================================ */

(function (global) {
  'use strict';

  function EventEmitter() {
    this._events = {};
  }

  EventEmitter.prototype.on = function (event, fn) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(fn);
    return this;
  };

  EventEmitter.prototype.off = function (event, fn) {
    if (!this._events[event]) return this;
    if (!fn) {
      delete this._events[event];
      return this;
    }
    this._events[event] = this._events[event].filter(function (f) { return f !== fn; });
    return this;
  };

  EventEmitter.prototype.once = function (event, fn) {
    var self = this;
    var wrapped = function () {
      self.off(event, wrapped);
      fn.apply(null, arguments);
    };
    return this.on(event, wrapped);
  };

  EventEmitter.prototype.emit = function (event, detail) {
    var fns = this._events[event];
    if (!fns || !fns.length) return this;
    for (var i = 0; i < fns.length; i++) {
      fns[i](detail);
    }
    return this;
  };

  EventEmitter.prototype.removeAllListeners = function (event) {
    if (!event) {
      this._events = {};
      return this;
    }
    delete this._events[event];
    return this;
  };

  global.MT = global.MT || {};
  global.MT.EventEmitter = EventEmitter;
})(window);
