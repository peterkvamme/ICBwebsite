# Ice Cream Boat Captain Android App

This Android project replaces the captain web page for live location uploads while preserving the existing GitHub Pages customer website.

## What it does

- Logs in with the same Firebase Authentication email/password account used by the captain page.
- Starts a foreground location service so the phone can keep uploading location while the screen is off.
- Writes to the existing Firebase Realtime Database path: `boat/current`.
- Uses the same fields as the website: `lat`, `lng`, `accuracy`, `headline`, `status`, `note`, `pauseUntil`, and `updatedAt`.
- Keeps the current customer-facing website unchanged.

## Build

1. Open the `android-app` folder in Android Studio.
2. Let Android Studio sync Gradle.
3. Build and install the `app` module on the captain Android phone.

## First-run setup on the phone

1. Log in with the Firebase captain account.
2. Grant location permission.
3. Grant notification permission if Android asks.
4. Tap **Start Sharing Location** while the app is visible.
5. Keep the persistent notification active. Android requires this for reliable screen-off location tracking.
6. For best reliability, open the app's Android settings and allow background location / disable battery optimization if the device restricts background activity.

## Firebase note

The app initializes Firebase directly from the existing website configuration. For a production Play Store app, create a dedicated Android app in the Firebase console and replace the app id in `IceCreamBoatApp.java` with the Android app's Firebase app id.
