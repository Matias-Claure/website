const adminLoginForm = document.getElementById("admin-login-form");
const adminPasscodeInput = document.getElementById("admin-passcode");
const adminStatus = document.getElementById("admin-status");
const adminControls = document.getElementById("admin-controls");
const adminSearch = document.getElementById("admin-search");
const adminBookingBody = document.getElementById("admin-booking-body");
const clearBookingsBtn = document.getElementById("clear-bookings-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");

const STORAGE_KEY = "northline_bookings";
const ADMIN_SESSION_KEY = "northline_admin_unlocked";
const ADMIN_PASSCODE = "admin123";

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

function formatDateTime(dateStr, timeStr) {
  const date = new Date(`${dateStr}T${timeStr}`);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSortedBookings() {
  return loadBookings()
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

function renderAdminBookings() {
  const query = adminSearch.value.trim().toLowerCase();
  const bookings = getSortedBookings().filter((booking) => {
    if (!query) {
      return true;
    }

    return [booking.name, booking.service, booking.email, booking.phone]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  adminBookingBody.innerHTML = "";

  if (!bookings.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No matching bookings.";
    row.appendChild(cell);
    adminBookingBody.appendChild(row);
    return;
  }

  bookings.forEach((booking) => {
    const row = document.createElement("tr");
    const values = [
      booking.name,
      booking.service,
      formatDateTime(booking.date, booking.time),
      booking.email,
      booking.phone,
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "table-action";
    deleteBtn.dataset.id = booking.id;
    deleteBtn.textContent = "Delete";
    actionCell.appendChild(deleteBtn);
    row.appendChild(actionCell);
    adminBookingBody.appendChild(row);
  });
}

function isAdminUnlocked() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

function setAdminUnlocked(value) {
  if (value) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

function renderAdminState() {
  const unlocked = isAdminUnlocked();
  adminControls.classList.toggle("hidden", !unlocked);
  adminLoginForm.classList.toggle("hidden", unlocked);

  if (unlocked) {
    adminStatus.textContent = "";
    renderAdminBookings();
  } else {
    adminPasscodeInput.value = "";
    adminSearch.value = "";
  }
}

adminLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminStatus.textContent = "";

  if (adminPasscodeInput.value !== ADMIN_PASSCODE) {
    adminStatus.textContent = "Incorrect passcode.";
    return;
  }

  setAdminUnlocked(true);
  renderAdminState();
});

adminLogoutBtn.addEventListener("click", () => {
  setAdminUnlocked(false);
  renderAdminState();
});

adminSearch.addEventListener("input", () => {
  renderAdminBookings();
});

clearBookingsBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Delete all bookings?");
  if (!confirmed) {
    return;
  }

  saveBookings([]);
  renderAdminBookings();
});

adminBookingBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.dataset.id) {
    return;
  }

  const bookings = loadBookings().filter((booking) => booking.id !== target.dataset.id);
  saveBookings(bookings);
  renderAdminBookings();
});

saveBookings(loadBookings());
renderAdminState();
