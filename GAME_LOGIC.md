# Last Man Standing - Game Logic Analysis

## Overview
Your "Last Man Standing" application is a multiplayer football prediction game where players survive by correctly predicting which team will win each week. Here's the complete breakdown of how the game works:

---

## 1. LEAGUE CREATION (Admin Flow)

### Step 1: Admin Creates League
- **Location**: `/admin` (AdminLeaguesPage)
- **Flow**:
  1. Admin selects a football competition (Premier League, La Liga, Bundesliga, etc.)
  2. API fetches all teams for that competition from football-data.org v4 API
  3. Teams displayed as preview (showing first 12, with +X more indicator)
  4. Admin enters league name and description
  5. League created with:
     - Unique 6-character alphanumeric code (e.g., "ABC123")
     - Competition ID, code, and name stored
     - Admin marked as `ownerId`
     - Status set to "ACTIVE"

### Step 2: Teams Storage
- **Current Implementation**: 
  - Teams are NOT permanently saved to the database during league creation
  - Teams are fetched on-demand via `/api/competitions/[competitionCode]/teams`
  - API fetches from football-data.org (live), fallback to Firestore, then mock data
- **Issue**: Your requirement states "teams...saved within the database" but this isn't happening

### What's Stored in Firestore for a League
```
/leagues/{leagueId}
├── name: "My Premier League Game"
├── description: "..."
├── competitionCode: "PL"
├── competitionName: "Premier League"
├── ownerId: "user123"
├── leagueCode: "ABC123"
├── status: "ACTIVE"
└── timestamps...

/leagues/{leagueId}/rounds/{roundId}
├── number: 1
├── status: "OPEN" | "LOCKED" | "VALIDATED"
├── startDateTime: timestamp
├── lockDateTime: timestamp
└── timestamps...

/leagues/{leagueId}/participants/{participantId}
├── userId: "user456"
├── username: "PlayerName"
├── eliminated: false
├── eliminatedAtRound: null
├── eliminatedReason: null
├── status: "ACTIVE"
└── timestamps...
```

---

## 2. PLAYER JOINS LEAGUE (Player Flow)

### Step 1: Browse and Join
- **Location**: `/browse-leagues` (BrowseLeaguesPage)
- **Flow**:
  1. Player enters the 6-character league code
  2. System queries Firestore for matching league
  3. Player clicks "Join League"
  4. Creates participant record: `/leagues/{leagueId}/participants/{userId}`
  5. Player added to league with `eliminated: false`, `status: "ACTIVE"`

### Step 2: View League
- **Location**: `/league/[leagueId]` (LeaguePage)
- Shows:
  - League name and description
  - Current round (if any)
  - Player's current selection (if round is open)
  - Participants list
  - Standings

---

## 3. PLAYER SEES AVAILABLE TEAMS

### Step 1: Selection Page Load
- **Location**: `/league/[leagueId]/rounds/[roundId]/select`
- **Current Implementation**:
  1. Fetches round data
  2. Fetches league info (to get `competitionCode`)
  3. Calls `/api/competitions/{competitionCode}/teams`
  4. Displays ALL teams in a responsive grid (2-5 columns)
  5. Shows team crest/logo and short name

### What Player Sees
- All teams from the competition (e.g., 20 teams for Premier League)
- Teams displayed with team crest, name, and short code
- Selection is highlighted in green when clicked

### ⚠️ MISSING FEATURE
**Your requirement**: "their pick form week 1 should be unavailable"
- **Current Status**: NOT IMPLEMENTED
- Teams from previous rounds are NOT marked as unavailable
- A player can theoretically select the same team multiple rounds in a row
- **Need to implement**: Before rendering teams, filter out any team the player selected in previous rounds

---

## 4. PLAYER MAKES SELECTION

### Step 1: Player Selects Team
- **Location**: `/league/[leagueId]/rounds/[roundId]/select/page.tsx`
- Player clicks on a team card
- Team becomes highlighted (green border, checkmark)
- Selection summary shows below the grid

### Step 2: Submit Selection
- **Data Sent**:
  ```json
  {
    "userId": "user123",
    "selectedTeamId": "1",
    "selectedTeamName": "Arsenal"
  }
  ```
- **Endpoint**: `POST /api/leagues/{leagueId}/rounds/{roundId}/selections`
- **What's Created in Firestore**:
  ```
  /leagues/{leagueId}/rounds/{roundId}/selections/{selectionId}
  ├── userId: "user123"
  ├── selectedTeamId: "1"
  ├── selectedTeamName: "Arsenal"
  ├── result: null (set after round validation)
  ├── status: "PENDING"
  └── timestamps...
  ```

---

## 5. ADMIN MANAGES ROUND (Critical for Game Logic)

### Step 1: Create Round
- **Location**: `/admin/league/[id]` (AdminLeagueDetailPage)
- Admin sets:
  - Round number (e.g., 1, 2, 3)
  - Start time
  - Lock time (deadline for selections)
  - Status: "OPEN"

### Step 2: Lock Round
- **Endpoint**: `POST /api/rounds/lock`
- Sets round status to "LOCKED"
- Players can no longer make selections

### Step 3: Validate Round (KEY STEP)
- **Endpoint**: `POST /api/rounds/validate`
- **Confirmation**: "Validate this round? This will apply fixture results and eliminate losers."
- **What Happens**:
  1. Fetches actual fixture results from football-data.org API
  2. Matches player selections against actual winners
  3. Updates each selection with `result: "WIN" | "LOSS" | "DRAW"`
  4. **Eliminates players whose team LOST**
  5. Updates participant record: `eliminated: true`, `eliminatedAtRound: 1`, `eliminatedReason: "LOSS"`

### Step 4: Admin Can Override Results
- **Location**: `/admin/league/[id]` (Admin League Detail)
- **Function**: `handleOverrideSelection()`
- **Allow**: Setting result to WIN, LOSS, or DRAW manually
- **Use Case**: If there's a disputed result or correction needed

### Step 5: Admin Can Manually Eliminate
- **Function**: `handleEliminateParticipant()`
- **Endpoint**: `POST /api/participants/eliminate`
- **Parameters**: leagueId, participantId, roundNumber
- **Effect**: Marks player as eliminated starting from that round

---

## 6. GAME PROGRESSION & ELIMINATION

### Round 1 Winner → Round 2
- Player's team wins in Round 1
- Selection marked as `result: "WIN"`
- Player remains `eliminated: false`
- Player can make selection for Round 2
- **But**: Previous selections must be unavailable for selection

### Round 1 Loser → ELIMINATED
- Player's team loses in Round 1
- Selection marked as `result: "LOSS"`
- Participant marked: `eliminated: true`, `eliminatedAtRound: 1`, `eliminatedReason: "LOSS"`
- Player cannot make selections in Round 2 onwards
- Player shown in "Eliminated Players" section on standings

### Example Progression
```
Round 1:
- Player A selects Manchester City (WINS) → Progresses to Round 2
- Player B selects Liverpool (LOSES) → ELIMINATED
- Player C selects Arsenal (WINS) → Progresses to Round 2

Round 2:
- Player A can select from any team EXCEPT Manchester City
- Player C can select from any team EXCEPT Arsenal
- Player B cannot play (eliminated)

Round 3:
- Player A selects Chelsea (LOSES) → ELIMINATED
- Player C selects Manchester United (WINS) → Progresses to Round 4

Final Result:
- Player C is the winner (last person standing)
```

---

## 7. STANDINGS & ELIMINATION TRACKING

### Location: `/standings`
**Displays**:
1. **Active Players** (sorted by rounds survived)
   - Currently active (not eliminated)
   - Show wins per round
   
2. **Eliminated Players** (sorted by elimination round - latest first)
   - Shows when they were eliminated
   - Shows reason (LOSS)
   - Example: "Lost in Round 3"

**Sorting Logic**:
1. Non-eliminated players first
2. Among eliminated: sort by `eliminatedAtRound` (descending)
3. Players eliminated later are ranked higher than earlier eliminations

---

## CURRENT IMPLEMENTATION STATUS

### ✅ IMPLEMENTED & WORKING
1. Admin league creation with competition selection
2. Teams fetched from football-data.org API
3. Player joins via league code
4. Team selection UI with grid display
5. Selection submission
6. Round creation, locking, and validation
7. Elimination tracking
8. Standings display
9. Admin result override
10. Firestore data structure

### ⚠️ PARTIALLY IMPLEMENTED
- Team selection by round: Can select same team multiple rounds (need filter)
- Previous selections not hidden from player

### ❌ NOT IMPLEMENTED
- **Automatic team filtering**: Need to fetch previous selections and hide them
- **Fixture-based validation**: Currently rounds validate generically, may need fixture matching
- Notifications for eliminations
- Live scores/updates during the round
- Standings calculations (currently basic)

### ❓ UNCLEAR REQUIREMENTS
- Are teams permanently stored in database, or fetched on-demand from API?
- Should "previous selections unavailable" apply only to that player or all players?
- How are fixture results obtained and matched to selections?

---

## DATA FLOW SUMMARY

```
[1] ADMIN CREATES LEAGUE
    ↓
    └─→ Firestore: /leagues/{id} with competitionCode
    └─→ Teams fetched on-demand from API

[2] PLAYER JOINS LEAGUE
    ↓
    └─→ Firestore: /leagues/{id}/participants/{userId}

[3] ADMIN CREATES ROUND
    ↓
    └─→ Firestore: /leagues/{id}/rounds/{roundId}
    └─→ Status: "OPEN"

[4] PLAYER SELECTS TEAM
    ↓
    └─→ Firestore: /leagues/{id}/rounds/{roundId}/selections/{id}
    └─→ result: null, status: "PENDING"

[5] ADMIN LOCKS ROUND
    ↓
    └─→ Round status: "LOCKED"
    └─→ No more selections allowed

[6] ADMIN VALIDATES ROUND
    ↓
    ├─→ Fetches actual fixture results from API
    ├─→ Updates each selection: result = "WIN" | "LOSS" | "DRAW"
    └─→ If LOSS: participant.eliminated = true

[7] NEXT ROUND BEGINS
    ↓
    ├─→ Active players (eliminated = false) can select
    └─→ Need: Filter out their previous selections
```

---

## RECOMMENDATIONS FOR YOUR GAME

### Priority 1: Prevent Previous Selections
```tsx
// In /league/[id]/rounds/[roundId]/select/page.tsx
1. Fetch all previous selections for this user
2. Extract their selectedTeamIds
3. Filter out those teams from the display OR
4. Show them grayed out with "Your Round X pick" label
```

### Priority 2: Confirm Database Strategy
- Should teams be cached in Firestore when league is created?
- Or fetch on-demand from football-data.org API every time?
- Current: On-demand (flexible but slower)

### Priority 3: Fixture Integration
- How do fixture results map to player selections?
- Is it just: Did the selected team win that fixture?
- Or: Must the selection be a team playing in a specific matchweek?

### Priority 4: Enhanced UI
- Show previous rounds' selections in league detail page
- Add visual indication of when player was eliminated
- Add "Last chance" warning in final rounds

---

## TESTING SCENARIO

**To verify the game works correctly:**

1. Create league (PL)
2. Join league with 3 accounts
3. Create Round 1 (set times)
4. All 3 players select different teams
5. Lock Round 1
6. Validate Round 1 (manually set 1 winner, 2 losers)
7. Create Round 2
8. Check only 1 active player can select
9. Check standings show 2 eliminated

**Expected Result**: 
- 1 player active
- 2 players eliminated (showing "Lost in Round 1")
- Eliminated players cannot see selection page for Round 2

