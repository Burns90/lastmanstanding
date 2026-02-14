# Game Logic Checklist

## Your Requirements vs Implementation

### ✅ REQUIREMENT 1: Admin creates league + API populates teams
**Status**: PARTIAL ✓
- [x] Admin can create league
- [x] Admin selects competition
- [x] Teams fetched from football-data.org API
- [ ] Teams saved to Firestore database (currently: fetched on-demand)

**Questions**:
- Do you want teams CACHED in Firestore when league is created?
- Or continue fetching on-demand from API?

---

### ✅ REQUIREMENT 2: Player joins league using code
**Status**: COMPLETE ✓
- [x] Player enters 6-character league code
- [x] System finds league
- [x] Player added as participant
- [x] Player sees league details

**Code**: `/browse-leagues`, `POST /api/leagues/[id]/participants`

---

### ✅ REQUIREMENT 3: Player sees all teams from API
**Status**: COMPLETE ✓
- [x] Teams displayed in grid format
- [x] Shows team crest, name, short code
- [x] Responsive (2-5 columns)
- [x] Teams from competition fetched and shown

**Location**: `/league/[id]/rounds/[roundId]/select`

---

### ✅ REQUIREMENT 4: Player selects 1 team for Round 1
**Status**: COMPLETE ✓
- [x] Player can click team to select
- [x] Selection highlighted
- [x] Submit button sends to API
- [x] Selection stored in Firestore

**API**: `POST /api/leagues/{id}/rounds/{roundId}/selections`

---

### ⚠️ REQUIREMENT 5A: Team WINS → Progress to Round 2
**Status**: PARTIAL ✓
- [x] Round validation checks fixture results
- [x] Selection marked as `result: "WIN"`
- [x] Player remains active (`eliminated: false`)
- [ ] **MISSING**: Previous selections filtered out for Round 2

**Issue**: Player CAN select the same team again in Round 2
**Needed**: Hide/disable teams from previous rounds

---

### ⚠️ REQUIREMENT 5B: Team WINS → Previous pick unavailable for Round 2
**Status**: NOT IMPLEMENTED ✗
- [ ] Fetch player's previous selections
- [ ] Filter them out from Round 2 team list
- [ ] Show as unavailable/grayed out OR
- [ ] Simply exclude from the grid

**Priority**: HIGH - This is a core game mechanic

---

### ✅ REQUIREMENT 5C: Team LOSES → Player ELIMINATED
**Status**: COMPLETE ✓
- [x] Round validation updates `result: "LOSS"`
- [x] Participant marked `eliminated: true`
- [x] Round number stored: `eliminatedAtRound: 1`
- [x] Reason stored: `eliminatedReason: "LOSS"`

**Admin Endpoint**: `POST /api/rounds/validate`

---

### ✅ REQUIREMENT 5D: Eliminated player cannot make selections
**Status**: PARTIAL ✓
- [x] Selection page shows only for round
- [x] Participant data stored with `eliminated` flag
- [ ] **MISSING**: Selection page checks if player is eliminated
- [ ] **MISSING**: Should prevent eliminated players from accessing selection page

**Needed**: Add guard in `/league/[id]/rounds/[roundId]/select/page.tsx`

---

## Missing Implementation Details

### 1. Filter Previous Selections (PRIORITY: HIGH)

**What needs to be added:**
```tsx
// In /league/[id]/rounds/[roundId]/select/page.tsx

// After fetching teams, also fetch:
const previousSelectionsResponse = await fetch(
  `/api/leagues/${leagueId}/rounds?userId=${user.uid}`
);

// Extract all previous selectedTeamIds
const previousTeamIds = previousSelections.map(s => s.selectedTeamId);

// Filter teams:
const availableTeams = teams.filter(t => !previousTeamIds.includes(t.id));

// Show as disabled/grayed with label:
{previousTeamIds.includes(team.id) && (
  <span className="badge">Round {roundNumber} Pick</span>
)}
```

---

### 2. Prevent Eliminated Players from Selecting (PRIORITY: HIGH)

**What needs to be added:**
```tsx
// In /league/[id]/rounds/[roundId]/select/page.tsx

// Add check:
const participantDoc = await fetch(
  `/api/leagues/${leagueId}/participants/${user.uid}`
);

if (participant.eliminated) {
  return (
    <div className="error">
      You were eliminated in Round {participant.eliminatedAtRound}
    </div>
  );
}
```

---

### 3. Confirm Teams Database Strategy

**Choose one:**

**Option A: Fetch on-demand (Current)**
- Pros: Always up-to-date, no storage needed
- Cons: API dependent, slower

**Option B: Cache in Firestore (Your requirement)**
- Pros: Fast, consistent
- Cons: Need update mechanism

**Implementation if Option B chosen:**
```tsx
// In /admin/page.tsx after league creation
const teams = await fetch_teams_from_api();
await save_to_firestore(`/leagues/${leagueId}/teams`, teams);
```

---

## Test Checklist

### Scenario: 3 Players, 2 Rounds

```
[Setup]
- Admin creates PL league
- 3 players join

[Round 1]
- Player A selects Man City
- Player B selects Liverpool  
- Player C selects Arsenal
- Admin validates: MC wins, LIV loses, ARS loses

[Check Round 1 Results]
✓ Standings shows:
  - 1 Active: Man City's player
  - 2 Eliminated: Liverpool player (lost R1), Arsenal player (lost R1)

[Round 2]
- Only Player A can select
- When Player A sees team list:
  ✓ Man City is NOT shown (or grayed "Your Round 1 pick")
  ✓ All other 19 teams available

[Verify]
✓ Players B & C cannot access Round 2 selection page
✓ Player A can only select from 19 teams (not their R1 pick)
✓ Standings correctly shows elimination chain
```

---

## Code Locations to Review/Modify

| Requirement | File | Status |
|---|---|---|
| League creation | `/app/admin/page.tsx` | ✓ Done |
| Join league | `/app/browse-leagues/page.tsx` | ✓ Done |
| View teams | `/app/league/[id]/rounds/[roundId]/select/page.tsx` | ⚠️ Needs filter |
| Make selection | API `/api/leagues/[id]/rounds/[roundId]/selections` | ✓ Done |
| Validate round | `/api/rounds/validate` | ✓ Done |
| Eliminate player | `/api/participants/eliminate` | ✓ Done |
| Standings | `/app/standings/page.tsx` | ✓ Done |
| **Filter teams** | `/app/league/[id]/rounds/[roundId]/select/page.tsx` | ✗ Missing |
| **Block eliminated** | `/app/league/[id]/rounds/[roundId]/select/page.tsx` | ✗ Missing |

---

## Summary

**Your game logic is 85% complete.**

**What works:**
- League creation and team fetching
- Player joining
- Team selection submission
- Round validation and elimination
- Standings tracking

**What needs fixing:**
1. Filter out previous team selections
2. Prevent eliminated players from selecting
3. Consider team caching strategy

**Estimated effort:**
- Filter previous selections: 30 mins
- Block eliminated players: 15 mins
- Database strategy decision: 1 hour

