import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase, ref, update, onValue, push, get } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

let watchId = null;
let lastPosition = null;
let latestBoatData = null;
let locationSendTimer = null;
let isSendingLocation = false;
let wakeLock = null;
const LOCATION_SEND_INTERVAL_MS = 10000;
const HISTORY_MIN_INTERVAL_MS = 2 * 60 * 1000;
const HISTORY_DISTANCE_METERS = 200 * 0.3048;
const HISTORY_MAX_MOVEMENT_ACCURACY_METERS = 50;
const LOCAL_GPS_HISTORY_KEY = "iceCreamBoatGpsHistoryV1";

let currentState = {
  headline: "Selling now on Gull Lake!",
  status: "selling",
  note: "",
  pauseUntil: null
};

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const captainPreview = document.getElementById("captainPreview");
const statusControls = document.getElementById("statusControls");
const trackingStatus = document.getElementById("trackingStatus");
const gpsInfo = document.getElementById("gpsInfo");
const sentInfo = document.getElementById("sentInfo");
const customStatusInput = document.getElementById("customStatusInput");
const noteInput = document.getElementById("noteInput");
const previewHeadline = document.getElementById("previewHeadline");
const previewArea = document.getElementById("previewArea");
const previewUpdated = document.getElementById("previewUpdated");
const previewNote = document.getElementById("previewNote");
const previewMapsLink = document.getElementById("previewMapsLink");
const toggleLocationVisibilityBtn = document.getElementById("toggleLocationVisibilityBtn");
const downloadGpsHistoryBtn = document.getElementById("downloadGpsHistoryBtn");

const boatRef = ref(db, "boat/current");
let lastSavedHistoryPoint = null;

function isLocationVisible(data = latestBoatData) {
  return data?.showLocation !== false;
}

function updateLocationVisibilityButton(data = latestBoatData) {
  if (!toggleLocationVisibilityBtn) return;

  const visible = isLocationVisible(data);
  toggleLocationVisibilityBtn.textContent = visible
    ? "Hide Location from Customers"
    : "Show Location to Customers";
  toggleLocationVisibilityBtn.classList.toggle("location-hidden", !visible);
}

function updateTrackingBanner() {
  const isTracking = watchId !== null;
  trackingStatus.textContent = isTracking
    ? "Captain Dashboard — Tracking"
    : "Captain Dashboard — Not Tracking";
  dashboard.classList.toggle("tracking-on", isTracking);
  dashboard.classList.toggle("tracking-off", !isTracking);
}

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
    captainPreview.style.display = "block";
    dashboard.style.display = "block";
    statusControls.style.display = "block";
    updateTrackingBanner();
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

function getLocalDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getHistorySaveReason(position, timestamp) {
  if (!position) return null;

  const currentPoint = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp
  };

  if (!lastSavedHistoryPoint) {
    return { reason: "first", distanceMeters: 0 };
  }

  const elapsedMs = timestamp - lastSavedHistoryPoint.timestamp;
  if (elapsedMs >= HISTORY_MIN_INTERVAL_MS) {
    return { reason: "time", distanceMeters: null };
  }

  const currentAccuracy = Number(currentPoint.accuracy);
  const lastAccuracy = Number(lastSavedHistoryPoint.accuracy);
  const hasGoodMovementAccuracy =
    Number.isFinite(currentAccuracy) && currentAccuracy <= HISTORY_MAX_MOVEMENT_ACCURACY_METERS &&
    Number.isFinite(lastAccuracy) && lastAccuracy <= HISTORY_MAX_MOVEMENT_ACCURACY_METERS;

  if (!hasGoodMovementAccuracy) {
    return null;
  }

  const distance = distanceMeters(
    lastSavedHistoryPoint.lat,
    lastSavedHistoryPoint.lng,
    currentPoint.lat,
    currentPoint.lng
  );

  if (distance >= HISTORY_DISTANCE_METERS) {
    return { reason: "distance", distanceMeters: Math.round(distance) };
  }

  return null;
}

function buildHistoryPayload(position, timestamp, saveReason) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp,
    savedAt: timestamp,
    dateKey: getLocalDateKey(timestamp),
    saveReason: saveReason.reason,
    distanceMeters: saveReason.distanceMeters,
    headline: currentState.headline,
    status: currentState.status
  };
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
  if (!data || data.showLocation === false || typeof data.lat !== "number" || typeof data.lng !== "number") {
    previewHeadline.textContent = data?.headline || "Not available right now";
    previewArea.textContent = data?.showLocation === false ? "" : "Check back soon.";
    previewUpdated.textContent = "";
    previewNote.textContent = data?.note || "";
    previewMapsLink.style.display = "none";
    return;
  }

  const locationUpdatedAt = data.locationUpdatedAt || data.updatedAt;
  previewHeadline.textContent = data.headline || "Selling now on Gull Lake!";
  previewArea.textContent = `📍 ${getLocationLabel(data.lat, data.lng)}`;
  previewUpdated.textContent = timeAgo(locationUpdatedAt);
  previewNote.textContent = data.note || "";
  previewMapsLink.href = getMapsUrl(data.lat, data.lng, locationUpdatedAt);
  previewMapsLink.style.display = "flex";
}

onValue(boatRef, snapshot => {
  latestBoatData = snapshot.val();
  updateLocationVisibilityButton(latestBoatData);
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
  const now = payload.locationUpdatedAt || Date.now();

  await update(boatRef, payload);

  const historySaveReason = getHistorySaveReason(position, now);
  let historyPayload = null;
  let historyStatusText = "; history not needed yet";

  if (historySaveReason) {
    const dateKey = getLocalDateKey(now);
    const historyRef = push(ref(db, `boat/locationHistory/${dateKey}`));
    historyPayload = buildHistoryPayload(position, now, historySaveReason);

    try {
      await update(historyRef, historyPayload);
      historyStatusText = `; Firebase history saved (${historyPayload.saveReason})`;
      lastSavedHistoryPoint = {
        lat: historyPayload.lat,
        lng: historyPayload.lng,
        accuracy: historyPayload.accuracy,
        timestamp: historyPayload.timestamp
      };
    } catch (historyErr) {
      console.warn("Firebase GPS history write failed; saved local backup only", historyErr);
      saveLocalGpsHistoryPoint(historyPayload, historyRef.key);
      historyStatusText = "; Firebase history write blocked — saved local backup only";
    }
  }

  updateTrackingBanner();
  sentInfo.textContent = `Last location sent: ${new Date().toLocaleTimeString()}`;

  if (position) {
    gpsInfo.textContent = `GPS accuracy: ${Math.round(position.coords.accuracy)} meters${historyStatusText}`;
  }
}
function scheduleNextLocationSend(delayMs = LOCATION_SEND_INTERVAL_MS) {
  if (locationSendTimer !== null) {
    clearTimeout(locationSendTimer);
  }

  locationSendTimer = setTimeout(async () => {
    if (watchId === null) {
      locationSendTimer = null;
      return;
    }

    if (lastPosition && !isSendingLocation) {
      isSendingLocation = true;
      try {
        await sendLocationUpdate(lastPosition);
      } finally {
        isSendingLocation = false;
      }
    }

    if (watchId !== null) {
      scheduleNextLocationSend();
    }
  }, delayMs);
}

async function requestLocationWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock !== null) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch (err) {
    wakeLock = null;
  }
}

async function releaseLocationWakeLock() {
  if (!wakeLock) return;

  try {
    await wakeLock.release();
  } catch (err) {
    // No action needed if the browser already released it.
  } finally {
    wakeLock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && watchId !== null) {
    requestLocationWakeLock();
  }
});


function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function flattenHistorySnapshot(history) {
  const rows = [];

  Object.entries(history || {}).forEach(([dateKey, points]) => {
    Object.entries(points || {}).forEach(([id, point]) => {
      if (!point || typeof point !== "object") return;
      rows.push({ id, dateKey, ...point });
    });
  });

  return rows.sort((a, b) => Number(a.timestamp || a.savedAt || 0) - Number(b.timestamp || b.savedAt || 0));
}

function formatCsvTimestamp(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return timestamp || "";
  return new Date(numericTimestamp).toISOString();
}

function readLocalGpsHistory() {
  try {
    const raw = localStorage.getItem(LOCAL_GPS_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Unable to read local GPS history backup", err);
    return [];
  }
}

function writeLocalGpsHistory(rows) {
  try {
    localStorage.setItem(LOCAL_GPS_HISTORY_KEY, JSON.stringify(rows));
  } catch (err) {
    console.warn("Unable to write local GPS history backup", err);
  }
}

function saveLocalGpsHistoryPoint(point, id = "local") {
  if (!point) return;

  const rows = readLocalGpsHistory();
  rows.push({
    id,
    dateKey: point.dateKey || getLocalDateKey(point.timestamp || point.savedAt || Date.now()),
    ...point
  });

  const newestRows = rows
    .filter(row => row && Number.isFinite(Number(row.timestamp || row.savedAt)))
    .sort((a, b) => Number(a.timestamp || a.savedAt || 0) - Number(b.timestamp || b.savedAt || 0))
    .slice(-5000);

  writeLocalGpsHistory(newestRows);
}

async function downloadGpsHistoryCsv() {
  if (!downloadGpsHistoryBtn) return;

  const originalText = downloadGpsHistoryBtn.textContent;
  downloadGpsHistoryBtn.disabled = true;
  downloadGpsHistoryBtn.textContent = "Reading Firebase GPS history...";

  try {
    let historyRows = [];
    let firebaseReadFailed = false;

    try {
      const snapshot = await get(ref(db, "boat/locationHistory"));
      historyRows = flattenHistorySnapshot(snapshot.val());
    } catch (firebaseErr) {
      firebaseReadFailed = true;
      console.warn("Firebase GPS history read failed", firebaseErr);
    }

    if (!historyRows.length) {
      const localRows = readLocalGpsHistory();
      if (localRows.length) {
        historyRows = localRows;
      }
    }

    historyRows = historyRows
      .filter(point => point && point.lat !== undefined && point.lng !== undefined)
      .sort((a, b) => Number(a.timestamp || a.savedAt || 0) - Number(b.timestamp || b.savedAt || 0));

    if (!historyRows.length) {
      downloadGpsHistoryBtn.textContent = firebaseReadFailed
        ? "Firebase history read blocked"
        : "No GPS history found";
      setTimeout(() => {
        downloadGpsHistoryBtn.textContent = originalText;
        downloadGpsHistoryBtn.disabled = false;
      }, 3500);
      return;
    }

    const csvRows = [[
      "timestamp",
      "latitude",
      "longitude",
      "lat",
      "lng",
      "accuracy",
      "accuracyMeters",
      "dateKey",
      "headline",
      "status",
      "saveReason",
      "distanceMeters",
      "firebaseId"
    ]];

    historyRows.forEach(point => {
      csvRows.push([
        formatCsvTimestamp(point.timestamp || point.savedAt),
        point.lat ?? "",
        point.lng ?? "",
        point.lat ?? "",
        point.lng ?? "",
        point.accuracy ?? "",
        point.accuracy ?? "",
        point.dateKey ?? "",
        point.headline ?? "",
        point.status ?? "",
        point.saveReason ?? "",
        point.distanceMeters ?? "",
        point.id ?? ""
      ]);
    });

    const today = getLocalDateKey();
    downloadCsv(`ice-cream-boat-gps-history-${today}.csv`, csvRows);
    downloadGpsHistoryBtn.textContent = originalText;
    downloadGpsHistoryBtn.disabled = false;
  } catch (err) {
    console.error(err);
    downloadGpsHistoryBtn.textContent = "GPS download failed";
    setTimeout(() => {
      downloadGpsHistoryBtn.textContent = originalText;
      downloadGpsHistoryBtn.disabled = false;
    }, 3000);
  }
}

async function sendStatusUpdate() {
  const typedStatus = customStatusInput.value.trim();
  const typedNote = noteInput.value.trim();

  currentState.headline = typedStatus || currentState.headline || "Selling now on Gull Lake!";
  currentState.note = typedNote;

  const payload = buildStatusPayload();
  latestBoatData = { ...(latestBoatData || {}), ...payload };
  updateLocationVisibilityButton(latestBoatData);
  renderCustomerPreview(latestBoatData);
  await update(boatRef, payload);
}

document.getElementById("startBtn").addEventListener("click", async () => {
  if (!navigator.geolocation) {
    updateTrackingBanner();
    gpsInfo.textContent = "Geolocation is not supported on this device.";
    return;
  }

  if (watchId !== null) return;

  await requestLocationWakeLock();

  watchId = navigator.geolocation.watchPosition(
    async position => {
      const isFirstFix = lastPosition === null;
      lastPosition = position;

      if (isFirstFix) {
        await sendLocationUpdate(position);
        scheduleNextLocationSend();
      }
    },
    error => {
      gpsInfo.textContent = `GPS error: ${error.message}`;
      updateTrackingBanner();
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );


  updateTrackingBanner();
});

document.getElementById("stopBtn").addEventListener("click", async () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    updateTrackingBanner();
  }

  if (locationSendTimer !== null) {
    clearTimeout(locationSendTimer);
    locationSendTimer = null;
  }

  await releaseLocationWakeLock();

  currentState = {
    headline: "Done for the day, see you again soon",
    status: "done",
    note: noteInput.value.trim() || "Location sharing is off.",
    pauseUntil: null
  };
  customStatusInput.value = currentState.headline;
  await sendStatusUpdate();
  updateTrackingBanner();
});

document.querySelectorAll("[data-headline]").forEach(button => {
  button.addEventListener("click", () => {
    currentState.headline = button.dataset.headline;
    currentState.status = button.dataset.status;
    currentState.pauseUntil = null;
    customStatusInput.value = currentState.headline;

    document.querySelectorAll("[data-headline]").forEach(option => {
      option.classList.toggle("selected", option === button);
    });
  });
});

if (downloadGpsHistoryBtn) {
  downloadGpsHistoryBtn.addEventListener("click", downloadGpsHistoryCsv);
}

toggleLocationVisibilityBtn.addEventListener("click", async () => {
  const nextShowLocation = !isLocationVisible();
  const payload = {
    showLocation: nextShowLocation,
    visibilityUpdatedAt: Date.now()
  };

  latestBoatData = { ...(latestBoatData || {}), ...payload };
  updateLocationVisibilityButton(latestBoatData);
  renderCustomerPreview(latestBoatData);
  await update(boatRef, payload);
});

document.getElementById("saveStatusAnnouncementBtn").addEventListener("click", sendStatusUpdate);

function submitStatusOnEnter(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("saveStatusAnnouncementBtn").click();
  }
}

customStatusInput.addEventListener("keydown", submitStatusOnEnter);
noteInput.addEventListener("keydown", submitStatusOnEnter);
