const assert = require('assert');
const test = require('@nlib/test');
const {PassThrough, Transform, Writable} = require('stream');
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

function write(source, queue) {
	setImmediate(write);
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

test('stream-chain', (test) => {

	const N_BUFFER = 1000;
	const N_PIPELINE = 1000;

	test('buffer → buffer', () => {
		const data = new Array(N_BUFFER).fill()
		.map((x, index) => `${Date.now()}-${index}`);
		return new Promise((resolve, reject) => {
			const source = new PassThrough({objectMode: false});
			write(source, data.slice());
			const streams = new Array(N_PIPELINE).fill()
			.map((x, index) => new TestStream({name: index}));
			source
			.pipe(chain(...streams))
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
		const data = new Array(N_BUFFER).fill()
		.map((x, index) => `${Date.now()}-${index}`);
		return new Promise((resolve, reject) => {
			const source = new PassThrough({objectMode: false});
			write(source, data.slice());
			const half = Math.floor(N_PIPELINE / 2);
			const bb = new Array(half).fill()
			.map((x, index) => new TestStream({name: index, mode: 'bb'}));
			const bo = [new TestStream({name: half, mode: 'bo'})];
			const oo = new Array(half).fill()
			.map((x, index) => new TestStream({name: half + 1 + index, mode: 'oo'}));
			source
			.pipe(chain(...bb, ...bo, ...oo))
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
		const data = new Array(N_BUFFER).fill()
		.map((x, index) => `${Date.now()}-${index}`);
		return new Promise((resolve, reject) => {
			const source = new PassThrough({objectMode: true});
			write(source, data.map((value) => ({value})));
			const half = Math.floor(N_PIPELINE / 2);
			const oo = new Array(half).fill()
			.map((x, index) => new TestStream({name: half + 1 + index, mode: 'oo'}));
			const ob = [new TestStream({name: half, mode: 'ob'})];
			const bb = new Array(half).fill()
			.map((x, index) => new TestStream({name: index, mode: 'bb'}));
			source
			.pipe(chain(...oo, ...ob, ...bb))
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

}, {timeout: 30000});
