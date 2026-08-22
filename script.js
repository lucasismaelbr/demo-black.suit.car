// script.js - i18n, date mask, Google Maps Autocomplete (vanilla JS)

const defaultLang = 'en';
let mapsLoaded = false;
let currentDateMask = 'en'; // 'en' = MM/DD/YYYY | 'pt' = DD/MM/AAAA

// Load translation JSON and apply to DOM
async function loadTranslations(lang) {
  try {
    const response = await fetch(lang + '.json');
    if (!response.ok) throw new Error('Failed to load: ' + lang + '.json');
    const t = await response.json();

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key] !== undefined) el.textContent = t[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (t[key] !== undefined) el.placeholder = t[key];
    });

    // Update date mask locale
    if (t.dateMask) {
      currentDateMask = t.dateMask;
      // Clear the date field so old partial input doesn't confuse new format
      const dateInput = document.getElementById('date');
      if (dateInput && dateInput.value === '') dateInput.value = '';
    }

    document.documentElement.lang = lang;
  } catch (e) {
    console.error('i18n error:', e);
  }
}

// Language switcher
function initLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => loadTranslations(btn.dataset.lang));
  });
}

// Date mask – locale-aware
// EN: MM/DD/YYYY  |  PT: DD/MM/AAAA
// The separator is always '/' for readability; 8 digits total.
function maskDate(input) {
  input.addEventListener('input', function () {
    // Strip non-digits
    let v = this.value.replace(/\D/g, '').slice(0, 8);
    // Same positional structure for both locales: XX/XX/XXXX
    if (v.length >= 5) {
      v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
    } else if (v.length >= 3) {
      v = v.slice(0, 2) + '/' + v.slice(2);
    }
    this.value = v;
  });

  // Validate on blur
  input.addEventListener('blur', function () {
    const v = this.value;
    if (!v) return;
    const parts = v.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) {
      const hint = currentDateMask === 'pt' ? 'DD/MM/AAAA' : 'MM/DD/YYYY';
      this.setCustomValidity('Use the format ' + hint);
    } else {
      this.setCustomValidity('');
    }
  });
}

// Google Maps Autocomplete init
function initMapsAutocomplete() {
  if (!window.google || !google.maps || !google.maps.places) return;
  const opts = { types: ['establishment', 'geocode'], componentRestrictions: { country: 'us' } };
  new google.maps.places.Autocomplete(document.getElementById('pickup'), opts);
  new google.maps.places.Autocomplete(document.getElementById('dropoff'), opts);
}

// Lazy-load Maps script on first focus of location fields
function lazyLoadMaps() {
  if (mapsLoaded) return;
  mapsLoaded = true;
  const key = 'AIzaSyCRDaJ5YnEcUfOmb4vGbB5m5qDHHfs3_Ms';
  const s = document.createElement('script');
  s.src = 'https://maps.googleapis.com/maps/api/js?key=' + key + '&libraries=places&callback=initMapsAutocomplete';
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

// Footer year
function setYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

// Form submission stub
function initForm() {
  const form = document.getElementById('rideForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    alert('Request received! We will contact you shortly.');
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initLangSwitcher();
  loadTranslations(defaultLang);
  setYear();
  initForm();

  const dateInput = document.getElementById('date');
  if (dateInput) maskDate(dateInput);

  ['pickup', 'dropoff'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('focus', lazyLoadMaps, { once: true });
  });
});

// Expose for Maps callback
window.initMapsAutocomplete = initMapsAutocomplete;
