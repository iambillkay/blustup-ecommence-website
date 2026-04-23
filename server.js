require("express");

const app = require("./server/app");

module.exports = app;

if (require.main === module) {
  require("./server/index");
}
