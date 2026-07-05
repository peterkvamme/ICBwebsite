import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const db = getDatabase(app);

const DEFAULT_CENTER = [46.445, -94.34];

const map = L.map("map").setView(DEFAULT_CENTER, 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let boatMarker = null;

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = value => value * Math.PI / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function getLocationLabel(lat, lng) {
  const landmarks = window.BOAT_LANDMARKS || [];

  if (!landmarks.length) {
    return "near Gull Lake";
  }

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

  if (minutes < 60) {
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

onValue(ref(db, "boat/current"), snapshot => {
  const data = snapshot.val();

  if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") {
    document.getElementById("headline").textContent = "Not available right now";
    document.getElementById("area").textContent = "Check back soon.";
    document.getElementById("updated").textContent = "";
    document.getElementById("note").textContent = "";
    document.getElementById("mapsLink").style.display = "none";
    return;
  }

  const latLng = [data.lat, data.lng];
  const locationLabel = getLocationLabel(data.lat, data.lng);

  document.getElementById("headline").textContent =
    data.headline || "Available now";

  document.getElementById("area").textContent = `📍 ${locationLabel}`;

  document.getElementById("note").textContent = data.note || "";

  document.getElementById("updated").textContent = timeAgo(data.updatedAt);

  const mapsUrl =
    `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`;

  const mapsLink = document.getElementById("mapsLink");
  mapsLink.href = mapsUrl;
  mapsLink.style.display = "flex";

  if (!boatMarker) {
    boatMarker = L.marker(latLng).addTo(map).bindPopup("Ice Cream Boat");
    map.setView(latLng, 15);
  } else {
    boatMarker.setLatLng(latLng);
  }
});
