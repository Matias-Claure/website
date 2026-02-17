(function initNorthlineBookingAPI(global) {
  const ADMIN_SESSION_KEY = "northline_admin_unlocked";
  const ADMIN_PASSCODE = "admin123";
  const API_BASE = "/api";
  const SERVICES = [
    "Consultation",
    "Follow-up Session",
    "Premium Planning",
    "Virtual Meeting",
  ];
  const PHONE_PATTERN = /^[0-9+()\-\s]{7,}$/;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_PATTERN = /^\d{2}:\d{2}$/;

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, ...data };
    }
    return data;
  }

  async function getSortedBookings() {
    const response = await apiRequest("/bookings", { method: "GET" });
    if (!response.ok) {
      return [];
    }
    return Array.isArray(response.bookings) ? response.bookings : [];
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

  async function createBooking(input) {
    const validation = validateBooking(input);
    if (!validation.ok) {
      return validation;
    }

    const response = await apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(validation.booking),
    });

    if (!response.ok) {
      return {
        ok: false,
        errors: response.errors || {},
        message: response.message || "Unable to create booking.",
      };
    }

    return {
      ok: true,
      booking: response.booking,
      message: `Booked for ${formatDateTime(response.booking.date, response.booking.time)}.`,
    };
  }

  async function deleteBookingById(id, passcode = ADMIN_PASSCODE) {
    const bookingId = String(id || "");
    if (!bookingId) {
      return { ok: false, message: "Booking id is required." };
    }

    const response = await apiRequest(`/bookings/${encodeURIComponent(bookingId)}`, {
      method: "DELETE",
      headers: { "x-admin-passcode": passcode },
    });
    return response.ok
      ? response
      : { ok: false, message: response.message || "Unable to delete booking." };
  }

  async function clearBookings(passcode = ADMIN_PASSCODE) {
    const response = await apiRequest("/bookings", {
      method: "DELETE",
      headers: { "x-admin-passcode": passcode },
    });
    return response.ok
      ? response
      : { ok: false, message: response.message || "Unable to clear bookings." };
  }

  function isAdminUnlocked() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  }

  async function unlockAdmin(passcode) {
    const response = await apiRequest("/admin/unlock", {
      method: "POST",
      body: JSON.stringify({ passcode: String(passcode || "") }),
    });
    if (response.ok) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      return { ok: true, unlocked: true };
    }
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return { ok: false, unlocked: false, message: response.message || "Incorrect passcode." };
  }

  function lockAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return { ok: true, unlocked: false };
  }

  function getSpec() {
    return {
      api_name: "NorthlineBookingAPI",
      version: "2.0.0",
      transport: "http_json",
      api_base: API_BASE,
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
    ADMIN_PASSCODE,
    SERVICES,
    API_BASE,
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
})(window);
