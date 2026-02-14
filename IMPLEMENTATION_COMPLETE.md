# Implementation Summary: Teams Database & Selection Filtering

## Changes Made

### 1. ✅ Teams Now Saved to Database

**File Modified**: `/app/admin/page.tsx`

**What Changed**:
- When admin creates a league, teams are now automatically saved to Firestore
- Teams stored at: `/leagues/{leagueId}/teams/{teamId}`
- Each team document includes all team data + `savedAt` timestamp

**Before**:
```typescript
// Teams only displayed in preview, not saved
const docRef = await addDoc(collection(db, 'leagues'), {
  ...formData,
  leagueCode,
  ownerId: user.uid,
  // Teams not stored
});
```

**After**:
```typescript
// Create league
const docRef = await addDoc(collection(db, 'leagues'), {
  ...formData,
  leagueCode,
  ownerId: user.uid,
});

// Save teams to database
if (teams.length > 0) {
  const teamsRef = collection(db, 'leagues', docRef.id, 'teams');
  for (const team of teams) {
    await addDoc(teamsRef, {
      ...team,
      savedAt: Timestamp.now(),
    });
  }
}
```

---

### 2. ✅ Previous Selections Now Hidden

**File Modified**: `/app/league/[id]/rounds/[roundId]/select/page.tsx`

**What Changed**:
- Selection page now checks player's previous team selections
- Previously selected teams are filtered out (hidden from available list)
- Previously selected teams shown in a separate "Unavailable" section (grayed out)
- Player can only select from remaining teams

**Key Features**:
1. **Check if player is eliminated**
   - If `eliminated: true`, show error and prevent selection
   - Display: "You were eliminated in Round X"

2. **Fetch previous selections**
   - Query all selections across all rounds for current user
   - Extract team IDs they've already picked
   - Store in `previousSelections` Set

3. **Filter available teams**
   - `availableTeams` = All teams minus previous selections
   - Shown in main grid for selection

4. **Show unavailable teams**
   - Teams from previous rounds shown grayed out below
   - Labeled "Previously Selected (Unavailable)"
   - Not clickable

**UI Changes**:
```
Header: "Select 1 team from 19 available teams (1 used in previous rounds)"

[Available Teams Grid - Clickable]
Arsenal | Man City | Liverpool | Chelsea | ...

[Previously Used - Grayed Out]
Man United (✗ Used)

[Selected Summary]
Selected: Arsenal

[Submit / Cancel Buttons]
```

---

### 3. ✅ New API Endpoints Created

#### A. GET `/api/leagues/[leagueId]/teams`
**Purpose**: Fetch all teams saved for a league

**File**: `/app/api/leagues/[leagueId]/teams/route.ts`

**Response**:
```json
{
  "teams": [
    {
      "id": "1",
      "name": "Arsenal",
      "shortName": "ARS",
      "crest": "https://...",
      "savedAt": {...}
    },
    ...
  ]
}
```

---

#### B. GET `/api/leagues/[leagueId]/selections`
**Purpose**: Get all selections across all rounds (for filtering)

**File**: `/app/api/leagues/[leagueId]/selections/route.ts`

**Query Parameters**:
- `userId` - Optional, filter by specific user

**Response**:
```json
{
  "selections": [
    {
      "id": "sel123",
      "userId": "user456",
      "selectedTeamId": "1",
      "selectedTeamName": "Arsenal",
      "roundId": "round1",
      "roundNumber": 1,
      "result": "WIN"
    },
    {
      "id": "sel124",
      "userId": "user456",
      "selectedTeamId": "3",
      "selectedTeamName": "Chelsea",
      "roundId": "round2",
      "roundNumber": 2,
      "result": null
    }
  ]
}
```

---

#### C. GET `/api/leagues/[leagueId]/participants/[userId]`
**Purpose**: Get elimination status for a player

**File**: `/app/api/leagues/[leagueId]/participants/[userId]/route.ts`

**Response**:
```json
{
  "participant": {
    "id": "user456",
    "userId": "user456",
    "username": "John",
    "eliminated": false,
    "eliminatedAtRound": null,
    "eliminatedReason": null,
    "status": "ACTIVE"
  }
}
```

---

## Data Structure Changes

### Firestore - New Collections

**Before** (Teams in API only):
```
/leagues/{leagueId}
  └─ Basic league data only
```

**After** (Teams persisted):
```
/leagues/{leagueId}
  ├─ Basic league data
  └─ /teams/{teamId}
      ├─ id: "1"
      ├─ name: "Arsenal"
      ├─ shortName: "ARS"
      ├─ tla: "ARS"
      ├─ crest: "https://..."
      └─ savedAt: timestamp
```

---

## Game Flow with New Changes

### League Creation
```
Admin selects competition
       ↓
Admin fills league form
       ↓
League created + stored
       ↓
Teams fetched from API
       ↓
Teams saved to /leagues/{id}/teams ✓ NEW
       ↓
League code generated
```

### Player Makes Selection in Round 2
```
Player opens selection page
       ↓
Fetch teams from /leagues/{leagueId}/teams ✓ NEW (not API)
       ↓
Check if eliminated via /leagues/{leagueId}/participants/{userId} ✓ NEW
       ↓
If eliminated → Block access, show error
       ↓
If active → Fetch previous selections via /leagues/{leagueId}/selections ✓ NEW
       ↓
Filter out previous team IDs
       ↓
Show available teams (e.g., 18/20)
       ↓
Show unavailable teams grayed out ✓ NEW
       ↓
Player selects new team (not selected before)
       ↓
Submit selection
```

---

## Testing Checklist

### ✅ Test 1: League Creation with Teams
1. Go to `/admin`
2. Create new league (select PL)
3. Verify teams appear in preview
4. Create league
5. **Expected**: League created, 20 teams saved to DB

**Check in Firebase**:
```
/leagues/{NEW_ID}/teams should contain 20 documents
Each with: id, name, shortName, crest, savedAt
```

---

### ✅ Test 2: Player Joins and Selects Round 1
1. Join league as Player A
2. Go to Round 1 selection
3. Select "Arsenal"
4. Submit
5. **Expected**: Selection stored with Arsenal ID

**Check in Firebase**:
```
/leagues/{ID}/rounds/{roundId}/selections/{selId}
  selectedTeamId: "1"
  selectedTeamName: "Arsenal"
```

---

### ✅ Test 3: Eliminated Player Cannot Select
1. Admin validates Round 1 with Player A losing
2. Player A marked eliminated
3. Player A tries to access Round 2 selection
4. **Expected**: Error message "You were eliminated in Round 1"

**Check**:
- Selection page shows error
- Cannot make selection
- Can still view league/standings

---

### ✅ Test 4: Previous Selections Hidden
1. Player B wins Round 1 (selected "Liverpool")
2. Admin creates Round 2
3. Player B opens selection page
4. **Expected**: 
   - Main grid shows 19 teams (not Liverpool)
   - "Previously Selected" section shows Liverpool grayed out
   - Counter shows "19 available teams (1 used in previous rounds)"

**Check**:
- Can click other 19 teams
- Cannot click Liverpool
- Liverpool shows "✗ Used" badge

---

### ✅ Test 5: Multi-Round Progression
1. Round 1: Player C selects "Man City" (WINS)
2. Round 2: Player C selects "Chelsea" (WINS)
3. Round 3: Player C opens selection
4. **Expected**: 
   - Grid shows 18 teams (not Man City or Chelsea)
   - "Previously Selected" shows both (R1, R2)
   - Counter: "18 available teams (2 used in previous rounds)"

---

## Benefits of This Implementation

### ✅ **1. Consistency**
- Teams don't change mid-league
- Same teams available to all players
- No API dependency for ongoing league

### ✅ **2. Performance**
- One API call during league creation
- Subsequent calls use database (faster)
- Reduced API costs

### ✅ **3. Game Integrity**
- Players cannot reuse teams
- Fair competition across all rounds
- Clear "unavailable" indicators

### ✅ **4. Better UX**
- See which teams are unavailable
- Prevents selection errors
- Clear feedback if eliminated

---

## Files Changed

| File | Changes | Impact |
|------|---------|--------|
| `/app/admin/page.tsx` | Added team saving loop | Creates team docs when league created |
| `/app/league/[id]/rounds/[roundId]/select/page.tsx` | Added filtering logic, new API calls | Hides previous selections, blocks eliminated |
| `/app/api/leagues/[leagueId]/teams/route.ts` | NEW | Fetch saved teams |
| `/app/api/leagues/[leagueId]/selections/route.ts` | NEW | Fetch all selections for filtering |
| `/app/api/leagues/[leagueId]/participants/[userId]/route.ts` | NEW | Get player elimination status |

---

## Notes

- All changes are backward compatible
- Existing leagues still work (they just won't have teams in DB)
- New leagues automatically get teams in DB
- Optional: Could migrate old leagues via admin script

