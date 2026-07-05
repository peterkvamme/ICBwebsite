# Ice Cream Boat Live Location Starter

This is a static website starter for:

- GitHub Pages public site
- Leaflet/OpenStreetMap mobile map
- Firebase Realtime Database live boat location
- Automatic nearest-landmark display
- Private captain tracker page

## Files

- `index.html` - public customer page
- `captain.html` - private tracker/dashboard page
- `styles.css` - mobile-first styling
- `landmarks.js` - Gull Lake landmark/area definitions
- `app.js` - public map logic
- `captain.js` - GPS tracking + Firebase write logic
- `firebase-config.example.js` - copy to `firebase-config.js`
- `firebase-rules.json` - suggested Realtime Database rules

## First setup

1. Create a Firebase project.
2. Create a Realtime Database.
3. Enable Email/Password Authentication.
4. Add yourself as the captain user.
5. Copy `firebase-config.example.js` to `firebase-config.js`.
6. Paste your Firebase config values into `firebase-config.js`.
7. Deploy these files to GitHub Pages.

## Important

The coordinates in `landmarks.js` are starter placeholders. Verify them before launch.
Use Google Maps, Apple Maps, or GPS coordinates from your boat to refine them.

The public page reads live location.
The captain page writes live location after login.
