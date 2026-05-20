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

function clear() {
  cache.clear();
}

module.exports = {
  get,
  set,
  del,
  clear,
};