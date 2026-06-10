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

### Downloadable APK (host and link)

You can provide the APK to users in one of the following ways. Replace `YOUR_USERNAME` and `v1.0.0` with your GitHub username and release tag.

- GitHub Releases (recommended):

	1. Create a release on GitHub and attach the APK (web UI or `gh`):

```powershell
gh release create v1.0.0 apk/learnstreak.apk --title "v1.0.0" --notes "Initial Android APK"
```

	2. Users download from:

```
https://github.com/YOUR_USERNAME/learnstreak/releases/download/v1.0.0/learnstreak.apk
```

- Raw file in the repo (not ideal for large files):

	1. Add the APK to the repo under an `apk/` folder and push:

```bash
mkdir -p apk
# copy your APK into apk/learnstreak.apk
git add apk/learnstreak.apk
git commit -m "Add APK for direct download"
git push origin main
```

	2. Users download the raw file:

```
https://github.com/YOUR_USERNAME/learnstreak/raw/main/apk/learnstreak.apk
```

### Direct APK included in this repository

This repository includes the APK in the `apk/` folder as `learnstreak.apk`. Users can download and install it directly from the repository raw URL (replace `YOUR_USERNAME` with the repository owner):

```
https://github.com/YOUR_USERNAME/learnstreak/raw/main/apk/learnstreak.apk
```

Install after download with ADB:

```bash
adb install learnstreak.apk
```

This APK is tracked using Git LFS. If you clone the repository, ensure Git LFS is installed so the APK downloads correctly:

```bash
git lfs install
git clone https://github.com/YOUR_USERNAME/learnstreak.git
```

### Security and checksum

Provide a SHA256 checksum alongside the APK so users can verify integrity:

```bash
sha256sum apk/learnstreak.apk > apk/learnstreak.apk.sha256
```

Users can verify after download:

```bash
sha256sum -c learnstreak.apk.sha256
```

### Note about `rcan install`

You previously mentioned `rcan install`. I don't recognize `rcan` as a standard Android install tool — if you mean `adb install`, the commands above are correct. If `rcan` is a custom utility or script you use, tell me how `rcan` is invoked (shell command or script) and I will add exact instructions for that method.

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
