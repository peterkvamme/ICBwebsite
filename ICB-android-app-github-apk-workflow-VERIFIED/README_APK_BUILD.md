# Ice Cream Boat Captain Android APK

This ZIP contains only the files added for the Android captain app and GitHub APK build.

Upload these items to the root of your existing GitHub Pages repository:

- `android-app/`
- `.github/workflows/build-android-apk.yml`

The existing website files do not need to be replaced.

## Build the APK without Android Studio

1. Go to your GitHub repository.
2. Open the **Actions** tab.
3. Select **Build Android APK**.
4. Click **Run workflow**.
5. When it finishes, open the completed workflow run.
6. Download the artifact named `ice-cream-boat-captain-debug-apk`.
7. Unzip that artifact and install `app-debug.apk` on the Android phone.

## Android phone setup

After installing:

1. Open the app.
2. Sign in with the same Firebase captain account used by the captain webpage.
3. Grant location permission.
4. In Android settings for the app, set location to **Allow all the time** if available.
5. Disable battery optimization for this app.
6. Tap **Start Sharing Location** before locking the phone.

Android requires a visible notification while background location sharing is active.
