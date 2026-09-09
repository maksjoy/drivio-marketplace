const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('production/photos.js', 'utf8');

function setup({ width = 8000, height = 6000, bitmap = true, broken = false, encode } = {}) {
  const canvases = [], decoded = [], revoked = [], bitmapOptions = [];
  class Photo {
    set src(value) {
      if (!value) return;
      this.naturalWidth = width; this.naturalHeight = height;
      queueMicrotask(() => broken ? this.onerror() : this.onload());
    }
  }
  const window = {
    Image: Photo,
    URL: { createObjectURL: () => 'blob:photo', revokeObjectURL: url => revoked.push(url) },
    ...(bitmap ? { async createImageBitmap(file, options) {
      bitmapOptions.push(options);
      if (broken) throw new Error('Invalid image');
      const image = { width: options.resizeWidth || width, height: options.resizeHeight || height, closed: false, close() { this.closed = true; } };
      decoded.push(image); return image;
    } } : {})
  };
  const document = { createElement() {
    const canvas = { width: 0, height: 0, draws: [], encodes: [],
      getContext() { return { fillRect() {}, drawImage(image, x, y, width, height) { canvas.draws.push({ width, height }); } }; },
      toBlob(callback, type, quality) {
        canvas.encodes.push({ width: this.width, height: this.height, quality });
        const size = encode ? encode(this, quality) : 100000;
        callback(size === null ? null : new Blob([new Uint8Array(size)], { type }));
      }
    };
    canvases.push(canvas); return canvas;
  } };
  vm.runInNewContext(source, { window, document, Uint8Array, DataView, Object, String, Math, Error });
  return { api: window.P2PPhotos, canvases, decoded, revoked, bitmapOptions };
}

function jpeg(width = 8000, height = 6000, orientation = 1) {
  // A bounded JPEG header fixture; the browser decoder is a controlled dependency in these tests.
  const header = Buffer.from([
    255,216,255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,
    1,0,18,1,3,0,1,0,0,0,orientation,0,0,0,0,0,0,0,
    255,192,0,17,8,height>>8,height&255,width>>8,width&255,3,1,17,0,2,17,1,3,17,1,255,218
  ]);
  return new File([header], 'camera.jpg', { type: 'image/jpeg' });
}

test('original photo validation has no byte ceiling and accepts camera files without MIME', () => {
  const { api } = setup();
  api.validate({ name: 'camera.HEIC', type: '', size: 600 * 1024 * 1024 });
  api.validate({ name: 'panorama.jpg', type: 'image/jpeg', size: 100 * 1024 * 1024 });
  assert.throws(() => api.validate({ name: 'empty.jpg', type: 'image/jpeg', size: 0 }), /empty/);
  assert.throws(() => api.validate({ name: 'unsafe.svg', type: 'image/svg+xml', size: 10 }), /Choose a photo/);
  assert.throws(() => api.validate({ name: 'fake.jpg', type: 'text/html', size: 10 }), /Choose a photo/);
});

test('48 MP JPEG is decoded at a bounded resolution, preserves aspect ratio and frees its bitmap/canvas', async () => {
  const a = setup();
  const result = await a.api.optimize(jpeg());
  assert.equal(a.bitmapOptions[0].resizeWidth, 1920);
  assert.equal(a.bitmapOptions[0].resizeHeight, 1440);
  assert.equal(result.type, 'image/jpeg');
  assert.ok(result.size <= a.api.fullLimit);
  assert.ok(a.decoded.every(image => image.closed));
  assert.ok(a.canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
});

test('EXIF portrait orientation is applied before choosing decode dimensions', async () => {
  const a = setup();
  await a.api.optimize(jpeg(8000, 6000, 6));
  assert.equal(a.bitmapOptions[0].resizeWidth, 1440);
  assert.equal(a.bitmapOptions[0].resizeHeight, 1920);
  assert.equal(a.bitmapOptions[0].imageOrientation, 'from-image');
});

test('panoramas fit the long edge without cropping and small photos are never enlarged', async () => {
  const a = setup();
  await a.api.optimize(jpeg(60000, 2000));
  assert.equal(a.bitmapOptions[0].resizeWidth, 1920);
  assert.equal(a.bitmapOptions[0].resizeHeight, 64);
  await a.api.optimize(jpeg(400, 300));
  assert.equal(a.bitmapOptions[1].resizeWidth, 400);
  assert.equal(a.bitmapOptions[1].resizeHeight, 300);
});

test('older webviews use Image fallback and revoke the object URL', async () => {
  const a = setup({ bitmap: false });
  const blob = await a.api.optimize(jpeg());
  assert.ok(blob.size <= a.api.fullLimit);
  assert.deepEqual(a.revoked, ['blob:photo']);
  assert.deepEqual(a.canvases[0].draws, [{ width: 1920, height: 1440 }]);
});

test('byte budget is enforced by reducing dimensions when quality alone is insufficient', async () => {
  const a = setup({ encode: canvas => canvas.width >= 1500 ? 4 * 1024 * 1024 : 1000000 });
  const blob = await a.api.optimize(jpeg());
  assert.ok(blob.size <= a.api.fullLimit);
  assert.ok(a.canvases.length > 1);
  assert.ok(a.canvases.every(canvas => canvas.width === 1));
});

test('thumbnail has its own byte budget and dimensions', async () => {
  const a = setup();
  const blob = await a.api.optimize(jpeg(), 720, 0.72);
  assert.ok(blob.size <= a.api.thumbLimit);
  assert.equal(a.bitmapOptions[0].resizeWidth, 720);
});

test('corrupt photos and failed encoders report an error instead of returning original bytes', async () => {
  for (const options of [{ broken: true }, { encode: () => null }, { encode: () => 3 * 1024 * 1024 }]) {
    const a = setup(options);
    await assert.rejects(a.api.optimize(jpeg()), /camera.jpg.*could not be processed/);
    assert.ok(a.decoded.every(image => image.closed));
    assert.ok(a.canvases.every(canvas => canvas.width === 1));
    if (options.broken) assert.deepEqual(a.revoked, ['blob:photo']);
  }
});
