const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "127.0.0.1";
const BASE_DIR = process.cwd();
const DATA_DIR = path.join(BASE_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "admin123";

const SERVICES = [
  "Consultation",
  "Follow-up Session",
  "Premium Planning",
  "Virtual Meeting",
];
const PHONE_PATTERN = /^[0-9+()\-\s]{7,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

ensureDataStore();

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readBookings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((booking) => ({
      ...booking,
      id: booking.id || randomUUID(),
    }));
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2), "utf8");
}

function sortBookings(bookings) {
  return bookings
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
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
    id: String(input.id || randomUUID()),
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

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function serveStatic(req, res) {
  const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const normalized = reqPath === "/" ? "/index.html" : reqPath;
  const absolutePath = path.resolve(BASE_DIR, `.${normalized}`);

  if (!absolutePath.startsWith(BASE_DIR)) {
    sendJson(res, 403, { ok: false, message: "Forbidden." });
    return;
  }

  fs.stat(absolutePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendJson(res, 404, { ok: false, message: "Not found." });
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

function isAuthorized(req) {
  const provided = req.headers["x-admin-passcode"];
  return String(provided || "") === ADMIN_PASSCODE;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const urlPath = (req.url || "/").split("?")[0];

  if (method === "GET" && urlPath === "/api/bookings") {
    sendJson(res, 200, { ok: true, bookings: sortBookings(readBookings()) });
    return;
  }

  if (method === "POST" && urlPath === "/api/bookings") {
    try {
      const payload = await parseBody(req);
      const validated = validateBooking(payload);
      if (!validated.ok) {
        sendJson(res, 422, { ok: false, errors: validated.errors });
        return;
      }

      const bookings = readBookings();
      bookings.push(validated.booking);
      writeBookings(bookings);

      sendJson(res, 201, {
        ok: true,
        booking: validated.booking,
        message: "Booking created.",
      });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, message: error.message });
      return;
    }
  }

  if (method === "DELETE" && urlPath.startsWith("/api/bookings/")) {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, message: "Admin passcode required." });
      return;
    }

    const id = decodeURIComponent(urlPath.replace("/api/bookings/", "")).trim();
    if (!id) {
      sendJson(res, 400, { ok: false, message: "Booking id is required." });
      return;
    }

    const before = readBookings();
    const after = before.filter((booking) => booking.id !== id);
    writeBookings(after);

    sendJson(res, 200, {
      ok: before.length !== after.length,
      message: before.length !== after.length ? "Booking deleted." : "No booking matched the id.",
    });
    return;
  }

  if (method === "DELETE" && urlPath === "/api/bookings") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, message: "Admin passcode required." });
      return;
    }
    writeBookings([]);
    sendJson(res, 200, { ok: true, message: "All bookings removed." });
    return;
  }

  if (method === "POST" && urlPath === "/api/admin/unlock") {
    try {
      const payload = await parseBody(req);
      const passcode = String(payload.passcode || "");
      if (passcode !== ADMIN_PASSCODE) {
        sendJson(res, 401, { ok: false, message: "Incorrect passcode." });
        return;
      }
      sendJson(res, 200, { ok: true, unlocked: true });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, message: error.message });
      return;
    }
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Northline server running at http://${HOST}:${PORT}`);
});
