// Run from the project root: node --test tests/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spinConfig, videoEmbedUrl, youTubeId } from '../js/media.js';

const ID = 'dQw4w9WgXcQ';

test('reads the video id from the common YouTube link forms', () => {
  assert.equal(youTubeId(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(youTubeId(`https://www.youtube.com/watch?v=${ID}&t=10s`), ID);
  assert.equal(youTubeId(`https://youtu.be/${ID}?si=abc`), ID);
  assert.equal(youTubeId(`https://www.youtube.com/embed/${ID}`), ID);
  assert.equal(youTubeId(`https://youtube.com/shorts/${ID}`), ID);
  assert.equal(youTubeId(`  https://m.youtube.com/watch?v=${ID}  `), ID);
});

test('rejects empty, foreign and malformed links', () => {
  assert.equal(youTubeId(''), null);
  assert.equal(youTubeId(undefined), null);
  assert.equal(youTubeId(ID), null);
  assert.equal(youTubeId(`https://vimeo.com/watch?v=${ID}`), null);
  assert.equal(youTubeId(`https://evil.example/youtube.com/watch?v=${ID}`), null);
  assert.equal(youTubeId('https://www.youtube.com/watch?v=short'), null);
  assert.equal(youTubeId('https://www.youtube.com/watch?v="><script>x'), null);
  assert.equal(youTubeId(`javascript:alert(1)//youtu.be/${ID}`), null);
});

test('builds the privacy-enhanced embed address', () => {
  assert.equal(
    videoEmbedUrl(`https://youtu.be/${ID}`),
    `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&playsinline=1`,
  );
  assert.equal(videoEmbedUrl(''), null);
});

test('accepts a complete 360 config and adds the trailing slash', () => {
  assert.deepEqual(spinConfig({ folder: 'images/360', filename: 'frame-{index}.svg', amount: 24 }), {
    folder: 'images/360/',
    filenameX: 'frame-{index}.svg',
    amountX: 24,
  });
});

test('rejects an incomplete 360 config', () => {
  assert.equal(spinConfig(null), null);
  assert.equal(spinConfig({ folder: 'images/360/', filename: 'frame.svg', amount: 24 }), null);
  assert.equal(spinConfig({ folder: 'images/360/', filename: 'frame-{index}.svg', amount: 1 }), null);
  assert.equal(spinConfig({ folder: '', filename: 'frame-{index}.svg', amount: 24 }), null);
  assert.equal(spinConfig({ folder: 'images/360/', filename: 'frame-{index}.svg', amount: 'many' }), null);
});
