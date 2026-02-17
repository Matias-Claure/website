const adminLoginForm = document.getElementById("admin-login-form");
const adminPasscodeInput = document.getElementById("admin-passcode");
const adminStatus = document.getElementById("admin-status");
const adminControls = document.getElementById("admin-controls");
const adminSearch = document.getElementById("admin-search");
const adminBookingBody = document.getElementById("admin-booking-body");
const clearBookingsBtn = document.getElementById("clear-bookings-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const bookingAPI = window.NorthlineBookingAPI;

async function renderAdminBookings() {
  const query = adminSearch.value.trim().toLowerCase();
  const bookings = (await bookingAPI.getSortedBookings()).filter((booking) => {
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
      bookingAPI.formatDateTime(booking.date, booking.time),
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
  return bookingAPI.isAdminUnlocked();
}

async function renderAdminState() {
  const unlocked = isAdminUnlocked();
  adminControls.classList.toggle("hidden", !unlocked);
  adminLoginForm.classList.toggle("hidden", unlocked);

  if (unlocked) {
    adminStatus.textContent = "";
    await renderAdminBookings();
  } else {
    adminPasscodeInput.value = "";
    adminSearch.value = "";
  }
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminStatus.textContent = "";

  const unlocked = await bookingAPI.unlockAdmin(adminPasscodeInput.value);
  if (!unlocked.ok) {
    adminStatus.textContent = unlocked.message;
    return;
  }

  await renderAdminState();
});

adminLogoutBtn.addEventListener("click", async () => {
  bookingAPI.lockAdmin();
  await renderAdminState();
});

adminSearch.addEventListener("input", async () => {
  await renderAdminBookings();
});

clearBookingsBtn.addEventListener("click", async () => {
  const confirmed = window.confirm("Delete all bookings?");
  if (!confirmed) {
    return;
  }

  const result = await bookingAPI.clearBookings(bookingAPI.ADMIN_PASSCODE);
  if (!result.ok) {
    adminStatus.textContent = result.message;
  }
  await renderAdminBookings();
});

adminBookingBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.dataset.id) {
    return;
  }

  const result = await bookingAPI.deleteBookingById(target.dataset.id, bookingAPI.ADMIN_PASSCODE);
  if (!result.ok) {
    adminStatus.textContent = result.message;
  }
  await renderAdminBookings();
});

renderAdminState();
