# LearnStreak

<img width="307" height="527" alt="image" src="https://github.com/user-attachments/assets/8594279f-0165-4268-b471-5cbb89c9acbf" /><img width="307" height="527" alt="image" src="https://github.com/user-attachments/assets/9f5929c6-3238-4934-aadd-8b0362e037e3" /> <img width="307" height="527" alt="image" src="https://github.com/user-attachments/assets/979f7fca-2724-48b6-a998-c344e11da58c" />

A React Native / Expo app that turns learning into a daily habit through streak tracking, progress summaries, and achievement badges.

## Quick Start (5 minutes)

**Prerequisites:** Node.js LTS and the [Expo Go](https://expo.dev/go) app on your phone.

```bash
git clone <your-repo-url>
cd learnstreak
npm install
npx expo start
```

Scan the QR code in your terminal with Expo Go (Android) or the Camera app (iOS). The app will open immediately — no build step required.

> Firebase is already configured in `src/utils/firebase.ts`. No `.env` file or extra setup is needed.

`npm install` also pulls in `react-native-executorch`, the native on-device LLM runtime used for AI-assisted category/summary suggestions while logging a session. It requires a dev-client build — in Expo Go the AI suggestion feature simply stays off and the rest of the app works normally.

## AI suggestions, error reporting & analytics

- **AI session suggestions** (`src/utils/llm.ts`) — as you type a session title, an on-device Qwen2.5-1.5B model (via `react-native-executorch`) suggests a category and one-line summary. Runs fully on-device; needs a dev-client/production build (not Expo Go) and the model binary, which is not checked into this repo — see `src/utils/llm.ts` for how it's loaded.
- **Crash/error reporting** (`src/utils/sentry.ts`) — wired up via `@sentry/react-native` but ships with no DSN, so it's disabled by default (errors are logged locally, not sent anywhere). Add your DSN in `src/utils/sentry.ts` and fill in the `organization`/`project` in the Sentry Expo plugin config in `app.json` to enable it.
- **Usage analytics** (`src/utils/analytics.ts`) — logs lightweight product events (sessions logged, streak milestones, AI suggestion accept/reject, etc.) to Firestore under `users/{uid}/events`. No-ops for anonymous users and never throws.
- **Voice input** — logging a session can use speech-to-text, so the app now requests microphone/speech-recognition permissions (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `RECORD_AUDIO`) — see `app.json`.

## Running on a simulator/emulator

```bash
# Android emulator (requires Android Studio)
npm run android

# iOS simulator (macOS only, requires Xcode)
npm run ios

# Web browser
npm run web
```

## Building a production APK

We use EAS Build (Expo's cloud build service).

```bash
npm install -g eas-cli
eas login
eas build -p android --profile production
```

Download the APK from the link printed at the end of the build, or run `eas build:list`.

To build locally instead, run `expo prebuild` then open the `android/` folder in Android Studio.

## Installing an APK on Android

```bash
# Via ADB
adb install path/to/learnstreak.apk

# Reinstall over an existing install
adb install -r path/to/learnstreak.apk
```

Alternatively, transfer the APK to the device and open it with a file manager (enable **Install from Unknown Sources** in Settings first).

### APK in this repository

A pre-built APK is included in the `apk/` folder. Download it and install as above, or grab the raw URL:

```
https://github.com/patel-kruti/learnstreak/raw/main/apk/learnstreak.apk
```

This APK is tracked with Git LFS — run `git lfs install` before cloning if you need the binary:

```bash
git lfs install
git clone https://github.com/patel-kruti/learnstreak.git
```

## Project structure

| Path | Purpose |
|------|---------|
| `app/` | Expo Router pages and layouts |
| `src/utils/firebase.ts` | Firebase initialization |
| `src/utils/firestore.ts` | Firestore helpers |
| `src/utils/llm.ts` | On-device AI session suggestions |
| `src/utils/sentry.ts` | Crash/error reporting |
| `src/utils/analytics.ts` | Firestore event logging |
| `src/context/AuthContext.tsx` | Auth state |
| `components/` | Shared UI components |
| `widgets/` | Home-screen widgets (`ThirstyCrowWidget`, `HareTortoiseWidget`) |
| `assets/` | Images and fonts |
| `app.json` | Expo config (bundle ID, icons, plugins) |

## Contributing

1. Fork the repo and create a branch.
2. Run `npm install` and test with `npx expo start`.
3. Open a pull request with a clear description of what changed and why.

## License

MIT — add a `LICENSE` file if you want to make this explicit.
