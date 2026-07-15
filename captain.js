// Initialize Map
const map = L.map('map').setView([46.435, -94.34], 13); // Centered near Gull Lake, MN

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Custom Ice Cream Boat marker
const iceCreamIcon = L.icon({
    iconUrl: 'logo-marker.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
});

const boatMarker = L.marker([46.435, -94.34], {icon: iceCreamIcon}).addTo(map);

// Firebase references
const database = firebase.database();
const activePathRef = database.ref('activePath');
const boatStatusRef = database.ref('status');

// Track DOM elements
const gpsStatus = document.getElementById('gps-status');
const gpsAccuracy = document.getElementById('gps-accuracy');
const gpsSpeed = document.getElementById('gps-speed');
const btnOpen = document.getElementById('btn-open');
const btnClosed = document.getElementById('btn-closed');
const btnDownloadGps = document.getElementById('btn-download-gps');

// Map landmarks from landmarks.js if available
if (typeof landmarks !== 'undefined') {
    landmarks.forEach(landmark => {
        L.marker([landmark.lat, landmark.lng]).addTo(map).bindPopup(landmark.name);
    });
}

// Update Status Buttons
btnOpen.addEventListener('click', () => {
    boatStatusRef.set('open');
    alert("Boat status set to OPEN");
});

btnClosed.addEventListener('click', () => {
    boatStatusRef.set('closed');
    alert("Boat status set to CLOSED");
});

// Geolocation tracking
if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            // Convert speed from m/s to mph, handle null
            const speed = position.coords.speed ? (position.coords.speed * 2.23694).toFixed(1) : 0;
            const timestamp = Date.now();

            // Update UI
            gpsStatus.textContent = "Active";
            gpsStatus.style.color = "green";
            gpsAccuracy.textContent = accuracy.toFixed(1);
            gpsSpeed.textContent = speed;

            // Pan map and move marker
            map.setView([lat, lng]);
            boatMarker.setLatLng([lat, lng]);

            // Push coordinates to activePath in Firebase
            activePathRef.push({
                lat: lat,
                lng: lng,
                accuracy: accuracy,
                speed: speed,
                timestamp: timestamp
            });
        },
        (error) => {
            console.error("Error obtaining location: ", error);
            gpsStatus.textContent = "Error (" + error.message + ")";
            gpsStatus.style.color = "red";
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );
} else {
    gpsStatus.textContent = "Not Supported by Browser";
    gpsStatus.style.color = "red";
}

// NEW / RESTORED: Download GPS history from Firebase database
if (btnDownloadGps) {
    btnDownloadGps.addEventListener('click', async () => {
        try {
            btnDownloadGps.textContent = "Fetching Data...";
            btnDownloadGps.disabled = true;

            const snapshot = await activePathRef.once('value');
            const data = snapshot.val();

            if (!data) {
                alert("No GPS data found in Firebase under 'activePath'!");
                btnDownloadGps.textContent = "Download GPS History (.csv)";
                btnDownloadGps.disabled = false;
                return;
            }

            // CSV Columns Setup
            let csvContent = "data:text/csv;charset=utf-8,Timestamp,Date/Time,Latitude,Longitude,Speed (mph),Accuracy (m)\n";

            // Parse and format firebase location nodes
            Object.keys(data).forEach(key => {
                const node = data[key];
                const lat = node.lat || '';
                const lng = node.lng || '';
                const speed = node.speed || '0';
                const accuracy = node.accuracy || '';
                const timestamp = node.timestamp || '';
                
                let readableTime = '';
                if (timestamp) {
                    readableTime = new Date(timestamp).toLocaleString().replace(/,/g, '');
                }

                csvContent += `${timestamp},${readableTime},${lat},${lng},${speed},${accuracy}\n`;
            });

            // Trigger safe browser download
            const encodedUri = encodeURI(csvContent);
            const downloadLink = document.createElement("a");
            downloadLink.setAttribute("href", encodedUri);
            downloadLink.setAttribute("download", `boat_route_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(downloadLink);
            
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Reset button state
            btnDownloadGps.textContent = "Download GPS History (.csv)";
            btnDownloadGps.disabled = false;

        } catch (err) {
            console.error("Error retrieving GPS paths: ", err);
            alert("Could not download coordinates. Make sure your internet is working and database rules allow reads.");
            btnDownloadGps.textContent = "Download GPS History (.csv)";
            btnDownloadGps.disabled = false;
        }
    });
}
