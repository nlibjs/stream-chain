const assert = require('assert');
const test = require('@nlib/test');
const {Transform, Writable, PassThrough} = require('stream');
const {chain} = require('..');

class TestStream extends Transform {

	constructor({
		name = 'test',
		mode = 'bb',
	} = {}) {
		name = `${name}`;
		const received = [];
		Object.assign(
			super({
				objectMode: mode.includes('o'),
				transform: {
					bb: (chunk, encoding, callback) => {
						setImmediate(() => {
							received.push(chunk);
							this.push(chunk);
							callback();
						});
					},
					oo: (chunk, encoding, callback) => {
						setImmediate(() => {
							received.push(chunk);
							this.push(chunk);
							callback();
						});
					},
					bo: (chunk, encoding, callback) => {
						setImmediate(() => {
							const wrapped = {value: `${chunk}`};
							received.push(wrapped);
							this.push(wrapped);
							callback();
						});
					},
					ob: (chunk, encoding, callback) => {
						setImmediate(() => {
							const string = JSON.stringify(chunk);
							received.push(string);
							this.push(string);
							callback();
						});
					},
				}[mode],
			}),
			{
				received,
				name,
			}
		);
	}

}

class Terminator extends Writable {

	constructor({objectMode = false} = {}) {
		const received = [];
		super({
			objectMode,
			write(chunk, encoding, callback) {
				received.push(chunk);
				callback();
			},
		}).received = received;
	}

}

test('stream-chain', (test) => {

	const N_BUFFER = 10;
	const N_PIPELINE = 10;

	test('buffer → buffer', () => {
		const data = arr(N_BUFFER, (x, index) => `${Date.now()}-${index}`);
		return new Promise((resolve, reject) => {
			const streams = arr(N_PIPELINE, (x, index) => new TestStream({name: index}));
			const chained = chain(...streams);
			write(chained, data.slice());
			chained
			.pipe(new Terminator())
			.once('error', reject)
			.once('finish', () => {
				resolve(streams.map(({received}) => received));
			});
		})
		.then((results) => {
			for (const result of results) {
				const actual = result.map((x) => `${x}`);
				for (let i = 0; i < data.length; i++) {
					assert.equal(actual[i], data[i]);
				}
			}
		});
	});

	test('buffer → object', () => {
		const data = arr(N_BUFFER, (x, index) => `${Date.now()}-${index}`);
		return new Promise((resolve, reject) => {
			const half = Math.floor(N_PIPELINE / 2);
			const bb = arr(half, (x, index) => new TestStream({name: index, mode: 'bb'}));
			const bo = [new TestStream({name: half, mode: 'bo'})];
			const oo = arr(half, (x, index) => new TestStream({name: half + 1 + index, mode: 'oo'}));
			const chained = chain(...bb, ...bo, ...oo);
			write(chained, data.slice());
			chained
			.pipe(new Terminator({objectMode: true}))
			.once('error', reject)
			.once('finish', () => {
				resolve({
					bb: bb.map(({received}) => received),
					bo: bo.map(({received}) => received),
					oo: oo.map(({received}) => received),
				});
			});
		})
		.then(({bb, bo, oo}) => {
			for (const result of bb) {
				for (let i = 0; i < data.length; i++) {
					assert.equal(`${result[i]}`, data[i]);
				}
			}
			for (const result of [...bo, ...oo]) {
				for (let i = 0; i < data.length; i++) {
					assert.equal(result[i].value, data[i]);
				}
			}
		});
	});

	test('object → buffer', () => {
		const data = arr(N_BUFFER, (x, index) => `${Date.now()}-${index}`);
		return new Promise((resolve, reject) => {
			const half = Math.floor(N_PIPELINE / 2);
			const oo = arr(half, (x, index) => new TestStream({name: half + 1 + index, mode: 'oo'}));
			const ob = [new TestStream({name: half, mode: 'ob'})];
			const bb = arr(half, (x, index) => new TestStream({name: index, mode: 'bb'}));
			const chained = chain(...oo, ...ob, ...bb);
			write(chained, data.map((value) => ({value})));
			chained
			.pipe(new Terminator())
			.once('error', reject)
			.once('finish', () => {
				resolve({
					bb: bb.map(({received}) => received),
					ob: ob.map(({received}) => received),
					oo: oo.map(({received}) => received),
				});
			});
		})
		.then(({oo, ob, bb}) => {
			for (const result of oo) {
				for (let i = 0; i < data.length; i++) {
					assert.equal(result[i].value, data[i]);
				}
			}
			for (const result of [...ob, ...bb]) {
				for (let i = 0; i < data.length; i++) {
					assert.equal(result[i], `{"value":"${data[i]}"}`);
				}
			}
		});
	});

	test('error detection', (test) => {
		const data = arr(N_BUFFER, (x, index) => `${Date.now()}-${index}`);
		const expectedError = new Error('Expected');
		test('first', () => {
			return new Promise((resolve, reject) => {
				write(chain(
					new Transform({transform: (chunk, encoding, callback) => callback(expectedError)}),
					new PassThrough(),
					new PassThrough()
				), data.slice())
				.once('error', reject)
				.once('finish', resolve);
			})
			.then(unexpectedResolve)
			.catch((error) => assert.equal(error, expectedError));
		});
		test('middle', () => {
			return new Promise((resolve, reject) => {
				write(chain(
					new PassThrough(),
					new Transform({transform: (chunk, encoding, callback) => callback(expectedError)}),
					new PassThrough()
				), data.slice())
				.once('error', reject)
				.once('finish', resolve);
			})
			.then(unexpectedResolve)
			.catch((error) => assert.equal(error, expectedError));
		});
		test('last', () => {
			return new Promise((resolve, reject) => {
				write(chain(
					new PassThrough(),
					new PassThrough(),
					new Transform({transform: (chunk, encoding, callback) => callback(expectedError)})
				), data.slice())
				.once('error', reject)
				.once('finish', resolve);
			})
			.then(unexpectedResolve)
			.catch((error) => assert.equal(error, expectedError));
		});
	});

}, {timeout: 30000});

function write(source, queue) {
	setImmediate(write);
	return source;
	function write() {
		const chunk = queue.shift();
		if (chunk) {
			source.write(chunk);
			setImmediate(write);
		} else {
			source.end();
		}
	}
}

function arr(length, mapper) {
	return new Array(length).fill().map(mapper);
}

function unexpectedResolve() {
	throw new Error('Resolved unexpectedly');
}
