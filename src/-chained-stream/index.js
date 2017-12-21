const {Transform} = require('stream');

module.exports = class ChainedStream extends Transform {

	constructor(...streams) {
		let caughtError;
		const [input] = streams;
		super({
			objectMode: true,
			transform(chunk, encoding, callback) {
				if (caughtError) {
					if (this.listenerCount('error') === 0) {
						this.once('error', () => {});
					}
					callback(caughtError);
				} else {
					input.write(chunk);
					callback();
				}
			},
			flush(callback) {
				input.end();
				onFlush(callback);
			},
		});
		streams.unshift(null);
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
		const onError = (error) => {
			caughtError = caughtError || error;
		};
		streams.reduce((end, stream) => {
			if (end) {
				end.pipe(stream);
			}
			return stream.once('error', onError);
		});
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
