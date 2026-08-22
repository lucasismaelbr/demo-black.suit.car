// script.js - i18n, date mask, Google Maps Autocomplete (vanilla JS)

const defaultLang = 'en';
let mapsLoaded = false;

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

// Date mask MM/DD/YYYY
function maskDate(input) {
  input.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 8);
    if (v.length >= 5) v = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4);
    else if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
    this.value = v;
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
