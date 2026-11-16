import { fillLabel, orderSpecs } from './fit-check.js';
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  saveDraft(text);
  window.location.href = 'advisor.html';
});

showSpecs();
