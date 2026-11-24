import { fillLabel, orderSpecs } from './fit-check.js';
import { SPIN_VIEW, VIDEO_URL } from './media-config.js';
import { spinConfig, videoEmbedUrl } from './media.js';
import { saveDraft } from './shared.js';
import { fetchProductSpecs } from './supabase-client.js';

const specList = document.getElementById('spec-list');
const specStatus = document.getElementById('spec-status');
const image = document.getElementById('product-image');
const form = document.getElementById('free-text-form');
const input = document.getElementById('free-text');

async function showSpecs() {
  try {
    const specs = orderSpecs(await fetchProductSpecs());
    specList.replaceChildren(...specs.map((spec) => {
      const item = document.createElement('li');
      item.textContent = fillLabel(spec);
      return item;
    }));
    specStatus.hidden = true;
  } catch {
    specStatus.textContent = 'The specification is not available right now. Please try again later.';
  }
}

function showImagePlaceholder() {
  image.closest('.product-image').classList.add('is-placeholder');
  image.remove();
}

if (image.complete && image.naturalWidth === 0) {
  showImagePlaceholder();
} else {
  image.addEventListener('error', showImagePlaceholder);
}

function setUpVideo() {
  const embedUrl = videoEmbedUrl(VIDEO_URL);
  if (!embedUrl) return;
  const button = document.getElementById('video-open');
  const dialog = document.getElementById('video-dialog');
  const frame = document.getElementById('video-frame');

  button.hidden = false;
  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.title = 'WIZEROLL brand video';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.replaceChildren(iframe);
    dialog.showModal();
  });
  // Removing the iframe stops the video when the window closes.
  dialog.addEventListener('close', () => frame.replaceChildren());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setUpSpinView() {
  const config = spinConfig(SPIN_VIEW);
  if (!config || !window.CI360) return;
  const toggle = document.getElementById('spin-toggle');
  const view = document.getElementById('spin-view');
  const photo = document.querySelector('.product-image');
  let started = false;

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const showSpin = view.hidden;
    view.hidden = !showSpin;
    photo.hidden = showSpin;
    toggle.setAttribute('aria-pressed', String(showSpin));
    toggle.querySelector('.visually-hidden').textContent = showSpin ? 'Show the product photo' : 'Show the 360 degree view';
    if (showSpin && !started) {
      started = true;
      window.CI360.init(view, { ...config, aspectRatio: '1/1', keys: true, initialIconShown: false, zoomControlsPosition: 'top-right' });
    }
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  saveDraft(text);
  window.location.href = 'advisor.html';
});

showSpecs();
setUpVideo();
setUpSpinView();
