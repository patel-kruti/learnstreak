# PROJECT_CONTEXT.md
<!-- Living document for interview prep. Maintained by /project-context-tracker -->
<!-- Focus on WHY, not WHAT — the code shows what; this file shows the reasoning -->

## Overview

LearnStreak is a React Native / Expo mobile app that turns learning into a daily habit. Users log learning sessions (what they studied, how long, under which category), and the app tracks consecutive-day streaks, awards badges at milestones, and lets friends see each other's progress. The core bet is that making progress *visible and social* is more motivating than a calendar reminder alone.

Built with Expo (SDK 54), Expo Router, Firebase Auth + Firestore, and AsyncStorage. Targets Android and iOS; web is supported during development.

---

## Features

| Feature | What it does | Why it exists |
|---------|-------------|---------------|
| Session logging | Log a learning session with category, title, notes, and duration (minutes); supports multiple sessions per day | Core value — making the act of logging fast and low-friction is what drives daily use |
| Voice input | Dictate session titles/notes via microphone using `expo-speech-recognition` | Reduces friction for mobile users who find typing a title after a long study session annoying |
| Built-in + custom categories | Preset categories (Coding, Math, Languages, etc.) plus user-created ones with custom emoji | Users study wildly different things; forcing them into fixed categories kills retention |
| Streak tracking | Counts consecutive days with at least one session; resets on a missed day | The streak number is the primary motivational hook — it's a number you don't want to lose |
| Streak freeze | Earn 1 freeze per 7-day streak milestone (max 3); freezes bridge a missed day without breaking the streak | Life happens; a single missed day shouldn't destroy a 60-day streak and demotivate the user entirely |
| Badges | Achievement badges awarded automatically at streak milestones | Secondary motivation layer — gives something to unlock beyond the streak number |
| History view | Past sessions grouped by month with expandable days; tap to edit any past session | Lets users review their learning arc and fix accidental entries |
| Summary / analytics | Category breakdown by total minutes, session counts, and percentage | Shows users where they actually spend their learning time vs. where they think they do |
| Firebase auth | Email + password sign-up / sign-in; creates a profile with a unique username | Prerequisite for social features; username doubles as a friend-lookup handle |
| Cloud sync | On login, entries + streak sync to Firestore in real time | Lets the same user's data survive device switches and be visible to friends |
| Local-first storage | All data written to AsyncStorage first; Firestore sync is fire-and-forget | App must work fully offline — a failed network call should never block logging |
| Friends tab | See friends' current streaks after adding them by username | Social accountability — seeing a friend on a 30-day streak is a stronger nudge than any notification |
| GitHub backup | Optional: commit each session as a JSON file to a user-configured repo | Power-user escape hatch for users who want their learning data in a format they fully own |
| Push notifications | Daily reminder at user-configured time; celebratory notification on streak milestones | Reduces the "I forgot to log" failure mode |
| AI session enrichment | After typing a session title, Qwen 2.5 1.5B (on-device) suggests a category and one-line summary; user can accept, edit, or dismiss | First AI feature — adds value without being intrusive; suggestion is never an overwrite |
| Hare & Tortoise widget | Animated race widget showing hare (user's logged minutes) vs. tortoise (steady 30 min/day baseline), scored logarithmically | Makes the compound effect of consistency vs. cramming *visually obvious* — one big day genuinely can't catch up |
| Streak celebration modal | Full-screen modal with streak count and widget shown on first session of each day | Gives the dopamine hit at exactly the right moment — right after they log |

---

## Decision Log

| Date | Changed | From → To | Why | Alternatives rejected | Tradeoffs |
|------|---------|-----------|-----|-----------------------|-----------|
| 2026-08-07 | AI enrichment model | No AI → Qwen 2.5 1.5B on-device via `react-native-executorch` | Privacy: session titles/notes never leave the device; no API key or backend needed; model downloads once from HuggingFace and is cached; 1.5B is sufficient for category classification + one-line summarization | Claude/OpenAI API via Firebase Cloud Function: data leaves device, API cost per call, requires internet; Gemma 4 2B: larger, slower first load; Qwen 2.5 0.5B: faster but weaker instruction following | First model load takes 30–60s on first install (HuggingFace download); model uses ~800MB device storage; inference adds ~1–2s latency after typing stops |
| 2026-08-05 | Crash / error reporting | None → Sentry (`@sentry/react-native`) | Silent `.catch(() => {})` Firestore syncs meant errors were invisible; needed observability before adding AI features so failures in new code would be measurable | Firebase Crashlytics: requires `@react-native-firebase` (different SDK from the JS Firebase already in use) — too heavy a lift; custom error table: reinventing the wheel | Sentry's free tier has a 5k-events/month cap; native crash reporting (OOM, native panics) requires a dev-client build, not Expo Go |
| 2026-08-05 | Entry sync conflict resolution | Last-write-wins (no timestamp) → `updatedAt` on every entry | Without a modification timestamp there was no basis for merge logic; flagged in our own decision log as a gap — closing it before adding cloud AI features where conflicts would be more likely | Vector clocks: correct but complex; Firestore server timestamps: would require an extra round-trip on every save | `updatedAt` is still client-set (not server-set), so clock skew between devices is possible; true CRDTs deferred |
| 2026-08-05 | Analytics | None → Firestore `users/{uid}/events` subcollection | Need to measure feature impact (session log rate, freeze usage, milestone hit rate) before shipping AI features so we can A/B compare pre/post | Mixpanel / Amplitude: external services, another DSN to manage, no offline queue for free; Firebase Analytics: works but harder to query raw events in Firestore console during early dev | Events only log for authenticated users; anonymous usage is invisible |
| 2026-08 | Active gamification widget | ThirstyCrow widget → HareTortoise widget | HareTortoise widget encodes the fable's moral directly into the scoring math (logarithmic hare vs. linear tortoise), making the consistency message self-evident without explanation | Keeping ThirstyCrow as primary: it's simpler but the mechanic doesn't communicate the *why* of consistency as clearly | ThirstyCrow is still in the codebase (`widgets/ThirstyCrowWidget.tsx`) but commented out — can be revived or used alongside |
| 2026-08 | Social / cloud layer | No cloud → Firebase Auth + Firestore | Needed user identity for the friends feature; Firebase gave auth + real-time DB in one SDK with no backend to operate | Supabase: similar capability but less React Native community support at the time; custom backend: overkill for a solo/small-team project | Firebase free tier limits (50k reads/day Firestore) could become a constraint at scale; vendor lock-in for data |
| 2026-08 | Persistence architecture | Cloud-first → Local-first (AsyncStorage primary, Firestore secondary) | Mobile users log sessions in low-connectivity situations (gyms, commutes); blocking on a network call for a log action would kill the UX | Always online: unacceptable — a single failed save would break the core loop; Firestore offline SDK: considered but adds complexity and the offline cache behavior is harder to reason about on React Native | Sync conflicts are possible if the same account logs on two devices offline; currently last-write-wins |
| 2026-08 | Navigation framework | Bare React Navigation → Expo Router (file-based) | Convention-over-config: the `app/` directory structure makes the route tree obvious; Expo Router is the Expo-blessed path and handles deep linking automatically | Staying on React Navigation: more control but more boilerplate; no file-system convention means routes are spread across config files | Expo Router is newer and has had more breaking changes; some advanced navigation patterns (e.g. modals as routes) require learning its specific idioms |
| 2026-08 | Cross-tab edit flow | Prop drilling / global state → AsyncStorage `pendingEdit` key | The History tab needs to hand an entry to the Add tab for editing; both are sibling tabs with no parent-level state; the `pendingEdit` key is a simple, persistent handoff that survives tab re-renders | Redux/Zustand: correct solution but adds a state library for one use case; React Context: would work but AuthContext already exists and adding more contexts gets messy | Slightly unconventional (using AsyncStorage as an event bus); the key is cleared immediately after reading to avoid stale state |

---

## Interview Prep Notes

### Elevator pitch (30 seconds)
"LearnStreak is a habit-tracking app for learners. You log what you studied each day, the app tracks your streak, and you can see friends' streaks to stay accountable. The core insight is that making daily learning *social and visible* keeps people coming back more reliably than reminders alone."

### Three most interesting technical decisions

**1. Local-first with fire-and-forget cloud sync**
Every write goes to AsyncStorage first; Firestore sync is `.catch(() => {})` — deliberately swallowed. This means the app never fails to log a session due to a network issue. The tradeoff is last-write-wins conflict resolution, which is acceptable because sessions are append-only by design.

**2. Logarithmic scoring in the Hare & Tortoise widget**
The hare's daily progress is `log(1 + minutes) / log(1 + 30)` × the tortoise's daily pace. Because log is concave, doubling your minutes on one day doesn't double your progress — so cramming 60 minutes one day and 0 the next always loses to 30 minutes every day. The math *encodes* the fable's moral rather than just illustrating it.

**3. AsyncStorage as a cross-tab event bus**
The `pendingEdit` key in AsyncStorage is used to hand an entry from the History tab to the Add tab. It's unusual but avoids adding global state management for a single use case. The key is cleared immediately on read so it behaves like a one-shot message, not persistent state.

### Likely interview questions

**Q: How does the streak freeze work?**
A: Every 7-day streak milestone earns the user one freeze (capped at 3). When `updateStreak` runs and detects a gap since the last logged date, it checks whether the gap (in missed days) is ≤ the available freeze count. If so, it marks those dates as frozen, decrements the freeze count, and continues the streak as if they were logged days. If the gap is too big or there are no freezes, the streak resets to 1.

**Q: What happens if two devices log sessions offline at the same time?**
A: Currently, last-write-wins. Firestore sync is fire-and-forget; there's no merge logic. Each device writes its local state to Firestore on save, so whichever write lands last wins. This is a known tradeoff — accepted because the typical user has one device, and implementing CRDTs or a merge strategy would significantly increase complexity.

**Q: Why Firebase over a custom backend?**
A: No backend to operate, no auth to implement, real-time listeners for the friends feature come for free. The cost is vendor lock-in and Firestore's free-tier read limits at scale. For a solo/early-stage app, removing operational burden outweighed those risks.

**Q: Why Expo Router instead of React Navigation?**
A: The file-system-as-routes convention means the route tree is self-documenting — you can look at the `app/` directory and immediately understand the navigation structure. Expo Router also handles deep linking and typed routes automatically. The downside is it's younger than React Navigation and has had more API churn.

**Q: What would you do differently?**
A: The local-first sync has no conflict resolution. I'd add a vector clock or at minimum a per-entry `updatedAt` timestamp so that when two devices sync, the merge is deterministic. I'd also move the `pendingEdit` cross-tab handoff to a lightweight Zustand store — it works in AsyncStorage but it's surprising to readers of the code.
