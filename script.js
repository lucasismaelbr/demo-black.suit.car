// script.js - i18n, date mask, Google Maps Autocomplete (vanilla JS)

const defaultLang = 'en';
let mapsLoaded = false;
let currentDateMask = 'en'; // 'en' = MM/DD/YYYY | 'pt' = DD/MM/AAAA

let currentTranslations = {};

// Load translation JSON and apply to DOM
async function loadTranslations(lang) {
  try {
    const response = await fetch(lang + '.json');
    if (!response.ok) throw new Error('Failed to load: ' + lang + '.json');
    const t = await response.json();
    currentTranslations = t;

    // Apply text translations
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key] !== undefined) el.textContent = t[key];
    });

    // Apply placeholder translations
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (t[key] !== undefined) el.placeholder = t[key];
    });

    // Update date mask locale
    if (t.dateMask) {
      currentDateMask = t.dateMask;
      const dateInput = document.getElementById('date');
      if (dateInput && dateInput.value) {
        checkAndDisplayDateError(dateInput);
      }
    }

    // Update time availability status pill text for current language (if on home page)
    updateTimeStatusUI();

    // Persist language choice across pages
    try {
      localStorage.setItem('preferredLang', lang);
    } catch (_) {}

    // Update active visual state for language switcher buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      if (btn.dataset.lang === lang) {
        btn.classList.add('active-lang');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active-lang');
        btn.setAttribute('aria-pressed', 'false');
      }
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

// Parse & validate date: blocks past dates and invalid formats
function validateDateValue(value) {
  if (!value || value.trim() === '') {
    return { valid: false, errorKey: 'dateInvalidError' };
  }

  const parts = value.split('/');
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
    return { valid: false, errorKey: 'dateInvalidError' };
  }

  let day, month, year;
  if (currentDateMask === 'pt') {
    day   = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year  = parseInt(parts[2], 10);
  } else {
    month = parseInt(parts[0], 10);
    day   = parseInt(parts[1], 10);
    year  = parseInt(parts[2], 10);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, errorKey: 'dateInvalidError' };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2024 || year > 2100) {
    return { valid: false, errorKey: 'dateInvalidError' };
  }

  // Check valid days in month (including leap years)
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { valid: false, errorKey: 'dateInvalidError' };
  }

  // Input date at midnight local time
  const inputDate = new Date(year, month - 1, day, 0, 0, 0, 0);

  // Today at midnight local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Block any past date
  if (inputDate.getTime() < today.getTime()) {
    return { valid: false, errorKey: 'datePastError' };
  }

  return { valid: true };
}

// Display/clear inline error for date input
function checkAndDisplayDateError(input) {
  const errorEl = document.getElementById('dateError');
  const val = input.value.trim();

  if (!val) {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
    input.classList.remove('input-error');
    input.setCustomValidity('');
    return false;
  }

  const result = validateDateValue(val);
  if (!result.valid) {
    const errorMsg = currentTranslations[result.errorKey] ||
      (result.errorKey === 'datePastError'
        ? 'Departure date cannot be in the past. Please choose today or a future date.'
        : 'Please enter a valid date.');

    if (errorEl) {
      errorEl.textContent = errorMsg;
      errorEl.classList.add('is-visible');
    }
    input.classList.add('input-error');
    input.setCustomValidity(errorMsg);
    return false;
  } else {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
    input.classList.remove('input-error');
    input.setCustomValidity('');
    return true;
  }
}

// Date mask – locale-aware with live past-date validation
// EN: MM/DD/YYYY  |  PT: DD/MM/AAAA
function maskDate(input) {
  input.addEventListener('input', function () {
    // Strip non-digits
    let v = this.value.replace(/\D/g, '').slice(0, 8);
    if (v.length >= 5) {
      v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
    } else if (v.length >= 3) {
      v = v.slice(0, 2) + '/' + v.slice(2);
    }
    this.value = v;

    // If 8 digits (full date) entered, validate immediately
    if (v.length === 10) {
      checkAndDisplayDateError(this);
    } else {
      // Clear error while user is still typing
      const errorEl = document.getElementById('dateError');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('is-visible');
      }
      this.classList.remove('input-error');
      this.setCustomValidity('');
    }
  });

  // Full validation on blur
  input.addEventListener('blur', function () {
    if (this.value.trim() !== '') {
      checkAndDisplayDateError(this);
    }
  });
}

// Google Maps Autocomplete init
// NOTE: Called by the Maps script callback once it loads successfully.
function initMapsAutocomplete() {
  if (!window.google || !google.maps || !google.maps.places) return;
  const opts = {
    types: ['establishment', 'geocode'],
    componentRestrictions: { country: 'us' }
  };
  const pickup  = document.getElementById('pickup');
  const dropoff = document.getElementById('dropoff');
  if (pickup)  new google.maps.places.Autocomplete(pickup,  opts);
  if (dropoff) new google.maps.places.Autocomplete(dropoff, opts);
}

// Load the Maps script – only if the API key is available and the domain is authorized.
function loadMaps() {
  if (mapsLoaded) return;
  mapsLoaded = true;
  const key = 'AIzaSyCRDaJ5YnEcUfOmb4vGbB5m5qDHHfs3_Ms';
  const s   = document.createElement('script');
  s.src     = 'https://maps.googleapis.com/maps/api/js?key=' + key
              + '&libraries=places&callback=initMapsAutocomplete';
  s.async   = true;
  s.onerror = () => { mapsLoaded = false; };
  document.head.appendChild(s);
}

// Lazy-load Maps ONLY after the domain is whitelisted.
function lazyLoadMaps() {
  // loadMaps();
}

// Footer year
function setYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

// Time Slot Availability Checker
function getTimeSlotAvailability() {
  const hourEl   = document.getElementById('pickupHour');
  const minuteEl = document.getElementById('pickupMinute');
  const ampmEl   = document.getElementById('pickupAmPm');

  if (!hourEl || !minuteEl || !ampmEl) return { status: 'available' };

  let hour   = parseInt(hourEl.value, 10);
  let minute = parseInt(minuteEl.value, 10);
  let ampm   = ampmEl.value;

  // Convert to 24h format in minutes from midnight
  let h24 = hour;
  if (ampm === 'PM' && h24 < 12) h24 += 12;
  if (ampm === 'AM' && h24 === 12) h24 = 0;
  const timeMinutes = h24 * 60 + minute;

  // 1. Check occupied slot: 4:00 PM to 5:30 PM (16:00 to 17:30 = 960 to 1050 min)
  if (timeMinutes >= 960 && timeMinutes <= 1050) {
    return {
      status: 'occupied',
      titleKey: 'timeOccupiedAlertTitle',
      msgKey: 'timeOccupiedAlertMessage',
      pillKey: 'timeStatusOccupied'
    };
  }

  // 2. Check overnight occupied slot: 10:00 PM to 4:00 AM (22:00 to 04:00 = >= 1320 or <= 240 min)
  if (timeMinutes >= 1320 || timeMinutes <= 240) {
    return {
      status: 'occupied',
      titleKey: 'timeOccupiedAlertTitle',
      msgKey: 'timeOccupiedAlertMessage',
      pillKey: 'timeStatusOccupied'
    };
  }

  // 3. Outside standard operating hours: 4:01 AM to 4:59 AM
  if (timeMinutes < 300) {
    return {
      status: 'outside_hours',
      titleKey: 'timeOccupiedAlertTitle',
      msgKey: 'timeOutsideAlertMessage',
      pillKey: 'timeStatusOutsideHours'
    };
  }

  return {
    status: 'available',
    pillKey: 'timeStatusAvailable'
  };
}

// Update the live time availability badge
function updateTimeStatusUI() {
  const statusEl = document.getElementById('timeStatus');
  const errorEl  = document.getElementById('timeError');
  const selectorsWrap = document.querySelector('.time-selectors');
  if (!statusEl) return;

  const availability = getTimeSlotAvailability();

  statusEl.className = 'time-status-pill';
  if (selectorsWrap) selectorsWrap.classList.remove('has-error');

  if (availability.status === 'available') {
    statusEl.classList.add('is-available');
    statusEl.textContent = currentTranslations[availability.pillKey] || '✓ Time slot available';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
  } else if (availability.status === 'occupied') {
    statusEl.classList.add('is-occupied');
    statusEl.textContent = currentTranslations[availability.pillKey] || '⚠️ Time slot occupied';
    if (selectorsWrap) selectorsWrap.classList.add('has-error');
    if (errorEl) {
      errorEl.textContent = currentTranslations['timeOccupiedAlertMessage'] || 'Selected time is occupied on calendar.';
      errorEl.classList.add('is-visible');
    }
  } else {
    statusEl.classList.add('is-outside');
    statusEl.textContent = currentTranslations[availability.pillKey] || 'ℹ️ Outside regular hours (5 AM – 10 PM ET)';
    if (errorEl) {
      errorEl.textContent = currentTranslations['timeOutsideAlertMessage'] || '';
      errorEl.classList.add('is-visible');
    }
  }
}

// Modal handling for occupied time slots
function showBusyModal(titleKey, messageKey) {
  const modal = document.getElementById('busyModal');
  const title = document.getElementById('busyModalTitle');
  const msg   = document.getElementById('busyModalMessage');
  if (!modal) return;

  if (title) title.textContent = currentTranslations[titleKey] || 'Selected Time is Occupied';
  if (msg)   msg.textContent   = currentTranslations[messageKey] || 'The requested pickup time is currently marked as OCCUPIED on the weekly calendar. Please check the calendar on the right and select an open time slot.';

  modal.classList.add('is-active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  const closeBtn = document.getElementById('busyModalClose');
  if (closeBtn) closeBtn.focus();
}

function hideBusyModal() {
  const modal = document.getElementById('busyModal');
  if (!modal) return;
  modal.classList.remove('is-active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

// Form submission handler with complete validation (Date + Time Availability) & Contact Form
function initForm() {
  const form = document.getElementById('rideForm');
  if (form) {
    // Listen for time selection changes
    ['pickupHour', 'pickupMinute', 'pickupAmPm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', updateTimeStatusUI);
      }
    });

    // Modal close listeners
    const closeBtn = document.getElementById('busyModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideBusyModal);
    }

    const modal = document.getElementById('busyModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideBusyModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('is-active')) {
        hideBusyModal();
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // 1. Validate Date
      const dateInput = document.getElementById('date');
      if (dateInput) {
        const isDateValid = checkAndDisplayDateError(dateInput);
        if (!isDateValid) {
          dateInput.focus();
          return;
        }
      }

      // 2. Validate Time Slot Availability
      const timeCheck = getTimeSlotAvailability();
      if (timeCheck.status === 'occupied') {
        showBusyModal(timeCheck.titleKey, timeCheck.msgKey);
        return;
      }

      if (timeCheck.status === 'outside_hours') {
        showBusyModal(timeCheck.titleKey, timeCheck.msgKey);
        return;
      }

      // 3. Success
      const successMsg = currentTranslations['formSuccess'] ||
        'Thank you! Your ride request has been submitted. We will contact you shortly to confirm.';
      alert(successMsg);
    });
  }

  // Handle Contact Page Form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const successMsg = currentTranslations['contactSuccess'] ||
        'Thank you for your message! Our team will contact you shortly.';
      alert(successMsg);
      contactForm.reset();
    });
  }
}

// Mobile hamburger menu toggle
function initMobileMenu() {
  const toggle = document.getElementById('navToggle');
  const nav    = document.getElementById('mainNav');
  if (!toggle || !nav) return;

  function openMenu() {
    nav.classList.add('nav-open');
    toggle.classList.add('is-active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    nav.classList.remove('nav-open');
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  function toggleMenu() {
    nav.classList.contains('nav-open') ? closeMenu() : openMenu();
  }

  // Toggle on hamburger click
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close when a nav link is clicked (navigation or anchor)
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('nav-open') && !nav.contains(e.target) && e.target !== toggle) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('nav-open')) {
      closeMenu();
      toggle.focus();
    }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  let initialLang = defaultLang;
  try {
    const saved = localStorage.getItem('preferredLang');
    if (saved && (saved === 'en' || saved === 'pt')) {
      initialLang = saved;
    }
  } catch (_) {}

  initLangSwitcher();
  loadTranslations(initialLang);
  setYear();
  initForm();
  initMobileMenu();

  const dateInput = document.getElementById('date');
  if (dateInput) maskDate(dateInput);

  ['pickup', 'dropoff'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('focus', lazyLoadMaps, { once: true });
  });
});

// Expose for Maps callback
window.initMapsAutocomplete = initMapsAutocomplete;
