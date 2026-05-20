'use strict';

const cache = new Map();

function get(key) {
  return cache.get(key);
}

function set(key, value) {
  cache.set(key, value);
}

function del(key) {
  cache.delete(key);
}

module.exports = { get, set, del };