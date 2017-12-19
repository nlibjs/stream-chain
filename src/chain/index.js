const ChainedStream = require('../-chained-stream');
module.exports = function chain(...args) {
	return new ChainedStream(...args);
};
