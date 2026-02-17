const form = document.getElementById("booking-form");
const statusEl = document.getElementById("form-status");
const bookingList = document.getElementById("booking-list");
const dateInput = document.getElementById("date");
const bookingAPI = window.NorthlineBookingAPI;

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
if (dateInput) {
  dateInput.min = `${yyyy}-${mm}-${dd}`;
}

async function renderBookings() {
  if (!bookingList) {
    return;
  }

  const bookings = await bookingAPI.getSortedBookings();
  bookingList.innerHTML = "";

  if (!bookings.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No appointments booked yet.";
    bookingList.appendChild(emptyItem);
    return;
  }

  bookings.forEach((booking) => {
    const li = document.createElement("li");
    const title = document.createElement("p");
    const meta = document.createElement("p");

    title.className = "booking-title";
    title.textContent = `${booking.name} - ${booking.service}`;
    meta.className = "booking-meta";
    meta.textContent = `${bookingAPI.formatDateTime(booking.date, booking.time)} | ${booking.email}`;

    li.append(title, meta);
    bookingList.appendChild(li);
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.textContent = "";

    if (!form.checkValidity()) {
      statusEl.textContent = "Please complete all required fields correctly.";
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const bookingInput = {
      name: data.get("name").toString().trim(),
      email: data.get("email").toString().trim(),
      phone: data.get("phone").toString().trim(),
      service: data.get("service").toString(),
      date: data.get("date").toString(),
      time: data.get("time").toString(),
      notes: data.get("notes").toString().trim(),
    };

    const created = await bookingAPI.createBooking(bookingInput);
    if (!created.ok) {
      const errors = created.errors || {};
      statusEl.textContent =
        created.message ||
        errors.time ||
        errors.date_time ||
        errors.date ||
        errors.service ||
        errors.email ||
        errors.phone ||
        errors.name ||
        "Please complete all required fields correctly.";
      return;
    }

    statusEl.textContent = created.message;
    form.reset();
    dateInput.min = `${yyyy}-${mm}-${dd}`;
    await renderBookings();
  });
}

renderBookings();
