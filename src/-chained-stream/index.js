const {Transform, PassThrough} = require('stream');

module.exports = class ChainedStream extends Transform {

	constructor(...streams) {
		const input = new PassThrough({objectMode: true});
		super({
			objectMode: true,
			transform(chunk, encoding, callback) {
				input.push(chunk);
				callback();
			},
			flush(callback) {
				input.end();
				onFlush(callback);
			},
		});
		streams.push(new Transform({
			objectMode: true,
			transform: (chunk, encoding, callback) => {
				this.push(chunk);
				callback();
			},
			flush: (callback) => {
				this.end();
				onFlush(callback);
			},
		}));
		streams.reduce((end, stream) => {
			return end
			.pipe(stream)
			.once('error', (error) => this.destroy(error));
		}, input);
		function onFlush(callback) {
			if (onFlush.callback) {
				callback();
				onFlush.callback();
			} else {
				onFlush.callback = callback;
			}
		}
	}

};
