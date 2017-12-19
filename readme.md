# @nlib/stream-chain

[![Build Status](https://travis-ci.org/nlibjs/stream-chain.svg?branch=master)](https://travis-ci.org/nlibjs/stream-chain)
[![Build status](https://ci.appveyor.com/api/projects/status/github/nlibjs/stream-chain?branch=mater&svg=true)](https://ci.appveyor.com/project/kei-ito/stream-chain/branch/master)
[![codecov](https://codecov.io/gh/nlibjs/stream-chain/branch/master/graph/badge.svg)](https://codecov.io/gh/nlibjs/stream-chain)
[![dependencies Status](https://david-dm.org/nlibjs/stream-chain/status.svg)](https://david-dm.org/nlibjs/stream-chain)
[![devDependencies Status](https://david-dm.org/nlibjs/stream-chain/dev-status.svg)](https://david-dm.org/nlibjs/stream-chain?type=dev)

Chain multiple streams.

## Install

```
npm install @nlib/stream-chain
```

## Usage

### Tap

```javascript
const {Transform} = require('stream');
const {chain} = require('@nlib/stream-chain');

class A extends Transform {...}
class B extends Transform {...}
class C extends Transform {...}

class D extends Transform {

  connector() {
    return chain(new A(), new B(), new C(), this);
  }

}
```

## Javascript API

`require('@nlib/stream-chain')` returns `{chain}`.

### Tap

#### chain(stream1, ..., streamN)

Chain the stream1 ... streamN and return the chained stream.

## LICENSE

MIT
