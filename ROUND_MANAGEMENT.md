# Round & Fixture Management System

## Overview
This comprehensive system allows administrators to manage rounds and fixtures in the "Last Man Standing" game, and automatically eliminates players who select teams that lose their fixtures.

## Architecture

### 1. Fixtures Structure
Fixtures are stored as subcollections under each round:
```
/leagues/{leagueId}/rounds/{roundId}/fixtures/{fixtureId}
```

Each fixture contains:
- `homeTeamId`: Team ID of home team
- `homeTeamName`: Name of home team
- `awayTeamId`: Team ID of away team
- `awayTeamName`: Name of away team
- `kickoffTime`: When the fixture starts
- `status`: SCHEDULED, LIVE, or FINISHED
- `homeScore`: Home team's final or current score (null if not played)
- `awayScore`: Away team's final or current score (null if not played)

### 2. Selection Model
When players make a selection, they now link it to a specific fixture:
```
/leagues/{leagueId}/rounds/{roundId}/selections/{selectionId}
```

Fields:
- `userId`: The player's ID
- `selectedTeamId`: Which team they picked to win
- `selectedTeamName`: Team name (for quick display)
- `fixtureId`: Link to the fixture they're predicting on
- `result`: WIN, LOSS, DRAW (set during validation)

### 3. Validation & Elimination
When a round is validated:
1. System fetches all selections and their linked fixtures
2. For each fixture result:
   - **WIN**: Team selected won → Player survives
   - **LOSS**: Team selected lost → Player eliminated
   - **DRAW**: Treat as loss → Player eliminated
3. Admin overrides are checked and applied
4. Notifications sent to eliminated players
5. League completion checked (if only 1 player remains)

## Administrator Workflow

### Step 1: Create Round
1. Admin goes to League Details page (`/admin/league/{id}`)
2. Clicks "Create Round"
3. Fills in:
   - Round number
   - Start time (when round opens)
   - Lock time (deadline for selections)
4. Round created in OPEN status

### Step 2: Manage Fixtures
1. Admin clicks "Manage Fixtures" on the round card
2. Routes to: `/admin/league/{id}/rounds/{roundId}`
3. Can add fixtures with form:
   - Home Team ID (required)
   - Home Team Name (optional)
   - Away Team ID (required)
   - Away Team Name (optional)
   - Kickoff Time (required)
4. Fixtures display in chronological order
5. Each shows teams and kickoff time

### Step 3: Enter Fixture Results
1. On the round detail page, admin enters scores for completed fixtures
2. For each fixture shows:
   - Home team vs Away team matchup
   - Input fields for home score and away score
   - "Mark Complete" button
3. Clicking button:
   - Updates fixture status to FINISHED
   - Stores final scores
   - UI updates to show result

### Step 4: Lock Round
1. When selection deadline approaches, admin clicks "Lock Round"
2. Round status changes to LOCKED
3. Players can no longer make selections
4. Admin can now add overrides if needed

### Step 5: Validate & Eliminate
1. Admin clicks "Validate Round"
2. System:
   - Gets all player selections
   - Looks up their linked fixtures
   - Checks fixture results
   - Determines WIN/LOSS/DRAW for each player
   - Applies admin overrides
   - **Eliminates losing players**
   - Sends notifications
3. Round status changes to VALIDATED
4. Players can see results

## Player Workflow

### Step 1: View Available Fixtures
1. Player navigates to: `/league/{id}/rounds/{roundId}/select`
2. Sees list of all fixtures for the round
3. Displays each as: "Home Team vs Away Team" with kickoff time

### Step 2: Select Fixture
1. Player clicks on a fixture from the list
2. UI shows the two teams playing in that fixture
3. Option to choose home or away team

### Step 3: Make Prediction
1. Player clicks on their chosen team
2. Confirms their prediction
3. Submits selection

### Step 4: Selection Stored
Selection is saved with:
- Player's user ID
- Selected team ID
- Fixture ID (crucial link for validation)
- Status: PENDING

### Step 5: After Validation
1. Fixture result applied to selection
2. Result: WIN, LOSS, or DRAW
3. If WIN: Player survives to next round
4. If LOSS/DRAW: 
   - Player marked eliminated
   - Notification sent
   - Cannot make selections in future rounds
5. Player sees result on dashboard

## API Endpoints

### Fixture Management
```
GET /api/leagues/[leagueId]/rounds/[roundId]/fixtures
```
Returns all fixtures for a round

```
POST /api/leagues/[leagueId]/rounds/[roundId]/fixtures
```
Create new fixture (admin only)
Body: { homeTeamId, homeTeamName, awayTeamId, awayTeamName, kickoffTime }

```
PUT /api/leagues/[leagueId]/rounds/[roundId]/fixtures
```
Update fixture results (admin only)
Body: { fixtureId, homeScore, awayScore, status }

### Selections (Existing)
```
GET /api/leagues/[leagueId]/rounds/[roundId]/selections
```
Get all selections for a round

```
POST /api/leagues/[leagueId]/rounds/[roundId]/selections
```
Create selection (player)
Body: { userId, selectedTeamId, selectedTeamName, fixtureId }

### Round Management (Existing)
```
POST /api/rounds/lock
```
Lock a round

```
POST /api/rounds/validate
```
Validate round and eliminate losers

## Key Features

### 1. Fixture-Based Selections
- Players predict on **specific matches**, not just any team
- Creates tension: which team will they risk predicting on?
- Multiple fixtures per round: players choose their challenge

### 2. Automatic Elimination
- No manual admin work to eliminate losers
- System automatically processes results
- Notifications sent automatically
- Clean audit trail of why players were eliminated

### 3. Admin Control
- Can override fixture results if needed
- Can manually enter scores before showing players
- Can manually eliminate players if needed
- Full visibility into all selections vs fixture results

### 4. Player Experience
- Clear feedback on what they need to predict
- Simple binary choice: this team or that team
- Instant feedback when fixtures complete
- See who was eliminated and why

## Technical Details

### Type Definitions
```typescript
interface Fixture {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  kickoffTime: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore?: number;
  awayScore?: number;
}

interface Selection {
  id: string;
  userId: string;
  selectedTeamId: string;
  selectedTeamName: string;
  fixtureId: string;
  result?: "WIN" | "LOSS" | "DRAW";
}
```

### Database Schema
```
leagues/
  {leagueId}/
    rounds/
      {roundId}/
        fixtures/
          {fixtureId}/
            homeTeamId: string
            homeTeamName: string
            awayTeamId: string
            awayTeamName: string
            kickoffTime: timestamp
            status: string
            homeScore: number
            awayScore: number
        selections/
          {selectionId}/
            userId: string
            selectedTeamId: string
            selectedTeamName: string
            fixtureId: string  ← Link to fixture
            result: string
```

### Validation Logic
```javascript
// For each selection:
1. Find linked fixture
2. If fixture.status === "FINISHED":
   - Compare selectedTeamId with fixture result
   - If selected team won: result = "WIN"
   - If teams drew or lost: result = "LOSS" or "DRAW"
   - Check for admin override
   - If not WIN: eliminate player
   - Send notification with reason
```

## Best Practices

### For Admins
1. **Plan fixtures ahead**: Enter all fixtures before round opens if possible
2. **Clear kickoff times**: Set realistic times players can plan around
3. **Review before validating**: Check all fixture results are correct
4. **Use overrides sparingly**: Only for disputed calls or corrections
5. **Document overrides**: Add reason when overriding results

### For Players
1. **Check fixture times**: Know when your chosen match is played
2. **Choose wisely**: Each round is a gamble on that fixture's result
3. **Monitor standings**: See who's been eliminated and why
4. **Plan ahead**: Think about which teams you might use in future rounds

## Future Enhancements

1. **Automatic fixture imports**: Pull from football-data.org API
2. **Live updates**: Show live scores and match status
3. **Fixture notifications**: Alert players when matches start/finish
4. **Rewatch fixtures**: Video highlights or detailed match reviews
5. **Common picks**: Show what % of players picked which team
6. **Survivor pools**: Track players still alive throughout league

## Troubleshooting

### Fixture not showing in player selection
- Check fixture creation was successful (admin page should show it)
- Verify kickoff time is set
- Ensure round status is OPEN, not VALIDATED

### Selection not linking to fixture
- Verify fixtureId was passed in selection POST
- Check fixture exists before attempting selection

### Players not eliminated after validation
- Verify fixture status is "FINISHED"
- Check final scores were entered
- Look for admin overrides that might prevent elimination
- Check participant wasn't already eliminated

### Wrong player eliminated
- Use admin override to correct result
- Player should be re-evaluated after override
