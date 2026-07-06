import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const db = getDatabase(app);

const DEFAULT_CENTER = [46.445, -94.34];

const map = L.map("map").setView(DEFAULT_CENTER, 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const boatIcon = L.icon({
  iconUrl: "logo.png",
  iconSize: [78, 78],
  iconAnchor: [39, 39],
  popupAnchor: [0, -39]
});

let boatMarker = null;

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;

  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function getLocationLabel(lat, lng) {

  const landmarks = window.BOAT_LANDMARKS || [];

  if (!landmarks.length) {
    return "near Gull Lake";
  }

  const ranked = landmarks
    .map(l => ({
      ...l,
      meters: distanceMeters(
        lat,
        lng,
        l.lat,
        l.lng
      )
    }))
    .sort((a, b) => a.meters - b.meters);

  const nearest = ranked[0];

  return nearest.label || `near ${nearest.name}`;
}

function timeAgo(timestamp) {

  if (!timestamp) return "";

  const seconds = Math.floor(
    (Date.now() - timestamp) / 1000
  );

  if (seconds < 10)
    return "Updated just now";

  if (seconds < 60)
    return `Updated ${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60)
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);

  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function updatePage(data) {

  const latLng = [data.lat, data.lng];

  document.getElementById("headline").textContent =
    data.headline || "Available now";

  document.getElementById("area").textContent =
    "📍 " + getLocationLabel(data.lat, data.lng);

  document.getElementById("updated").textContent =
    timeAgo(data.updatedAt);

  document.getElementById("note").textContent =
    data.note || "";

  const mapsLink =
    document.getElementById("mapsLink");

  mapsLink.href =
    `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`;

  if (!boatMarker) {

    boatMarker = L.marker(latLng, {
      icon: boatIcon
    })
      .addTo(map)
      .bindPopup("Ice Cream Boat");

    map.setView(latLng, 15);

  } else {

    boatMarker.setLatLng(latLng);

  }

}

const boatRef = ref(db, "boat/current");

onValue(boatRef, snapshot => {

  const data = snapshot.val();

  if (
    !data ||
    typeof data.lat !== "number" ||
    typeof data.lng !== "number"
  ) {

    document.getElementById("headline").textContent =
      "Not available right now";

    document.getElementById("area").textContent =
      "Check back soon.";

    document.getElementById("updated").textContent = "";

    document.getElementById("note").textContent = "";

    return;

  }

  updatePage(data);

});

//
// Refresh when returning to the page
//

document.addEventListener("visibilitychange", () => {

  if (document.visibilityState === "visible") {

    window.location.reload();

  }

});

//
// Refresh when window/tab gains focus
//

window.addEventListener("focus", () => {

  window.location.reload();

});

//
// Backup refresh every 15 minutes
//

setInterval(() => {

  if (document.visibilityState === "visible") {

    window.location.reload();

  }

}, 15 * 60 * 1000);
