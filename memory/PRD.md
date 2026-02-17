# BalancedPrep - Macro Meal Planner PRD

## Original Problem Statement
Build a full-stack web app called BalancedPrep that turns a user's nutrition targets into a 7-day meal plan and a consolidated weekly grocery list.

## Bug Fixes (December 2025)

### Bug Fix Session - December 2025
#### Issue 1: Mismatched portions vs frequency on Meal Prep page
- **Problem**: "7x this week" showed but "cook 6 portions" - numbers didn't match
- **Root Cause**: `totalPortions` was using `Math.ceil(item.total_servings)` which summed serving multipliers instead of meal count
- **Fix**: Changed to `totalPortions = item.frequency` in MealPrepCard component
- **File**: `/app/frontend/src/pages/MealPrep.js`
- **Validation**: All recipes now show matching frequency/portion counts (e.g., 5x = Cook 5)

#### Issue 2: Recipe modal not scrollable
- **Problem**: Long recipe content was cut off in modals
- **Root Cause**: Missing overflow styles on DialogContent
- **Fix**: Added `overflow-hidden` and `overflow-y-auto` to all modals, properly implemented ScrollArea component
- **Files**: `Dashboard.js`, `Recipes.js`, `MealPrep.js`
- **Validation**: Modals now scroll properly with long content

#### Issue 3: Recipe images missing from UI
- **Problem**: Recipe cards and modals showed no images
- **Root Cause**: Frontend wasn't rendering `image_url` field from backend
- **Fix**: Added image display in recipe cards and modals across all pages
- **Files**: `Recipes.js`, `Dashboard.js`, `MealPrep.js`
- **Validation**: 39+ recipe images now display from Unsplash URLs
- **Note**: Fixed 2 invalid Unsplash URLs that were returning 404

### Bug Fix Session - January 2026
#### Issue 1: Dietary preferences not respected
- **Problem**: Vegan+GF users were seeing meat/dairy recipes
- **Root Cause**: Fallback code was ignoring preferences when no matching recipes found
- **Fix**: Removed fallback, strict preference filtering now enforced
- **Validation**: 100% of recipes now comply with dietary preferences

#### Issue 2: Macros too far off target
- **Problem**: Too high calories, too low protein vs targets
- **Root Cause**: Recipe selection and serving calculation not optimized for protein
- **Fix**: 
  - Added 15 new high-protein vegan+GF recipes (now 41 total, 28 vegan+GF)
  - Improved scoring algorithm to heavily favor high-protein recipes
  - Optimized serving calculation to weight protein 60% vs calories 40%
- **Validation**: Daily totals now within 10% tolerance for both calories and protein

## User Personas
1. **Health-conscious Professional** - Busy individual who wants structured meal planning without complexity
2. **Fitness Enthusiast** - Tracks macros closely, needs flexibility in target setting
3. **Family Meal Planner** - Wants batch cooking efficiency, lower prep variety

## Core Requirements (Static)
- Flexible nutrition targets (at least 1 of: calories, protein, carbs, fat)
- Daily accuracy within 10% tolerance
- Meal prep control via variety lever (1-5 scale)
- JWT-based authentication
- Seeded recipes (~16) + user-added recipes
- 7-day meal plan generation
- Swap meal / regenerate day functionality
- Consolidated grocery list with cross-off

## What's Been Implemented (January 1, 2026)

### Backend (FastAPI + MongoDB)
- User registration/login with JWT auth
- Profile management with targets, preferences, prep level
- Recipe CRUD with 16 seeded recipes
- Meal plan generation with tolerance-based optimization
- Swap meal and regenerate day endpoints
- Grocery list consolidation by category
- Toggle grocery item (checked/unchecked)

### Frontend (React + Tailwind + Shadcn)
- Landing page with "Nourished Earth" design theme
- Registration and login forms
- **NEW: 6-step professional onboarding flow** (December 2025):
  - Step 0: Professional positioning with value props
  - Step 1: Macro targets with real-time summary panel
  - Step 2: Food boundaries (dietary filters + allergens with live recipe pool count)
  - Step 3: Efficiency mode slider (Batch/Balanced/Variety) with dynamic preview
  - Step 4: Weekly automation preference (UI only, scheduling not implemented)
  - Step 5: Plan generation with animated loading states
- Dashboard with 7-day meal plan view
- Day selector with on-target indicators
- Nutrition summary per day with deltas
- Swap meal and regenerate day buttons
- Recipe detail modal with images
- Grocery list with category grouping and checkboxes
- Recipes page with search, filter, and recipe images
- Add recipe form
- Profile/settings page with "Redo Setup" button

### Dietary Preferences Supported
- Vegetarian, Vegan, Gluten-free, Dairy-free
- Keto, Paleo, Low-sodium, Nut-free
- Kosher, Halal (coming soon - UI disabled)

### Allergen Exclusions (NEW - December 2025)
- Nuts, Shellfish, Soy, Dairy, Eggs, Gluten
- Stored separately from dietary preferences
- Hard exclusion based on ingredient matching

## Prioritized Backlog

### P0 - Critical (Done)
- ✅ User authentication
- ✅ Meal plan generation
- ✅ Grocery list generation
- ✅ Core UI flows

### P1 - High Priority
- [ ] Email verification
- [ ] Password reset flow
- [ ] Recipe image upload (currently URL-based)
- [ ] Export grocery list to PDF/text

### P2 - Medium Priority
- [ ] Social sharing of meal plans
- [ ] Favorite recipes feature
- [ ] Recipe ratings/reviews
- [ ] Weekly nutrition summary chart
- [ ] Print-friendly meal plan view

### P3 - Nice to Have
- [ ] Mobile app (React Native)
- [ ] AI-powered recipe suggestions
- [ ] Integration with grocery delivery services
- [ ] Meal prep reminders/notifications

## Next Tasks
1. Implement actual backend scheduling for weekly automation (currently UI-only)
2. Investigate "Regenerate day" functionality (user reported not working)
3. Add printable meal prep checklist
4. Add Sunday vs. Wednesday prep day recommendations
5. Allow users to add custom items to grocery list
6. Implement "share grocery list" feature
7. Optimize N+1 query in grocery list generation
