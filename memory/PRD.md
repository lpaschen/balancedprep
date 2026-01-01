# BalancedPrep - Macro Meal Planner PRD

## Original Problem Statement
Build a full-stack web app called BalancedPrep that turns a user's nutrition targets into a 7-day meal plan and a consolidated weekly grocery list.

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
- 3-step onboarding (targets → preferences → prep level)
- Dashboard with 7-day meal plan view
- Day selector with on-target indicators
- Nutrition summary per day with deltas
- Swap meal and regenerate day buttons
- Recipe detail modal
- Grocery list with category grouping and checkboxes
- Recipes page with search and filter
- Add recipe form
- Profile/settings page

### Dietary Preferences Supported
- Vegetarian, Vegan, Gluten-free, Dairy-free
- Keto, Paleo, Low-sodium, Nut-free

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
1. Consider adding PDF export for grocery list
2. Add recipe image upload functionality
3. Implement weekly nutrition charts
4. Add email verification for production deployment
