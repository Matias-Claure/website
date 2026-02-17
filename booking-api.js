(function initNorthlineBookingAPI(global) {
  const STORAGE_KEY = "northline_bookings";
  const ADMIN_SESSION_KEY = "northline_admin_unlocked";
  const ADMIN_PASSCODE = "admin123";
  const SERVICES = [
    "Consultation",
    "Follow-up Session",
    "Premium Planning",
    "Virtual Meeting",
  ];
  const PHONE_PATTERN = /^[0-9+()\-\s]{7,}$/;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_PATTERN = /^\d{2}:\d{2}$/;

  function loadBookings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
      return parsed.map((booking) => ({
        ...booking,
        id: booking.id || crypto.randomUUID(),
      }));
    } catch {
      return [];
    }
  }

  function saveBookings(bookings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  }

  function getSortedBookings() {
    return loadBookings()
      .slice()
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }

  function formatDateTime(dateStr, timeStr) {
    const date = new Date(`${dateStr}T${timeStr}`);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function isBusinessHours(timeStr) {
    if (!TIME_PATTERN.test(timeStr)) {
      return false;
    }
    const [hour, minute] = timeStr.split(":").map(Number);
    const totalMinutes = hour * 60 + minute;
    const open = 9 * 60;
    const close = 17 * 60;
    return totalMinutes >= open && totalMinutes <= close;
  }

  function validateBooking(input = {}) {
    const errors = {};

    const booking = {
      id: input.id || crypto.randomUUID(),
      name: String(input.name || "").trim(),
      email: String(input.email || "").trim(),
      phone: String(input.phone || "").trim(),
      service: String(input.service || ""),
      date: String(input.date || ""),
      time: String(input.time || ""),
      notes: String(input.notes || "").trim(),
    };

    if (booking.name.length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }
    if (!booking.email || !booking.email.includes("@")) {
      errors.email = "Email must be valid.";
    }
    if (!PHONE_PATTERN.test(booking.phone)) {
      errors.phone = "Phone must match [0-9+()\\-\\s]{7,}.";
    }
    if (!SERVICES.includes(booking.service)) {
      errors.service = `Service must be one of: ${SERVICES.join(", ")}.`;
    }
    if (!DATE_PATTERN.test(booking.date)) {
      errors.date = "Date must use YYYY-MM-DD.";
    }
    if (!TIME_PATTERN.test(booking.time)) {
      errors.time = "Time must use HH:MM.";
    }
    if (!errors.time && !isBusinessHours(booking.time)) {
      errors.time = "Time must be between 09:00 and 17:00.";
    }

    if (!errors.date && !errors.time) {
      const selectedDate = new Date(`${booking.date}T${booking.time}`);
      if (Number.isNaN(selectedDate.getTime())) {
        errors.date = "Date/time is not valid.";
      } else if (selectedDate <= new Date()) {
        errors.date_time = "Date/time must be in the future.";
      }
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      booking,
    };
  }

  function createBooking(input) {
    const validation = validateBooking(input);
    if (!validation.ok) {
      return validation;
    }

    const bookings = loadBookings();
    bookings.push(validation.booking);
    saveBookings(bookings);

    return {
      ok: true,
      booking: validation.booking,
      message: `Booked for ${formatDateTime(validation.booking.date, validation.booking.time)}.`,
    };
  }

  function deleteBookingById(id) {
    const bookingId = String(id || "");
    if (!bookingId) {
      return { ok: false, message: "Booking id is required." };
    }

    const before = loadBookings();
    const after = before.filter((booking) => booking.id !== bookingId);
    saveBookings(after);

    return {
      ok: before.length !== after.length,
      message:
        before.length !== after.length ? "Booking deleted." : "No booking matched the id.",
    };
  }

  function clearBookings() {
    saveBookings([]);
    return { ok: true, message: "All bookings removed." };
  }

  function isAdminUnlocked() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  }

  function unlockAdmin(passcode) {
    const isValid = String(passcode || "") === ADMIN_PASSCODE;
    if (isValid) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      return { ok: true, unlocked: true };
    }
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return { ok: false, unlocked: false, message: "Incorrect passcode." };
  }

  function lockAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return { ok: true, unlocked: false };
  }

  function getSpec() {
    return {
      api_name: "NorthlineBookingAPI",
      version: "1.1.0",
      storage_key: STORAGE_KEY,
      methods: {
        create_booking: "NorthlineBookingAPI.createBooking(payload)",
        list_bookings: "NorthlineBookingAPI.getSortedBookings()",
        validate_booking: "NorthlineBookingAPI.validateBooking(payload)",
        delete_booking: "NorthlineBookingAPI.deleteBookingById(id)",
      },
      booking_fields: {
        required: ["name", "email", "phone", "service", "date", "time"],
        optional: ["notes"],
      },
      service_enum: SERVICES.slice(),
      constraints: {
        phone_pattern: "[0-9+()\\-\\s]{7,}",
        date_format: "YYYY-MM-DD",
        time_format: "HH:MM",
        business_hours_local: "09:00-17:00",
        date_time_must_be_future: true,
      },
    };
  }

  global.NorthlineBookingAPI = {
    STORAGE_KEY,
    ADMIN_PASSCODE,
    SERVICES,
    loadBookings,
    saveBookings,
    getSortedBookings,
    formatDateTime,
    validateBooking,
    createBooking,
    deleteBookingById,
    clearBookings,
    isAdminUnlocked,
    unlockAdmin,
    lockAdmin,
    getSpec,
  };

  saveBookings(loadBookings());
})(window);
