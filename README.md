# Last Man Standing - Football Prediction League

A Firebase-based app for managing a football prediction league where players pick teams to survive each round.

## Project Structure

```
├── shared/
│   └── types.ts          # Shared TypeScript types for Firestore schema
├── functions/
│   ├── firebase.ts       # Firebase Admin SDK config
│   ├── index.ts          # Cloud Functions (round state, validation, overrides)
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── app/
│   │   ├── admin/        # Admin dashboard (rounds, notifications)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── firebase.ts   # Firebase client config
│   │   └── services/     # Firestore services (leagues, rounds, notifications)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── .env.local.example
├── firebase.json         # Firebase project config
└── README.md
```

## Setup

### 1. Firebase Project
- Create a Firebase project at [firebase.google.com](https://firebase.google.com)
- Enable Authentication (Email/Password)
- Enable Firestore Database
- Enable Cloud Functions
- Enable Cloud Messaging

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials:
```bash
cp web/.env.local.example web/.env.local
```

### 3. Install Dependencies

```bash
# Install web dependencies
cd web
npm install

# Install Cloud Functions dependencies
cd ../functions
npm install
```

### 4. Deploy Cloud Functions

```bash
firebase login
firebase deploy --only functions
```

### 5. Run Locally

```bash
# Terminal 1: Firebase Emulator
firebase emulators:start

# Terminal 2: Next.js development server
cd web
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Core Features Implemented

### ✅ Database Schema (Firestore)
- Leagues with timezone, fixture window config
- Rounds with state management (OPEN, LOCKED, VALIDATED)
- League participants with elimination tracking
- Selections (user picks per round)
- Admin overrides for result disputes
- Push notifications
- Cached fixtures

### ✅ Cloud Functions
- **lockRound**: Manual admin action → marks round as LOCKED, auto-eliminates no-picks
- **validateRound**: Manual admin action → applies fixture results, eliminates losers/draws
- **overrideSelectionResult**: Admin can override before/after validation
- **reverseOverride**: Undo an override
- Automatic winner determination when league ends
- Push notifications to all user devices

### ✅ Admin Dashboard
- Round management (lock, validate, view selections)
- Override selections with reason tracking
- Send manual push notifications (all players or unpicked only)

### ✅ Services
- League CRUD operations
- Round state transitions
- Selection management
- Notification handling
- Override management

## Key Design Decisions

### Round State Flow
1. **OPEN** → Players make selections
2. **LOCKED** → Manual admin action, no picks allowed, auto-eliminate no-picks
3. **VALIDATED** → Manual admin action, fixture results applied, losses/draws eliminated

### Elimination Logic
- Draw = Loss (eliminated)
- Actual loss = Eliminated
- No pick before lock = Eliminated (NO_PICK)
- Admin can manually eliminate = ADMIN reason

### Winners
- Last player standing wins
- If multiple survive → Joint winners

### Push Notifications
- One Firestore record per user
- Send to all logged-in devices
- Sent automatically on: elimination, league winner
- Admin can send custom messages to: all players or unpicked players

## API Endpoints (Cloud Functions)

### Round Management
- `lockRound(leagueId, roundId)` - Lock a round manually
- `validateRound(leagueId, roundId)` - Validate round results
- `overrideSelectionResult(...)` - Override a result
- `reverseOverride(...)` - Undo an override

### Notifications
- `sendPushNotification(leagueId, audience, title, message)` - Send manual notification

## TODOs / Future Features

- [ ] Football fixture integration (real match data)
- [ ] Round reminders (24h, 1h before lock)
- [ ] Player selections UI (PWA)
- [ ] League standings/leaderboard
- [ ] Public/private league support
- [ ] User profiles
- [ ] More fixture window configuration options

