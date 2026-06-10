# LearnStreak

React Native / Expo project.

## Project Overview

LearnStreak is a React Native app built with Expo and Expo Router. It is configured for Android, iOS and web. The Expo package id is `com.nickruti.learnstreak1` (see `app.json`).

## Table of contents

- Installation
- Development (run locally)
- Building a production APK
- Installing the APK on an Android device
- Project structure
- Contributing
- License

## Prerequisites

- Node.js (LTS)
- npm or yarn
- Android Studio (for emulator) or an Android device with USB debugging enabled
- (Optional) GitHub CLI `gh` and EAS CLI for building

## Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd learnstreak
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

## Development (run locally)

- Start the Expo dev server:

```bash
npm run start
# or
npx expo start
```

- Open on an Android device/emulator (requires Expo Go or a development client):

```bash
npm run android
```

Notes:
- `npm run android` runs `expo start --android` which opens the Metro dev server and attempts to open the app in an emulator or on a connected device running Expo Go.
- If you are using a custom development client, follow Expo’s dev client docs.

## Building a production APK (recommended: EAS Build)

Expo’s classic build is deprecated for some workflows — we recommend EAS Build.

1. Install EAS CLI:

```bash
npm install -g eas-cli
```

2. Authenticate and configure:

```bash
eas login
```

3. Start a build for Android (APK):

```bash
eas build -p android --profile production
```

4. After the build completes, download the APK from the build page or use `eas build:list` / `eas build:download` to fetch the artifact.

If you prefer to build locally (bare), open the Android project in Android Studio after running `expo prebuild`.

## Installing the APK on an Android device

Once you have an APK file (`app-release.apk` or similar), install it using ADB:

```bash
# Install APK (first time)
adb install path/to/your-app.apk

# Reinstall / replace existing app
adb install -r path/to/your-app.apk
```

If you don't use `adb`, you can also transfer the APK to the device and open it using a file manager (enable Install from Unknown Sources).

Note about `rcan install`:

You mentioned an `.apk` that uses `rcan install`. I don't recognize `rcan` as a standard Android install tool — did you mean `adb install` or a custom/shell script named `rcan`? If `rcan` is a project-specific installer or a CI helper, tell me how it’s invoked and I will add exact instructions.

## Project structure

- `app/` — Expo Router pages and layouts
- `assets/` — images, fonts
- `components/` — reusable components
- `src/` — app source utilities and constants
- `package.json` — scripts and dependencies
- `app.json` — Expo configuration (package id, icons, splash)

## Contributing

- Fork the repository and open a pull request.
- Run `npm install` and test changes locally with `npm run start`.
- Add descriptive commit messages and update this README if you change setup or build steps.

## License

Add a license file to this repository (e.g., `LICENSE` with MIT) or specify your preferred license here.

---

If you want, I can:

- add this `README.md` to the repo and commit it, or
- create an `eas.json` with a recommended Android build profile, or
- include precise `rcan` install instructions once you clarify what `rcan` refers to.

Tell me which of these you'd like me to do next.
