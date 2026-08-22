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

// Non-US location keywords for manual input validation
const nonUsKeywords = [
  'brazil', 'brasil', 'sao paulo', 'são paulo', 'rio de janeiro', 'curitiba', 'salvador', 'brasilia', 'brasília',
  'belo horizonte', 'fortaleza', 'manaus', 'recife', 'porto alegre', 'goiania', 'goiânia',
  'canada', 'ontario', 'toronto', 'quebec', 'vancouver', 'montreal', 'calgary',
  'mexico', 'méxico', 'cancun', 'guadalajara', 'monterrey',
  'united kingdom', 'london', 'england', 'uk', 'portugal', 'lisboa', 'porto',
  'argentina', 'buenos aires', 'colombia', 'bogota', 'chile', 'santiago',
  'france', 'paris', 'germany', 'berlin', 'italy', 'rome', 'roma', 'spain', 'madrid', 'barcelona',
  'australia', 'sydney', 'melbourne', 'japan', 'tokyo', 'china', 'beijing', 'shanghai'
];

// Validate individual address field (enforces US locations)
function validateAddressField(input, errorElementId, isSubmitting = false) {
  if (!input) return true;
  const errorEl = document.getElementById(errorElementId);
  const val = input.value.trim();

  // If empty: only show error if user is submitting the form
  if (!val) {
    if (isSubmitting) {
      if (errorEl) {
        errorEl.textContent = currentTranslations['addressRequiredError'] || 'Please enter a location.';
        errorEl.classList.add('is-visible');
      }
      input.classList.add('input-error');
      input.setCustomValidity(currentTranslations['addressRequiredError'] || 'Please enter a location.');
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

  // Check for non-US keywords
  const lower = val.toLowerCase();
  const isNonUs = nonUsKeywords.some(keyword => {
    const regex = new RegExp('\\b' + keyword + '\\b', 'i');
    return regex.test(lower);
  });

  if (isNonUs) {
    const errorMsg = currentTranslations['addressUsOnlyError'] ||
      'We exclusively operate within the United States. Please enter a valid US address.';
    if (errorEl) {
      errorEl.textContent = errorMsg;
      errorEl.classList.add('is-visible');
    }
    input.classList.add('input-error');
    input.setCustomValidity(errorMsg);
    return false;
  }

  // Valid address
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
  }
  input.classList.remove('input-error');
  input.setCustomValidity('');
  return true;
}

// Google Maps Places Autocomplete init - STRICTLY RESTRICTED TO US
function initMapsAutocomplete() {
  if (!window.google || !google.maps || !google.maps.places) return;

  const opts = {
    types: ['establishment', 'geocode'],
    componentRestrictions: { country: 'us' }, // Restricts suggestions strictly to United States
    fields: ['address_components', 'formatted_address', 'geometry', 'name']
  };

  const pickup  = document.getElementById('pickup');
  const dropoff = document.getElementById('dropoff');

  if (pickup) {
    try {
      const autoPickup = new google.maps.places.Autocomplete(pickup, opts);
      autoPickup.addListener('place_changed', function () {
        const place = autoPickup.getPlace();
        handlePlaceSelection(pickup, place, 'pickupError');
      });
    } catch (e) {
      console.warn('Google Places Autocomplete init error for pickup:', e);
    }
  }

  if (dropoff) {
    try {
      const autoDropoff = new google.maps.places.Autocomplete(dropoff, opts);
      autoDropoff.addListener('place_changed', function () {
        const place = autoDropoff.getPlace();
        handlePlaceSelection(dropoff, place, 'dropoffError');
      });
    } catch (e) {
      console.warn('Google Places Autocomplete init error for dropoff:', e);
    }
  }
}

// Suppress Google Maps watermark error popups if domain is not whitelisted
window.gm_authFailure = function () {
  console.warn('Google Maps auth notice: Domain pending Google Cloud Console whitelist. Direct input active.');
  document.querySelectorAll('.pac-container').forEach(el => el.remove());
};

// Verify place returned by Google Autocomplete has US country code
function handlePlaceSelection(input, place, errorElementId) {
  const errorEl = document.getElementById(errorElementId);

  if (!place || !place.address_components) {
    return validateAddressField(input, errorElementId, false);
  }

  const countryComp = place.address_components.find(comp =>
    comp.types && comp.types.includes('country')
  );

  const isUs = countryComp && (countryComp.short_name === 'US' || countryComp.short_name === 'USA');

  if (!isUs) {
    const errorMsg = currentTranslations['addressUsOnlyError'] ||
      'We exclusively operate within the United States. Please enter a valid US address.';
    if (errorEl) {
      errorEl.textContent = errorMsg;
      errorEl.classList.add('is-visible');
    }
    input.classList.add('input-error');
    input.setCustomValidity(errorMsg);
  } else {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
    input.classList.remove('input-error');
    input.setCustomValidity('');
  }
}

// Attach event listeners to address input fields
function initAddressListeners() {
  ['pickup', 'dropoff'].forEach(id => {
    const input = document.getElementById(id);
    const errorId = id + 'Error';
    if (!input) return;

    input.addEventListener('input', function () {
      validateAddressField(input, errorId, false);
    });

    input.addEventListener('blur', function () {
      if (input.value.trim() !== '') {
        validateAddressField(input, errorId, false);
      }
    });
  });
}

// Optional Maps script loader (dormant until domain is explicitly authorized in Google Cloud Console)
function loadMaps() {
  // Kept clean for future Google Cloud Console production deployment
}

function lazyLoadMaps() {
  // No-op to prevent Google Maps API billing error watermark injection
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

// Long-Distance Modal Handlers (110+ Miles Private Trips)
function showLongDistanceModal() {
  const modal = document.getElementById('longDistanceModal');
  if (!modal) return;
  modal.classList.add('is-active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  const editBtn = document.getElementById('longDistanceEditBtn');
  if (editBtn) editBtn.focus();
}

function hideLongDistanceModal() {
  const modal = document.getElementById('longDistanceModal');
  if (!modal) return;
  modal.classList.remove('is-active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

// Detect if a requested trip is a Long-Distance trip (> 110 miles)
function isLongDistanceTrip(pickupText, dropoffText, tripTypeVal) {
  if (tripTypeVal === 'LONG_DISTANCE_TRIP') return true;

  const p = (pickupText || '').toLowerCase().trim();
  const d = (dropoffText || '').toLowerCase().trim();

  if (!p || !d) return false;

  const cities = [
    { name: 'miami', group: 'sofla' },
    { name: 'fort lauderdale', group: 'sofla' },
    { name: 'palm beach', group: 'sofla' },
    { name: 'boca raton', group: 'sofla' },
    { name: 'brickell', group: 'sofla' },
    { name: 'orlando', group: 'cfl' },
    { name: 'disney', group: 'cfl' },
    { name: 'kissimmee', group: 'cfl' },
    { name: 'tampa', group: 'tb' },
    { name: 'st. petersburg', group: 'tb' },
    { name: 'clearwater', group: 'tb' },
    { name: 'naples', group: 'swfl' },
    { name: 'fort myers', group: 'swfl' },
    { name: 'key west', group: 'keys' },
    { name: 'new york', group: 'nyc' },
    { name: 'manhattan', group: 'nyc' },
    { name: 'jfk', group: 'nyc' },
    { name: 'lga', group: 'nyc' },
    { name: 'philadelphia', group: 'philly' },
    { name: 'boston', group: 'bos' },
    { name: 'washington', group: 'dc' },
    { name: 'los angeles', group: 'la' },
    { name: 'lax', group: 'la' },
    { name: 'san francisco', group: 'sf' },
    { name: 'sfo', group: 'sf' },
    { name: 'las vegas', group: 'vegas' },
    { name: 'san diego', group: 'sd' }
  ];

  let pGroup = null;
  let dGroup = null;

  for (const c of cities) {
    if (!pGroup && p.includes(c.name)) pGroup = c.group;
    if (!dGroup && d.includes(c.name)) dGroup = c.group;
  }

  // Cross-metro trips that exceed 110 miles
  if (pGroup && dGroup && pGroup !== dGroup) {
    const longDistancePairs = [
      ['sofla', 'cfl'], ['sofla', 'tb'], ['sofla', 'keys'], ['sofla', 'swfl'],
      ['nyc', 'bos'], ['nyc', 'dc'], ['nyc', 'philly'],
      ['la', 'vegas'], ['la', 'sf']
    ];

    for (const [g1, g2] of longDistancePairs) {
      if ((pGroup === g1 && dGroup === g2) || (pGroup === g2 && dGroup === g1)) {
        return true;
      }
    }
  }

  return false;
}

// Form submission handler with complete validation (Date + Time Availability + Long Distance Check)
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

    // Trip type listener
    const tripTypeSelect = document.getElementById('tripType');
    if (tripTypeSelect) {
      tripTypeSelect.addEventListener('change', function () {
        if (this.value === 'LONG_DISTANCE_TRIP') {
          showLongDistanceModal();
        }
      });
    }

    // Modal close listeners for Busy Modal
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

    // Modal close listeners for Long Distance Modal
    const longDistanceEditBtn = document.getElementById('longDistanceEditBtn');
    if (longDistanceEditBtn) {
      longDistanceEditBtn.addEventListener('click', hideLongDistanceModal);
    }

    const longDistanceModal = document.getElementById('longDistanceModal');
    if (longDistanceModal) {
      longDistanceModal.addEventListener('click', (e) => {
        if (e.target === longDistanceModal) hideLongDistanceModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modal && modal.classList.contains('is-active')) hideBusyModal();
        if (longDistanceModal && longDistanceModal.classList.contains('is-active')) hideLongDistanceModal();
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // 1. Validate Pickup Location (US Only)
      const pickupInput = document.getElementById('pickup');
      if (pickupInput) {
        const isPickupValid = validateAddressField(pickupInput, 'pickupError', true);
        if (!isPickupValid) {
          pickupInput.focus();
          return;
        }
      }

      // 2. Validate Drop-off Location (US Only)
      const dropoffInput = document.getElementById('dropoff');
      if (dropoffInput) {
        const isDropoffValid = validateAddressField(dropoffInput, 'dropoffError', true);
        if (!isDropoffValid) {
          dropoffInput.focus();
          return;
        }
      }

      // 3. Long-Distance Check (>110 miles)
      const tripTypeVal = tripTypeSelect ? tripTypeSelect.value : '';
      if (pickupInput && dropoffInput && isLongDistanceTrip(pickupInput.value, dropoffInput.value, tripTypeVal)) {
        showLongDistanceModal();
        return;
      }

      // 4. Validate Date
      const dateInput = document.getElementById('date');
      if (dateInput) {
        const isDateValid = checkAndDisplayDateError(dateInput);
        if (!isDateValid) {
          dateInput.focus();
          return;
        }
      }

      // 5. Validate Time Slot Availability
      const timeCheck = getTimeSlotAvailability();
      if (timeCheck.status === 'occupied') {
        showBusyModal(timeCheck.titleKey, timeCheck.msgKey);
        return;
      }

      if (timeCheck.status === 'outside_hours') {
        showBusyModal(timeCheck.titleKey, timeCheck.msgKey);
        return;
      }

      // 5. Success
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

  // Handle Request a Service Page Form (Long-Distance 110+ Miles)
  const customServiceForm = document.getElementById('customServiceForm');
  if (customServiceForm) {
    customServiceForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const agree = document.getElementById('reqAgreement');
      if (agree && !agree.checked) {
        alert(currentTranslations['reqConsentTitle'] || 'Please agree to the Terms & Conditions and Privacy Policy.');
        agree.focus();
        return;
      }
      const successMsg = currentTranslations['reqSuccessAlert'] ||
        'Thank you for your request! Our concierge team will review your details and send your customized quote shortly.';
      alert(successMsg);
      customServiceForm.reset();
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

// FAQ Accordion
function initFaqAccordion() {
  const accordion = document.getElementById('faqAccordion');
  if (!accordion) return;

  const items = accordion.querySelectorAll('.faq-item');
  items.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      // Close other open items
      items.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('is-open');
          const otherBtn = otherItem.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current item
      if (isOpen) {
        item.classList.remove('is-open');
        question.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('is-open');
        question.setAttribute('aria-expanded', 'true');
      }
    });
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
  initAddressListeners();
  initMobileMenu();
  initFaqAccordion();

  const dateInput = document.getElementById('date');
  if (dateInput) maskDate(dateInput);
});

// Expose for Maps callback
window.initMapsAutocomplete = initMapsAutocomplete;
