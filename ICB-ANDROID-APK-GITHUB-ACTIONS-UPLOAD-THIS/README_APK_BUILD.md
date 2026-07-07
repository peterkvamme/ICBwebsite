# Ice Cream Boat Captain Android APK Build

This package adds only the Android app source and GitHub Actions workflow.

## Files included

- `android-app/` - Android app project
- `.github/workflows/build-android-apk.yml` - GitHub Actions workflow that builds the APK
- `README_APK_BUILD.md` - these instructions

## Important

`.github` is a hidden folder on macOS. In Finder, press `Command + Shift + .` to show hidden folders.

## Upload to GitHub

Upload these files/folders into the root of the existing `ICBwebsite` repository.

After uploading, verify in GitHub's Code tab that this exact file exists:

`.github/workflows/build-android-apk.yml`

If that file is present, the Actions tab will show a workflow named:

`Build Android APK`

## Build the APK

1. Open the GitHub repository.
2. Go to Actions.
3. Click `Build Android APK` on the left.
4. Click `Run workflow`.
5. Open the completed run.
6. Download the artifact named `ice-cream-boat-captain-debug-apk`.
7. Inside it is `app-debug.apk`.

## Install on Android

1. Send `app-debug.apk` to the Android phone.
2. Tap the file on the phone.
3. Allow installation from that source.
4. Open Ice Cream Boat Captain.
5. Sign in with the same Firebase captain email/password used by the captain webpage.
6. Grant location and notification permissions.
7. For best reliability, open app settings and set location to `Allow all the time`; also disable battery optimization for the app.

## What the app writes

The app uploads to the same Firebase Realtime Database path used by the website:

`boat/current`

It writes:

- `lat`
- `lng`
- `accuracy`
- `headline`
- `status`
- `note`
- `pauseUntil`
- `updatedAt`
