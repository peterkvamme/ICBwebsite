import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

let watchId = null;
let lastPosition = null;
let currentHeadline = "Available now — wave us down";
let currentStatus = "available";
let currentNote = "";

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const statusControls = document.getElementById("statusControls");
const trackingStatus = document.getElementById("trackingStatus");
const gpsInfo = document.getElementById("gpsInfo");
const sentInfo = document.getElementById("sentInfo");

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

function writeBoatLocation(position) {
  const { latitude, longitude, accuracy } = position.coords;
  lastPosition = position;

  gpsInfo.textContent = `GPS accuracy: ${Math.round(accuracy)} meters`;

  return update(ref(db, "boat/current"), {
    lat: latitude,
    lng: longitude,
    accuracy,
    headline: currentHeadline,
    status: currentStatus,
    note: currentNote,
    updatedAt: Date.now()
  }).then(() => {
    sentInfo.textContent = `Last sent: ${new Date().toLocaleTimeString()}`;
  });
}

document.getElementById("startBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    trackingStatus.textContent = "Geolocation is not supported on this device.";
    return;
  }

  if (watchId !== null) return;

  trackingStatus.textContent = "Tracking active";

  watchId = navigator.geolocation.watchPosition(
    pos => writeBoatLocation(pos),
    err => {
      trackingStatus.textContent = `GPS error: ${err.message}`;
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

  currentHeadline = "Done for today";
  currentStatus = "done";

  await update(ref(db, "boat/current"), {
    headline: currentHeadline,
    status: currentStatus,
    note: "Location sharing is off.",
    updatedAt: Date.now()
  });

  trackingStatus.textContent = "Stopped";
});

document.querySelectorAll("[data-headline]").forEach(button => {
  button.addEventListener("click", async () => {
    currentHeadline = button.dataset.headline;
    currentStatus = button.dataset.status;

    const patch = {
      headline: currentHeadline,
      status: currentStatus,
      updatedAt: Date.now()
    };

    if (button.dataset.pause) {
      patch.pauseUntil = Date.now() + Number(button.dataset.pause) * 60 * 1000;
    } else {
      patch.pauseUntil = null;
    }

    if (lastPosition) {
      await writeBoatLocation(lastPosition);
    }

    await update(ref(db, "boat/current"), patch);
    trackingStatus.textContent = currentHeadline;
  });
});

document.getElementById("saveNoteBtn").addEventListener("click", async () => {
  currentNote = document.getElementById("noteInput").value.trim();

  await update(ref(db, "boat/current"), {
    note: currentNote,
    updatedAt: Date.now()
  });

  if (lastPosition) await writeBoatLocation(lastPosition);
});
