import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

let watchId = null;
let lastPosition = null;

let currentState = {
  headline: "Available now",
  status: "available",
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
const currentNote = document.getElementById("currentNote");

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

function buildPayload(position = lastPosition) {
  const payload = {
    headline: currentState.headline,
    status: currentState.status,
    note: currentState.note,
    pauseUntil: currentState.pauseUntil,
    updatedAt: Date.now()
  };

  if (position) {
    payload.lat = position.coords.latitude;
    payload.lng = position.coords.longitude;
    payload.accuracy = position.coords.accuracy;
  }

  return payload;
}

async function sendUpdate(position = lastPosition) {
  const payload = buildPayload(position);

  await update(ref(db, "boat/current"), payload);

  trackingStatus.textContent = payload.headline;
  sentInfo.textContent = `Last sent: ${new Date().toLocaleTimeString()}`;

  if (position) {
    gpsInfo.textContent = `GPS accuracy: ${Math.round(position.coords.accuracy)} meters`;
  }

  if (currentNote) {
    currentNote.textContent = currentState.note || "No customer announcement.";
  }
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
      await sendUpdate(position);
    },
    error => {
      trackingStatus.textContent = `GPS error: ${error.message}`;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );
});

document.getElementById("stopBtn").addEventListener("click", async () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  currentState = {
    headline: "Done for today",
    status: "done",
    note: noteInput.value.trim() || "Location sharing is off.",
    pauseUntil: null
  };

  await sendUpdate();
});

document.querySelectorAll("[data-headline]").forEach(button => {
  button.addEventListener("click", async () => {
    currentState.headline = button.dataset.headline;
    currentState.status = button.dataset.status;
    currentState.note = noteInput.value.trim();

    if (button.dataset.pause) {
      currentState.pauseUntil = Date.now() + Number(button.dataset.pause) * 60 * 1000;
    } else {
      currentState.pauseUntil = null;
    }

    await sendUpdate();
  });
});

document.getElementById("saveNoteBtn").addEventListener("click", async () => {
  currentState.note = noteInput.value.trim();
  await sendUpdate();
});

document.getElementById("saveCustomStatusBtn").addEventListener("click", async () => {
  const customStatus = document.getElementById("customStatusInput").value.trim();

  if (!customStatus) return;

  currentState.headline = customStatus;
  currentState.status = "custom";
  currentState.note = noteInput.value.trim();

  await sendUpdate();
});
