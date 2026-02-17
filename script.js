const form = document.getElementById("booking-form");
const statusEl = document.getElementById("form-status");
const bookingList = document.getElementById("booking-list");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

const STORAGE_KEY = "northline_bookings";

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
if (dateInput) {
  dateInput.min = `${yyyy}-${mm}-${dd}`;
}

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

function renderBookings() {
  if (!bookingList) {
    return;
  }

  const bookings = getSortedBookings();
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
    meta.textContent = `${formatDateTime(booking.date, booking.time)} | ${booking.email}`;

    li.append(title, meta);
    bookingList.appendChild(li);
  });
}

function isBusinessHours(timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  const totalMinutes = hour * 60 + minute;
  const open = 9 * 60;
  const close = 17 * 60;
  return totalMinutes >= open && totalMinutes <= close;
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    statusEl.textContent = "";

    if (!form.checkValidity()) {
      statusEl.textContent = "Please complete all required fields correctly.";
      form.reportValidity();
      return;
    }

    if (!isBusinessHours(timeInput.value)) {
      statusEl.textContent = "Please select a time between 9:00 AM and 5:00 PM.";
      return;
    }

    const data = new FormData(form);
    const booking = {
      id: crypto.randomUUID(),
      name: data.get("name").toString().trim(),
      email: data.get("email").toString().trim(),
      phone: data.get("phone").toString().trim(),
      service: data.get("service").toString(),
      date: data.get("date").toString(),
      time: data.get("time").toString(),
      notes: data.get("notes").toString().trim(),
    };

    const selectedDate = new Date(`${booking.date}T${booking.time}`);
    if (selectedDate <= new Date()) {
      statusEl.textContent = "Please choose a future date and time.";
      return;
    }

    const bookings = loadBookings();
    bookings.push(booking);
    saveBookings(bookings);

    statusEl.textContent = `Booked for ${formatDateTime(booking.date, booking.time)}.`;
    form.reset();
    dateInput.min = `${yyyy}-${mm}-${dd}`;
    renderBookings();
  });
}

saveBookings(loadBookings());
renderBookings();
