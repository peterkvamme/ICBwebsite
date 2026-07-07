import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase, ref, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

let watchId = null;
let lastPosition = null;
let latestBoatData = null;

let currentState = {
  headline: "Selling now on Gull Lake",
  status: "selling",
  note: "",
  pauseUntil: null
};

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const statusControls = document.getElementById("statusControls");
const trackingStatus = document.getElementById("trackingStatus");
const gpsInfo = document.getElementById("gpsInfo");
const sentInfo = document.getElementById("sentInfo");
const noteInput = document.getElementById("noteInput");
const previewHeadline = document.getElementById("previewHeadline");
const previewArea = document.getElementById("previewArea");
const previewUpdated = document.getElementById("previewUpdated");
const previewNote = document.getElementById("previewNote");
const previewMapsLink = document.getElementById("previewMapsLink");

const boatRef = ref(db, "boat/current");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    document.getElementById("loginMsg").textContent = err.message;
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    loginCard.style.display = "none";
    dashboard.style.display = "block";
    statusControls.style.display = "block";
  }
});

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function getLocationLabel(lat, lng) {
  const landmarks = window.BOAT_LANDMARKS || [];
  if (!landmarks.length) return "near Gull Lake";

  const ranked = landmarks
    .map(landmark => ({
      ...landmark,
      meters: distanceMeters(lat, lng, landmark.lat, landmark.lng)
    }))
    .sort((a, b) => a.meters - b.meters);

  const nearest = ranked[0];
  return nearest.label || `near ${nearest.name}`;
}

function timeAgo(timestamp) {
  if (!timestamp) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function formatClockTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getMapsUrl(lat, lng, updatedAt) {
  const isiPhone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const updateTime = formatClockTime(updatedAt);
  const label = updateTime
    ? `Ice Cream Boat - location at ${updateTime}`
    : "Ice Cream Boat";

  const encodedLabel = encodeURIComponent(label);

  if (isiPhone) {
    return `https://maps.apple.com/?q=${encodedLabel}&ll=${lat},${lng}`;
  }

  return `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
}

function renderCustomerPreview(data) {
  if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") {
    previewHeadline.textContent = data?.headline || "Not available right now";
    previewArea.textContent = "Check back soon.";
    previewUpdated.textContent = "";
    previewNote.textContent = data?.note || "";
    previewMapsLink.style.display = "none";
    return;
  }

  const locationUpdatedAt = data.locationUpdatedAt || data.updatedAt;
  previewHeadline.textContent = data.headline || "Selling now on Gull Lake";
  previewArea.textContent = `📍 ${getLocationLabel(data.lat, data.lng)}`;
  previewUpdated.textContent = timeAgo(locationUpdatedAt);
  previewNote.textContent = data.note || "";
  previewMapsLink.href = getMapsUrl(data.lat, data.lng, locationUpdatedAt);
  previewMapsLink.style.display = "flex";
}

onValue(boatRef, snapshot => {
  latestBoatData = snapshot.val();
  renderCustomerPreview(latestBoatData);
});

setInterval(() => renderCustomerPreview(latestBoatData), 30000);

function buildStatusPayload() {
  return {
    headline: currentState.headline,
    status: currentState.status,
    note: currentState.note,
    pauseUntil: currentState.pauseUntil,
    statusUpdatedAt: Date.now()
  };
}

function buildLocationPayload(position = lastPosition) {
  const now = Date.now();
  const payload = {
    ...buildStatusPayload(),
    updatedAt: now,
    locationUpdatedAt: now
  };

  if (position) {
    payload.lat = position.coords.latitude;
    payload.lng = position.coords.longitude;
    payload.accuracy = position.coords.accuracy;
  }
  return payload;
}

async function sendLocationUpdate(position = lastPosition) {
  const payload = buildLocationPayload(position);
  await update(boatRef, payload);

  trackingStatus.textContent = "Tracking active";
  sentInfo.textContent = `Last location sent: ${new Date().toLocaleTimeString()}`;

  if (position) {
    gpsInfo.textContent = `GPS accuracy: ${Math.round(position.coords.accuracy)} meters`;
  }
}

async function sendStatusUpdate() {
  const typedNote = noteInput.value.trim();
  if (typedNote || currentState.status !== "done") {
    currentState.note = typedNote;
  }

  const payload = buildStatusPayload();
  await update(boatRef, payload);
  renderCustomerPreview({ ...(latestBoatData || {}), ...payload });
  sentInfo.textContent = `Last status sent: ${new Date().toLocaleTimeString()}`;
}

document.getElementById("startBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    trackingStatus.textContent = "Geolocation is not supported on this device.";
    return;
  }

  if (watchId !== null) return;
  trackingStatus.textContent = "Tracking active";

  watchId = navigator.geolocation.watchPosition(
    async position => {
      lastPosition = position;
      await sendLocationUpdate(position);
    },
    error => {
      trackingStatus.textContent = `GPS error: ${error.message}`;
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
});

document.getElementById("stopBtn").addEventListener("click", async () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  currentState = {
    headline: "Not selling today",
    status: "done",
    note: noteInput.value.trim() || "Location sharing is off.",
    pauseUntil: null
  };
  await sendStatusUpdate();
  trackingStatus.textContent = "Not tracking";
});

document.querySelectorAll("[data-headline]").forEach(button => {
  button.addEventListener("click", () => {
    currentState.headline = button.dataset.headline;
    currentState.status = button.dataset.status;
    currentState.pauseUntil = null;

    document.querySelectorAll("[data-headline]").forEach(option => {
      option.classList.toggle("selected", option === button);
    });
  });
});

document.getElementById("saveStatusAnnouncementBtn").addEventListener("click", sendStatusUpdate);

noteInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("saveStatusAnnouncementBtn").click();
  }
});
