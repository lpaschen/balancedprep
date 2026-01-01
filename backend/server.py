from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'balanced-prep-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    targets: Dict[str, Optional[float]] = Field(default_factory=lambda: {
        "calories": None,
        "protein": None,
        "carbs": None,
        "fat": None
    })
    preferences: List[str] = Field(default_factory=list)
    prep_level: int = Field(default=3, ge=1, le=5)  # 1=low prep, 5=high prep
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    onboarding_complete: bool = False

class UpdateTargets(BaseModel):
    targets: Dict[str, Optional[float]]
    preferences: List[str] = []
    prep_level: int = Field(default=3, ge=1, le=5)

class Recipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    meal_type: str  # breakfast, lunch, dinner, snack
    calories: float
    protein: float
    carbs: float
    fat: float
    ingredients: List[Dict[str, Any]]  # [{name, quantity, unit, category}]
    instructions: List[str] = []
    prep_time: int = 15  # minutes
    cook_time: int = 15
    servings: int = 1
    image_url: str = ""
    tags: List[str] = []  # vegetarian, vegan, gluten-free, etc.
    user_id: Optional[str] = None  # null = seeded recipe
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class RecipeCreate(BaseModel):
    name: str
    description: str = ""
    meal_type: str
    calories: float
    protein: float
    carbs: float
    fat: float
    ingredients: List[Dict[str, Any]]
    instructions: List[str] = []
    prep_time: int = 15
    cook_time: int = 15
    servings: int = 1
    image_url: str = ""
    tags: List[str] = []

class MealSlot(BaseModel):
    meal_type: str
    recipe_id: str
    recipe_name: str
    servings: float = 1.0
    calories: float
    protein: float
    carbs: float
    fat: float

class DayPlan(BaseModel):
    day: str  # Monday, Tuesday, etc.
    date: str
    meals: List[MealSlot]
    totals: Dict[str, float]
    deltas: Dict[str, Optional[float]]
    on_target: Dict[str, bool]

class MealPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    week_start: str
    days: List[DayPlan]
    unique_meals_count: int
    tolerance: float = 10.0  # percentage
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class GroceryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    quantity: float
    unit: str
    category: str
    checked: bool = False

class GroceryList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    meal_plan_id: str
    items: List[GroceryItem]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SwapMealRequest(BaseModel):
    day_index: int
    meal_index: int

class RegenerateDayRequest(BaseModel):
    day_index: int

class ToggleGroceryItem(BaseModel):
    item_id: str

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {"user_id": user_id, "exp": expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = UserProfile(
        email=user_data.email,
        name=user_data.name
    )
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    token = create_token(user.id)
    
    return {"token": token, "user": {k: v for k, v in user_dict.items() if k != "password" and k != "_id"}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"])
    user_data = {k: v for k, v in user.items() if k != "password" and k != "_id"}
    
    return {"token": token, "user": user_data}

# ============ USER ROUTES ============

@api_router.get("/user/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    return user

@api_router.put("/user/profile")
async def update_profile(data: UpdateTargets, user: dict = Depends(get_current_user)):
    # Validate at least one target is provided
    active_targets = {k: v for k, v in data.targets.items() if v is not None and v > 0}
    if not active_targets:
        raise HTTPException(status_code=400, detail="At least one nutrition target is required")
    
    update_data = {
        "targets": data.targets,
        "preferences": data.preferences,
        "prep_level": data.prep_level,
        "onboarding_complete": True
    }
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    
    return updated_user

# ============ RECIPE ROUTES ============

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes(meal_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"$or": [{"user_id": None}, {"user_id": user["id"]}]}
    if meal_type:
        query["meal_type"] = meal_type
    
    recipes = await db.recipes.find(query, {"_id": 0}).to_list(500)
    return recipes

@api_router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    recipe = await db.recipes.find_one(
        {"id": recipe_id, "$or": [{"user_id": None}, {"user_id": user["id"]}]},
        {"_id": 0}
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe_data: RecipeCreate, user: dict = Depends(get_current_user)):
    recipe = Recipe(
        **recipe_data.model_dump(),
        user_id=user["id"]
    )
    await db.recipes.insert_one(recipe.model_dump())
    return recipe

# ============ MEAL PLAN GENERATION ============

TOLERANCE_PERCENT = 10.0

def calculate_day_totals(meals: List[MealSlot]) -> Dict[str, float]:
    return {
        "calories": sum(m.calories * m.servings for m in meals),
        "protein": sum(m.protein * m.servings for m in meals),
        "carbs": sum(m.carbs * m.servings for m in meals),
        "fat": sum(m.fat * m.servings for m in meals)
    }

def calculate_deltas(totals: Dict[str, float], targets: Dict[str, Optional[float]]) -> Dict[str, Optional[float]]:
    deltas = {}
    for key in ["calories", "protein", "carbs", "fat"]:
        if targets.get(key) and targets[key] > 0:
            deltas[key] = totals[key] - targets[key]
        else:
            deltas[key] = None
    return deltas

def check_on_target(totals: Dict[str, float], targets: Dict[str, Optional[float]], tolerance: float) -> Dict[str, bool]:
    on_target = {}
    for key in ["calories", "protein", "carbs", "fat"]:
        if targets.get(key) and targets[key] > 0:
            diff_percent = abs(totals[key] - targets[key]) / targets[key] * 100
            on_target[key] = diff_percent <= tolerance
        else:
            on_target[key] = True  # Not constrained
    return on_target

async def select_recipe_for_meal(
    meal_type: str,
    targets: Dict[str, Optional[float]],
    preferences: List[str],
    used_recipe_ids: set,
    max_unique: int,
    current_unique: int,
    day_running_totals: Dict[str, float] = None,
    recipe_usage_count: Dict[str, int] = None
) -> Optional[tuple]:
    """Select a recipe that fits preferences and targets."""
    query = {"meal_type": meal_type}
    
    # STRICT dietary preference filtering - never ignore these
    strict_prefs = [p for p in preferences if p in ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'nut-free', 'keto', 'paleo', 'low-sodium']]
    
    if strict_prefs:
        query["tags"] = {"$all": strict_prefs}
    
    recipes = await db.recipes.find(query, {"_id": 0}).to_list(100)
    
    if not recipes:
        logger.warning(f"No recipes found for {meal_type} matching preferences: {strict_prefs}")
        return None
    
    usage_count = recipe_usage_count or {}
    
    # VARIETY LOGIC with minimum 2x usage guarantee:
    # 1. First, find recipes used exactly once (need to use again for 2x minimum)
    # 2. Then unused recipes (if we haven't hit max_unique)
    # 3. Finally, any used recipe
    
    once_used_recipes = [r for r in recipes if usage_count.get(r["id"], 0) == 1]
    unused_recipes = [r for r in recipes if r["id"] not in used_recipe_ids]
    used_recipes_list = [r for r in recipes if r["id"] in used_recipe_ids]
    
    # Prioritize recipes that need a second use
    if once_used_recipes:
        candidate_recipes = once_used_recipes
    elif current_unique < max_unique and unused_recipes:
        candidate_recipes = unused_recipes
    elif used_recipes_list:
        candidate_recipes = used_recipes_list
    else:
        candidate_recipes = recipes
    
    # Calculate what we still need to hit targets
    day_totals = day_running_totals or {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    
    # Meal fractions: main meals ~30% each, snack ~10%
    meal_fraction = 0.30 if meal_type in ["breakfast", "lunch", "dinner"] else 0.10
    
    # Score recipes - prioritize HIGH PROTEIN recipes that fit the meal slot
    def score_recipe(recipe):
        score = 0
        
        # Target macros for this meal slot
        target_cal = (targets.get("calories") or 2000) * meal_fraction
        target_prot = (targets.get("protein") or 100) * meal_fraction
        
        # HEAVILY favor high-protein recipes (main scoring factor)
        if targets.get("protein") and targets["protein"] > 0:
            # Reward recipes with protein close to or above target
            if recipe["protein"] >= target_prot:
                score += 50  # Big bonus for meeting protein target
            score += recipe["protein"] * 2  # Linear bonus for protein content
        
        # Penalize recipes that are way off on calories
        if targets.get("calories") and targets["calories"] > 0:
            cal_diff_pct = abs(recipe["calories"] - target_cal) / target_cal
            score -= cal_diff_pct * 10  # Small penalty for calorie mismatch
        
        # Add MORE randomness to create variety within the pool
        score += random.uniform(-15, 15)
        return score
    
    candidate_recipes.sort(key=score_recipe, reverse=True)
    selected = candidate_recipes[0]
    
    # Determine serving multiplier to hit targets
    serving = 1.0
    
    # Target macros for this meal
    target_cal = (targets.get("calories") or 2000) * meal_fraction
    target_prot = (targets.get("protein") or 100) * meal_fraction
    
    # Calculate ideal servings for each target
    ideal_cal_serving = target_cal / selected["calories"] if selected["calories"] > 0 else 1.0
    ideal_prot_serving = target_prot / selected["protein"] if selected["protein"] > 0 else 1.0
    
    # Weight protein more (60%) to ensure protein targets are hit
    if targets.get("protein") and targets["protein"] > 0:
        avg_serving = ideal_cal_serving * 0.4 + ideal_prot_serving * 0.6
    else:
        avg_serving = ideal_cal_serving
    
    # Round to nearest 0.25, allow 0.75 to 2.0 range
    serving = max(0.75, min(2.0, round(avg_serving * 4) / 4))
    
    return selected, serving

async def generate_day_plan(
    day_name: str,
    date_str: str,
    targets: Dict[str, Optional[float]],
    preferences: List[str],
    used_recipe_ids: set,
    max_unique: int,
    current_unique: int,
    recipe_usage_count: Dict[str, int] = None
) -> tuple:
    """Generate a single day's meal plan."""
    meals = []
    meal_types = ["breakfast", "lunch", "dinner", "snack"]
    usage_count = recipe_usage_count or {}
    
    # Track running totals to optimize each meal selection
    day_running_totals = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    
    for meal_type in meal_types:
        result = await select_recipe_for_meal(
            meal_type, targets, preferences, used_recipe_ids, max_unique, current_unique,
            day_running_totals, usage_count
        )
        if result:
            recipe, serving = result
            if recipe["id"] not in used_recipe_ids:
                current_unique += 1
            used_recipe_ids.add(recipe["id"])
            
            # Track usage count
            usage_count[recipe["id"]] = usage_count.get(recipe["id"], 0) + 1
            
            meals.append(MealSlot(
                meal_type=meal_type,
                recipe_id=recipe["id"],
                recipe_name=recipe["name"],
                servings=serving,
                calories=recipe["calories"],
                protein=recipe["protein"],
                carbs=recipe["carbs"],
                fat=recipe["fat"]
            ))
            
            # Update running totals for next meal selection
            day_running_totals["calories"] += recipe["calories"] * serving
            day_running_totals["protein"] += recipe["protein"] * serving
            day_running_totals["carbs"] += recipe["carbs"] * serving
            day_running_totals["fat"] += recipe["fat"] * serving
    
    totals = calculate_day_totals(meals)
    deltas = calculate_deltas(totals, targets)
    on_target = check_on_target(totals, targets, TOLERANCE_PERCENT)
    
    # If not on target, try to adjust servings or add booster snack
    if not all(on_target.values()):
        # Try adjusting servings
        for key in ["calories", "protein", "carbs", "fat"]:
            if not on_target.get(key, True) and targets.get(key):
                for meal in meals:
                    if deltas[key] > 0:  # Over target, reduce
                        if meal.servings > 0.5:
                            meal.servings = max(0.5, meal.servings - 0.5)
                    else:  # Under target, increase
                        if meal.servings < 2.0:
                            meal.servings = min(2.0, meal.servings + 0.5)
                    
                    # Recalculate
                    totals = calculate_day_totals(meals)
                    deltas = calculate_deltas(totals, targets)
                    on_target = check_on_target(totals, targets, TOLERANCE_PERCENT)
                    if on_target.get(key, True):
                        break
    
    day_plan = DayPlan(
        day=day_name,
        date=date_str,
        meals=meals,
        totals=totals,
        deltas=deltas,
        on_target=on_target
    )
    
    return day_plan, used_recipe_ids, current_unique, usage_count

@api_router.post("/meal-plan/generate")
async def generate_meal_plan(user: dict = Depends(get_current_user)):
    targets = user.get("targets", {})
    preferences = user.get("preferences", [])
    prep_level = user.get("prep_level", 3)
    
    # Validate at least one target
    active_targets = {k: v for k, v in targets.items() if v is not None and v > 0}
    if not active_targets:
        raise HTTPException(status_code=400, detail="Please set at least one nutrition target")
    
    # Max unique meals based on prep level
    # With 28 meal slots (7 days × 4 meals), to ensure each recipe appears 2x minimum:
    # max_unique should be at most 14 (28/2)
    # Level 1 (Minimal) = 5 unique (avg 5.6x each) - great for batch cooking
    # Level 2 (Low) = 7 unique (avg 4x each)
    # Level 3 (Moderate) = 9 unique (avg 3.1x each)
    # Level 4 (High) = 11 unique (avg 2.5x each)
    # Level 5 (Maximum) = 14 unique (avg 2x each) - still batched
    max_unique_map = {1: 5, 2: 7, 3: 9, 4: 11, 5: 14}
    max_unique = max_unique_map.get(prep_level, 9)
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    today = datetime.now(timezone.utc)
    # Start from next Monday
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    week_start = today + timedelta(days=days_until_monday)
    
    day_plans = []
    used_recipe_ids = set()
    recipe_usage_count = {}  # Track how many times each recipe is used
    current_unique = 0
    
    # First pass: Generate all days
    for i, day_name in enumerate(days):
        date_str = (week_start + timedelta(days=i)).strftime("%Y-%m-%d")
        day_plan, used_recipe_ids, current_unique = await generate_day_plan(
            day_name, date_str, targets, preferences, used_recipe_ids, max_unique, current_unique
        )
        day_plans.append(day_plan)
    
    meal_plan = MealPlan(
        user_id=user["id"],
        week_start=week_start.strftime("%Y-%m-%d"),
        days=day_plans,
        unique_meals_count=len(used_recipe_ids),
        tolerance=TOLERANCE_PERCENT
    )
    
    # Save meal plan
    await db.meal_plans.delete_many({"user_id": user["id"]})  # Remove old plans
    await db.meal_plans.insert_one(meal_plan.model_dump())
    
    # Generate grocery list
    await generate_grocery_list(user["id"], meal_plan)
    
    return meal_plan.model_dump()

@api_router.get("/meal-plan")
async def get_meal_plan(user: dict = Depends(get_current_user)):
    plan = await db.meal_plans.find_one({"user_id": user["id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="No meal plan found. Generate one first.")
    return plan

@api_router.put("/meal-plan/swap-meal")
async def swap_meal(request: SwapMealRequest, user: dict = Depends(get_current_user)):
    plan = await db.meal_plans.find_one({"user_id": user["id"]})
    if not plan:
        raise HTTPException(status_code=404, detail="No meal plan found")
    
    if request.day_index < 0 or request.day_index >= len(plan["days"]):
        raise HTTPException(status_code=400, detail="Invalid day index")
    
    day = plan["days"][request.day_index]
    if request.meal_index < 0 or request.meal_index >= len(day["meals"]):
        raise HTTPException(status_code=400, detail="Invalid meal index")
    
    old_meal = day["meals"][request.meal_index]
    meal_type = old_meal["meal_type"]
    targets = user.get("targets", {})
    preferences = user.get("preferences", [])
    
    # Get current recipe IDs to exclude
    current_ids = {old_meal["recipe_id"]}
    
    # Find alternative recipe - MUST respect dietary preferences
    preferences = user.get("preferences", [])
    query = {"meal_type": meal_type, "id": {"$ne": old_meal["recipe_id"]}}
    
    # STRICT dietary preference filtering
    if preferences:
        query["tags"] = {"$all": preferences}
    
    recipes = await db.recipes.find(query, {"_id": 0}).to_list(50)
    
    # NO FALLBACK - if no matching recipes, return error
    if not recipes:
        raise HTTPException(
            status_code=400, 
            detail=f"No alternative {meal_type} recipes available matching your dietary preferences ({', '.join(preferences)})"
        )
    
    new_recipe = random.choice(recipes)
    serving = 1.0
    if targets.get("calories") and targets["calories"] > 0:
        meal_fraction = 0.25 if meal_type in ["breakfast", "lunch", "dinner"] else 0.125
        target_calories = targets["calories"] * meal_fraction
        if new_recipe["calories"] > 0:
            ideal_serving = target_calories / new_recipe["calories"]
            serving = max(0.5, min(2.0, round(ideal_serving * 2) / 2))
    
    # Update meal
    day["meals"][request.meal_index] = {
        "meal_type": meal_type,
        "recipe_id": new_recipe["id"],
        "recipe_name": new_recipe["name"],
        "servings": serving,
        "calories": new_recipe["calories"],
        "protein": new_recipe["protein"],
        "carbs": new_recipe["carbs"],
        "fat": new_recipe["fat"]
    }
    
    # Recalculate day totals
    meals = [MealSlot(**m) for m in day["meals"]]
    totals = calculate_day_totals(meals)
    deltas = calculate_deltas(totals, targets)
    on_target = check_on_target(totals, targets, TOLERANCE_PERCENT)
    
    day["totals"] = totals
    day["deltas"] = deltas
    day["on_target"] = on_target
    
    # Recalculate unique meals count
    all_recipe_ids = set()
    for d in plan["days"]:
        for m in d["meals"]:
            all_recipe_ids.add(m["recipe_id"])
    plan["unique_meals_count"] = len(all_recipe_ids)
    
    await db.meal_plans.update_one({"id": plan["id"]}, {"$set": plan})
    
    # Regenerate grocery list
    await generate_grocery_list(user["id"], MealPlan(**{k: v for k, v in plan.items() if k != "_id"}))
    
    return {k: v for k, v in plan.items() if k != "_id"}

@api_router.put("/meal-plan/regenerate-day")
async def regenerate_day(request: RegenerateDayRequest, user: dict = Depends(get_current_user)):
    plan = await db.meal_plans.find_one({"user_id": user["id"]})
    if not plan:
        raise HTTPException(status_code=404, detail="No meal plan found")
    
    if request.day_index < 0 or request.day_index >= len(plan["days"]):
        raise HTTPException(status_code=400, detail="Invalid day index")
    
    targets = user.get("targets", {})
    preferences = user.get("preferences", [])
    prep_level = user.get("prep_level", 3)
    max_unique = 7 + (prep_level - 1) * 5
    
    # Get existing recipe IDs from other days
    used_recipe_ids = set()
    for i, d in enumerate(plan["days"]):
        if i != request.day_index:
            for m in d["meals"]:
                used_recipe_ids.add(m["recipe_id"])
    
    current_unique = len(used_recipe_ids)
    old_day = plan["days"][request.day_index]
    
    new_day, _, _ = await generate_day_plan(
        old_day["day"],
        old_day["date"],
        targets,
        preferences,
        used_recipe_ids,
        max_unique,
        current_unique
    )
    
    plan["days"][request.day_index] = new_day.model_dump()
    
    # Recalculate unique meals
    all_recipe_ids = set()
    for d in plan["days"]:
        for m in d["meals"]:
            all_recipe_ids.add(m["recipe_id"])
    plan["unique_meals_count"] = len(all_recipe_ids)
    
    await db.meal_plans.update_one({"id": plan["id"]}, {"$set": {
        "days": plan["days"],
        "unique_meals_count": plan["unique_meals_count"]
    }})
    
    # Regenerate grocery list
    await generate_grocery_list(user["id"], MealPlan(**{k: v for k, v in plan.items() if k != "_id"}))
    
    return {k: v for k, v in plan.items() if k != "_id"}

# ============ GROCERY LIST ============

# Map ingredient names to granular categories
INGREDIENT_CATEGORY_MAP = {
    # Proteins
    "tofu": "Proteins", "tempeh": "Proteins", "seitan": "Proteins", "tvp": "Proteins",
    "chicken": "Meat", "beef": "Meat", "turkey": "Meat", "pork": "Meat",
    "salmon": "Seafood", "fish": "Seafood", "shrimp": "Seafood",
    
    # Dairy & Eggs
    "yogurt": "Dairy & Eggs", "milk": "Dairy & Eggs", "cheese": "Dairy & Eggs", 
    "eggs": "Dairy & Eggs", "butter": "Dairy & Eggs", "cream": "Dairy & Eggs",
    "feta": "Dairy & Eggs", "cheddar": "Dairy & Eggs",
    
    # Grains & Pasta
    "rice": "Grains & Pasta", "quinoa": "Grains & Pasta", "oats": "Grains & Pasta",
    "pasta": "Grains & Pasta", "farro": "Grains & Pasta", "bread": "Bakery",
    "tortilla": "Bakery", "wrap": "Bakery",
    
    # Legumes & Beans
    "chickpea": "Legumes & Beans", "lentil": "Legumes & Beans", "black bean": "Legumes & Beans",
    "bean": "Legumes & Beans", "edamame": "Legumes & Beans", "lupini": "Legumes & Beans",
    
    # Nuts & Seeds
    "almond": "Nuts & Seeds", "peanut": "Nuts & Seeds", "walnut": "Nuts & Seeds",
    "cashew": "Nuts & Seeds", "chia": "Nuts & Seeds", "hemp": "Nuts & Seeds",
    "sesame": "Nuts & Seeds", "pumpkin seed": "Nuts & Seeds", "sunflower": "Nuts & Seeds",
    "nut": "Nuts & Seeds", "seed": "Nuts & Seeds",
    
    # Oils & Vinegars
    "oil": "Oils & Vinegars", "olive oil": "Oils & Vinegars", "sesame oil": "Oils & Vinegars",
    "vinegar": "Oils & Vinegars", "coconut oil": "Oils & Vinegars",
    
    # Spices & Seasonings
    "salt": "Spices & Seasonings", "pepper": "Spices & Seasonings", "cumin": "Spices & Seasonings",
    "turmeric": "Spices & Seasonings", "paprika": "Spices & Seasonings", "curry": "Spices & Seasonings",
    "garlic powder": "Spices & Seasonings", "herbs": "Spices & Seasonings", "spice": "Spices & Seasonings",
    "cinnamon": "Spices & Seasonings", "ginger powder": "Spices & Seasonings",
    "italian herbs": "Spices & Seasonings", "taco seasoning": "Spices & Seasonings",
    "red pepper flakes": "Spices & Seasonings",
    
    # Sauces & Condiments
    "tamari": "Sauces & Condiments", "soy sauce": "Sauces & Condiments", "sriracha": "Sauces & Condiments",
    "salsa": "Sauces & Condiments", "mustard": "Sauces & Condiments", "tahini": "Sauces & Condiments",
    "hummus": "Sauces & Condiments", "maple syrup": "Sauces & Condiments", "honey": "Sauces & Condiments",
    "peanut butter": "Sauces & Condiments", "almond butter": "Sauces & Condiments",
    "sour cream": "Sauces & Condiments",
    
    # Canned Goods
    "crushed tomato": "Canned Goods", "tomato": "Canned Goods", "coconut milk": "Canned Goods",
    "broth": "Canned Goods", "vegetable broth": "Canned Goods",
    
    # Produce (fresh)
    "spinach": "Produce", "kale": "Produce", "lettuce": "Produce", "broccoli": "Produce",
    "carrot": "Produce", "onion": "Produce", "garlic": "Produce", "ginger": "Produce",
    "bell pepper": "Produce", "cucumber": "Produce", "tomato": "Produce", "avocado": "Produce",
    "banana": "Produce", "apple": "Produce", "lemon": "Produce", "lime": "Produce",
    "berry": "Produce", "potato": "Produce", "sweet potato": "Produce",
    "cabbage": "Produce", "bok choy": "Produce", "celery": "Produce", "parsley": "Produce",
    "cauliflower": "Produce", "corn": "Produce", "snap pea": "Produce",
    
    # Protein powders
    "protein powder": "Proteins", "pea protein": "Proteins",
    
    # Frozen
    "frozen": "Frozen",
}

def get_granular_category(ingredient_name: str, default_category: str) -> str:
    """Map ingredient to a more granular category."""
    name_lower = ingredient_name.lower()
    
    # Check for exact or partial matches
    for keyword, category in INGREDIENT_CATEGORY_MAP.items():
        if keyword in name_lower:
            return category
    
    # Map old 'Pantry' to more specific categories based on context
    if default_category == "Pantry":
        # Try to infer from name
        if any(x in name_lower for x in ["flour", "sugar", "baking"]):
            return "Baking"
        if any(x in name_lower for x in ["chip", "cracker", "granola"]):
            return "Snacks"
        return "Other"
    
    # Map old 'Dairy' to new 'Dairy & Eggs'
    if default_category == "Dairy":
        return "Dairy & Eggs"
    
    return default_category

async def generate_grocery_list(user_id: str, meal_plan: MealPlan):
    """Generate consolidated grocery list from meal plan."""
    ingredients_map = {}  # {name_unit: {name, quantity, unit, category}}
    
    for day in meal_plan.days:
        for meal in day.meals:
            recipe = await db.recipes.find_one({"id": meal.recipe_id}, {"_id": 0})
            if recipe:
                for ing in recipe.get("ingredients", []):
                    key = f"{ing['name'].lower()}_{ing.get('unit', 'unit')}"
                    # Get granular category
                    category = get_granular_category(ing["name"], ing.get("category", "Other"))
                    
                    if key in ingredients_map:
                        ingredients_map[key]["quantity"] += ing.get("quantity", 1) * meal.servings
                    else:
                        ingredients_map[key] = {
                            "id": str(uuid.uuid4()),
                            "name": ing["name"],
                            "quantity": ing.get("quantity", 1) * meal.servings,
                            "unit": ing.get("unit", "unit"),
                            "category": category,
                            "checked": False
                        }
    
    items = list(ingredients_map.values())
    
    grocery_list = GroceryList(
        user_id=user_id,
        meal_plan_id=meal_plan.id,
        items=[GroceryItem(**item) for item in items]
    )
    
    await db.grocery_lists.delete_many({"user_id": user_id})
    await db.grocery_lists.insert_one(grocery_list.model_dump())
    
    return grocery_list

@api_router.get("/grocery-list")
async def get_grocery_list(user: dict = Depends(get_current_user)):
    grocery_list = await db.grocery_lists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not grocery_list:
        raise HTTPException(status_code=404, detail="No grocery list found. Generate a meal plan first.")
    return grocery_list

@api_router.put("/grocery-list/toggle")
async def toggle_grocery_item(request: ToggleGroceryItem, user: dict = Depends(get_current_user)):
    grocery_list = await db.grocery_lists.find_one({"user_id": user["id"]})
    if not grocery_list:
        raise HTTPException(status_code=404, detail="No grocery list found")
    
    updated = False
    for item in grocery_list["items"]:
        if item["id"] == request.item_id:
            item["checked"] = not item["checked"]
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.grocery_lists.update_one(
        {"id": grocery_list["id"]},
        {"$set": {"items": grocery_list["items"]}}
    )
    
    return {k: v for k, v in grocery_list.items() if k != "_id"}

# ============ SEED DATA ============

SEED_RECIPES = [
    # Breakfast
    {
        "name": "Greek Yogurt Parfait",
        "description": "Creamy yogurt layered with fresh berries and crunchy granola",
        "meal_type": "breakfast",
        "calories": 350,
        "protein": 20,
        "carbs": 45,
        "fat": 10,
        "ingredients": [
            {"name": "Greek Yogurt", "quantity": 1, "unit": "cup", "category": "Dairy"},
            {"name": "Mixed Berries", "quantity": 0.5, "unit": "cup", "category": "Produce"},
            {"name": "Granola", "quantity": 0.25, "unit": "cup", "category": "Pantry"},
            {"name": "Honey", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Layer yogurt in a bowl", "Add berries", "Top with granola and drizzle honey"],
        "prep_time": 5,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegetarian", "gluten-free"],
        "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400"
    },
    {
        "name": "Avocado Toast with Eggs",
        "description": "Whole grain toast topped with smashed avocado and poached eggs",
        "meal_type": "breakfast",
        "calories": 420,
        "protein": 18,
        "carbs": 35,
        "fat": 25,
        "ingredients": [
            {"name": "Whole Grain Bread", "quantity": 2, "unit": "slices", "category": "Bakery"},
            {"name": "Avocado", "quantity": 1, "unit": "whole", "category": "Produce"},
            {"name": "Eggs", "quantity": 2, "unit": "large", "category": "Dairy"},
            {"name": "Salt", "quantity": 1, "unit": "pinch", "category": "Pantry"},
            {"name": "Red Pepper Flakes", "quantity": 1, "unit": "pinch", "category": "Pantry"}
        ],
        "instructions": ["Toast bread", "Mash avocado and spread on toast", "Poach or fry eggs", "Place eggs on avocado toast", "Season with salt and pepper flakes"],
        "prep_time": 5,
        "cook_time": 10,
        "servings": 1,
        "tags": ["vegetarian"],
        "image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400"
    },
    {
        "name": "Overnight Oats",
        "description": "Creamy oats soaked overnight with chia seeds and almond milk",
        "meal_type": "breakfast",
        "calories": 380,
        "protein": 12,
        "carbs": 55,
        "fat": 12,
        "ingredients": [
            {"name": "Rolled Oats", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Almond Milk", "quantity": 0.75, "unit": "cup", "category": "Dairy"},
            {"name": "Chia Seeds", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Maple Syrup", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Banana", "quantity": 0.5, "unit": "whole", "category": "Produce"}
        ],
        "instructions": ["Mix oats, milk, chia seeds, and maple syrup", "Refrigerate overnight", "Top with sliced banana before serving"],
        "prep_time": 5,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegetarian", "vegan", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400"
    },
    {
        "name": "Veggie Scramble",
        "description": "Fluffy scrambled eggs with sautéed vegetables",
        "meal_type": "breakfast",
        "calories": 320,
        "protein": 22,
        "carbs": 12,
        "fat": 20,
        "ingredients": [
            {"name": "Eggs", "quantity": 3, "unit": "large", "category": "Dairy"},
            {"name": "Bell Pepper", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Spinach", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Olive Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Feta Cheese", "quantity": 2, "unit": "tbsp", "category": "Dairy"}
        ],
        "instructions": ["Sauté peppers in olive oil", "Add spinach until wilted", "Pour in beaten eggs and scramble", "Top with feta"],
        "prep_time": 5,
        "cook_time": 10,
        "servings": 1,
        "tags": ["vegetarian", "gluten-free", "keto"],
        "image_url": "https://images.unsplash.com/photo-1482049016gy-47b67d08bh89?w=400"
    },
    # Lunch
    {
        "name": "Grilled Chicken Salad",
        "description": "Fresh mixed greens with grilled chicken breast and balsamic vinaigrette",
        "meal_type": "lunch",
        "calories": 450,
        "protein": 40,
        "carbs": 20,
        "fat": 25,
        "ingredients": [
            {"name": "Chicken Breast", "quantity": 6, "unit": "oz", "category": "Meat"},
            {"name": "Mixed Greens", "quantity": 3, "unit": "cups", "category": "Produce"},
            {"name": "Cherry Tomatoes", "quantity": 0.5, "unit": "cup", "category": "Produce"},
            {"name": "Cucumber", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Balsamic Vinegar", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Olive Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Grill chicken breast until cooked through", "Slice and place over mixed greens", "Add tomatoes and cucumber", "Drizzle with balsamic and olive oil"],
        "prep_time": 10,
        "cook_time": 15,
        "servings": 1,
        "tags": ["gluten-free", "dairy-free", "paleo"],
        "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
    },
    {
        "name": "Quinoa Buddha Bowl",
        "description": "Nutritious bowl with quinoa, roasted vegetables, and tahini dressing",
        "meal_type": "lunch",
        "calories": 520,
        "protein": 18,
        "carbs": 65,
        "fat": 22,
        "ingredients": [
            {"name": "Quinoa", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Sweet Potato", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Chickpeas", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Kale", "quantity": 2, "unit": "cups", "category": "Produce"},
            {"name": "Tahini", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Lemon Juice", "quantity": 1, "unit": "tbsp", "category": "Produce"}
        ],
        "instructions": ["Cook quinoa according to package", "Roast cubed sweet potato and chickpeas", "Massage kale with lemon juice", "Assemble bowl and drizzle with tahini"],
        "prep_time": 15,
        "cook_time": 30,
        "servings": 1,
        "tags": ["vegetarian", "vegan", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400"
    },
    {
        "name": "Turkey & Avocado Wrap",
        "description": "Lean turkey with fresh avocado in a whole wheat wrap",
        "meal_type": "lunch",
        "calories": 480,
        "protein": 35,
        "carbs": 40,
        "fat": 20,
        "ingredients": [
            {"name": "Turkey Breast", "quantity": 4, "unit": "oz", "category": "Meat"},
            {"name": "Whole Wheat Wrap", "quantity": 1, "unit": "large", "category": "Bakery"},
            {"name": "Avocado", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Lettuce", "quantity": 2, "unit": "leaves", "category": "Produce"},
            {"name": "Tomato", "quantity": 2, "unit": "slices", "category": "Produce"},
            {"name": "Mustard", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Spread mustard on wrap", "Layer turkey, avocado, lettuce, and tomato", "Roll tightly and cut in half"],
        "prep_time": 10,
        "cook_time": 0,
        "servings": 1,
        "tags": ["dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400"
    },
    {
        "name": "Mediterranean Grain Bowl",
        "description": "Farro with hummus, feta, olives, and fresh vegetables",
        "meal_type": "lunch",
        "calories": 550,
        "protein": 16,
        "carbs": 60,
        "fat": 28,
        "ingredients": [
            {"name": "Farro", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Hummus", "quantity": 3, "unit": "tbsp", "category": "Deli"},
            {"name": "Feta Cheese", "quantity": 2, "unit": "oz", "category": "Dairy"},
            {"name": "Kalamata Olives", "quantity": 8, "unit": "whole", "category": "Pantry"},
            {"name": "Cucumber", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Red Onion", "quantity": 0.25, "unit": "whole", "category": "Produce"}
        ],
        "instructions": ["Cook farro according to package", "Let cool slightly", "Top with hummus, feta, olives, and vegetables"],
        "prep_time": 10,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegetarian"],
        "image_url": "https://images.unsplash.com/photo-1529059997568-3d847b1154f0?w=400"
    },
    # Dinner
    {
        "name": "Baked Salmon with Vegetables",
        "description": "Omega-rich salmon fillet with roasted seasonal vegetables",
        "meal_type": "dinner",
        "calories": 520,
        "protein": 42,
        "carbs": 25,
        "fat": 28,
        "ingredients": [
            {"name": "Salmon Fillet", "quantity": 6, "unit": "oz", "category": "Seafood"},
            {"name": "Broccoli", "quantity": 1.5, "unit": "cups", "category": "Produce"},
            {"name": "Carrots", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Olive Oil", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Lemon", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Garlic", "quantity": 2, "unit": "cloves", "category": "Produce"}
        ],
        "instructions": ["Preheat oven to 400°F", "Season salmon with garlic and lemon", "Toss vegetables with olive oil", "Bake salmon and vegetables for 20 minutes"],
        "prep_time": 10,
        "cook_time": 25,
        "servings": 1,
        "tags": ["gluten-free", "dairy-free", "paleo"],
        "image_url": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400"
    },
    {
        "name": "Chicken Stir-Fry",
        "description": "Quick stir-fried chicken with colorful vegetables in a savory sauce",
        "meal_type": "dinner",
        "calories": 480,
        "protein": 38,
        "carbs": 35,
        "fat": 20,
        "ingredients": [
            {"name": "Chicken Breast", "quantity": 6, "unit": "oz", "category": "Meat"},
            {"name": "Bell Peppers", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Snap Peas", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Soy Sauce", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Sesame Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Brown Rice", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Ginger", "quantity": 1, "unit": "tsp", "category": "Produce"}
        ],
        "instructions": ["Cook rice according to package", "Slice chicken and stir-fry until golden", "Add vegetables and stir-fry 3-4 minutes", "Add soy sauce and ginger", "Serve over rice"],
        "prep_time": 15,
        "cook_time": 20,
        "servings": 1,
        "tags": ["dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400"
    },
    {
        "name": "Vegetable Curry",
        "description": "Aromatic coconut curry with chickpeas and mixed vegetables",
        "meal_type": "dinner",
        "calories": 450,
        "protein": 14,
        "carbs": 55,
        "fat": 22,
        "ingredients": [
            {"name": "Chickpeas", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "Coconut Milk", "quantity": 0.5, "unit": "can", "category": "Pantry"},
            {"name": "Cauliflower", "quantity": 2, "unit": "cups", "category": "Produce"},
            {"name": "Spinach", "quantity": 2, "unit": "cups", "category": "Produce"},
            {"name": "Curry Powder", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Basmati Rice", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Onion", "quantity": 1, "unit": "medium", "category": "Produce"}
        ],
        "instructions": ["Cook rice", "Sauté onion until soft", "Add curry powder and cook 1 minute", "Add coconut milk, chickpeas, and cauliflower", "Simmer 15 minutes", "Stir in spinach"],
        "prep_time": 10,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegetarian", "vegan", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400"
    },
    {
        "name": "Lean Beef Tacos",
        "description": "Seasoned ground beef in corn tortillas with fresh toppings",
        "meal_type": "dinner",
        "calories": 520,
        "protein": 32,
        "carbs": 45,
        "fat": 24,
        "ingredients": [
            {"name": "Lean Ground Beef", "quantity": 5, "unit": "oz", "category": "Meat"},
            {"name": "Corn Tortillas", "quantity": 3, "unit": "small", "category": "Bakery"},
            {"name": "Lettuce", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Tomato", "quantity": 0.5, "unit": "cup", "category": "Produce"},
            {"name": "Cheddar Cheese", "quantity": 2, "unit": "tbsp", "category": "Dairy"},
            {"name": "Taco Seasoning", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Sour Cream", "quantity": 2, "unit": "tbsp", "category": "Dairy"}
        ],
        "instructions": ["Brown beef and add taco seasoning", "Warm tortillas", "Assemble tacos with beef and toppings"],
        "prep_time": 10,
        "cook_time": 15,
        "servings": 1,
        "tags": ["gluten-free"],
        "image_url": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400"
    },
    # Snacks
    {
        "name": "Apple with Almond Butter",
        "description": "Crisp apple slices with creamy almond butter",
        "meal_type": "snack",
        "calories": 250,
        "protein": 6,
        "carbs": 30,
        "fat": 14,
        "ingredients": [
            {"name": "Apple", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Almond Butter", "quantity": 2, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Slice apple", "Serve with almond butter for dipping"],
        "prep_time": 2,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegetarian", "vegan", "gluten-free", "dairy-free", "paleo"],
        "image_url": "https://images.unsplash.com/photo-1568702846914-96b305d2uj1c?w=400"
    },
    {
        "name": "Hummus & Veggie Sticks",
        "description": "Creamy hummus with fresh carrot and celery sticks",
        "meal_type": "snack",
        "calories": 180,
        "protein": 6,
        "carbs": 22,
        "fat": 8,
        "ingredients": [
            {"name": "Hummus", "quantity": 3, "unit": "tbsp", "category": "Deli"},
            {"name": "Carrots", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Celery", "quantity": 2, "unit": "stalks", "category": "Produce"}
        ],
        "instructions": ["Cut vegetables into sticks", "Serve with hummus"],
        "prep_time": 5,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegetarian", "vegan", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400"
    },
    {
        "name": "Protein Energy Balls",
        "description": "No-bake energy balls with oats, protein, and chocolate chips",
        "meal_type": "snack",
        "calories": 220,
        "protein": 10,
        "carbs": 25,
        "fat": 10,
        "ingredients": [
            {"name": "Rolled Oats", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Peanut Butter", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Honey", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Chocolate Chips", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Protein Powder", "quantity": 1, "unit": "scoop", "category": "Pantry"}
        ],
        "instructions": ["Mix all ingredients", "Roll into balls", "Refrigerate 30 minutes"],
        "prep_time": 10,
        "cook_time": 0,
        "servings": 2,
        "tags": ["vegetarian"],
        "image_url": "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400"
    },
    {
        "name": "Greek Yogurt with Nuts",
        "description": "Protein-rich yogurt topped with mixed nuts",
        "meal_type": "snack",
        "calories": 200,
        "protein": 15,
        "carbs": 12,
        "fat": 10,
        "ingredients": [
            {"name": "Greek Yogurt", "quantity": 0.75, "unit": "cup", "category": "Dairy"},
            {"name": "Mixed Nuts", "quantity": 2, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Top yogurt with nuts"],
        "prep_time": 2,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegetarian", "gluten-free"],
        "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400"
    },
    # ============ VEGAN + GLUTEN-FREE HIGH PROTEIN RECIPES ============
    # Breakfast - Vegan GF
    {
        "name": "High-Protein Tofu Scramble",
        "description": "Savory scrambled tofu with vegetables and nutritional yeast",
        "meal_type": "breakfast",
        "calories": 380,
        "protein": 28,
        "carbs": 18,
        "fat": 22,
        "ingredients": [
            {"name": "Extra Firm Tofu", "quantity": 14, "unit": "oz", "category": "Produce"},
            {"name": "Nutritional Yeast", "quantity": 3, "unit": "tbsp", "category": "Pantry"},
            {"name": "Turmeric", "quantity": 0.5, "unit": "tsp", "category": "Pantry"},
            {"name": "Spinach", "quantity": 2, "unit": "cups", "category": "Produce"},
            {"name": "Bell Pepper", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Olive Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Press and crumble tofu", "Sauté vegetables", "Add tofu with turmeric and nutritional yeast", "Cook until golden"],
        "prep_time": 10,
        "cook_time": 15,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400"
    },
    {
        "name": "Protein Smoothie Bowl",
        "description": "Thick smoothie bowl topped with seeds and hemp hearts",
        "meal_type": "breakfast",
        "calories": 420,
        "protein": 25,
        "carbs": 48,
        "fat": 16,
        "ingredients": [
            {"name": "Frozen Banana", "quantity": 1, "unit": "whole", "category": "Produce"},
            {"name": "Pea Protein Powder", "quantity": 1, "unit": "scoop", "category": "Pantry"},
            {"name": "Hemp Hearts", "quantity": 3, "unit": "tbsp", "category": "Pantry"},
            {"name": "Almond Milk", "quantity": 0.5, "unit": "cup", "category": "Dairy"},
            {"name": "Peanut Butter", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Chia Seeds", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Blend banana, protein, almond milk, and peanut butter", "Pour into bowl", "Top with hemp hearts and chia seeds"],
        "prep_time": 5,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=400"
    },
    {
        "name": "Chickpea Flour Pancakes",
        "description": "Savory high-protein pancakes made with chickpea flour",
        "meal_type": "breakfast",
        "calories": 350,
        "protein": 18,
        "carbs": 42,
        "fat": 12,
        "ingredients": [
            {"name": "Chickpea Flour", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "Water", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "Cumin", "quantity": 0.5, "unit": "tsp", "category": "Pantry"},
            {"name": "Onion", "quantity": 0.25, "unit": "whole", "category": "Produce"},
            {"name": "Olive Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Mix chickpea flour with water and spices", "Let rest 10 minutes", "Cook like pancakes in oiled pan"],
        "prep_time": 15,
        "cook_time": 10,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400"
    },
    # Lunch - Vegan GF High Protein
    {
        "name": "Tempeh Buddha Bowl",
        "description": "Marinated tempeh with quinoa and roasted vegetables",
        "meal_type": "lunch",
        "calories": 550,
        "protein": 32,
        "carbs": 52,
        "fat": 24,
        "ingredients": [
            {"name": "Tempeh", "quantity": 6, "unit": "oz", "category": "Produce"},
            {"name": "Quinoa", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Broccoli", "quantity": 1.5, "unit": "cups", "category": "Produce"},
            {"name": "Tahini", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Tamari", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Maple Syrup", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Marinate tempeh in tamari and maple syrup", "Cook quinoa", "Roast broccoli", "Pan-fry tempeh", "Assemble with tahini drizzle"],
        "prep_time": 15,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400"
    },
    {
        "name": "Lentil Soup",
        "description": "Hearty red lentil soup with warming spices",
        "meal_type": "lunch",
        "calories": 420,
        "protein": 24,
        "carbs": 58,
        "fat": 10,
        "ingredients": [
            {"name": "Red Lentils", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "Vegetable Broth", "quantity": 3, "unit": "cups", "category": "Pantry"},
            {"name": "Onion", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Carrots", "quantity": 2, "unit": "medium", "category": "Produce"},
            {"name": "Cumin", "quantity": 1, "unit": "tsp", "category": "Pantry"},
            {"name": "Garlic", "quantity": 3, "unit": "cloves", "category": "Produce"}
        ],
        "instructions": ["Sauté onion and garlic", "Add carrots and spices", "Add lentils and broth", "Simmer 25 minutes until lentils are soft"],
        "prep_time": 10,
        "cook_time": 30,
        "servings": 2,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400"
    },
    {
        "name": "Black Bean Taco Bowl",
        "description": "Spiced black beans over rice with fresh vegetables",
        "meal_type": "lunch",
        "calories": 480,
        "protein": 22,
        "carbs": 72,
        "fat": 12,
        "ingredients": [
            {"name": "Black Beans", "quantity": 1.5, "unit": "cups", "category": "Pantry"},
            {"name": "Brown Rice", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Avocado", "quantity": 0.5, "unit": "whole", "category": "Produce"},
            {"name": "Salsa", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Lime", "quantity": 1, "unit": "whole", "category": "Produce"},
            {"name": "Cumin", "quantity": 1, "unit": "tsp", "category": "Pantry"}
        ],
        "instructions": ["Cook rice", "Heat black beans with cumin", "Assemble bowl with beans, rice, avocado, and salsa", "Squeeze lime on top"],
        "prep_time": 10,
        "cook_time": 20,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400"
    },
    {
        "name": "Edamame Salad",
        "description": "Protein-packed edamame salad with sesame dressing",
        "meal_type": "lunch",
        "calories": 380,
        "protein": 26,
        "carbs": 28,
        "fat": 20,
        "ingredients": [
            {"name": "Edamame", "quantity": 1.5, "unit": "cups", "category": "Produce"},
            {"name": "Cucumber", "quantity": 1, "unit": "whole", "category": "Produce"},
            {"name": "Red Cabbage", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Sesame Oil", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Rice Vinegar", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Sesame Seeds", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Cook edamame and let cool", "Chop vegetables", "Mix dressing", "Toss everything together"],
        "prep_time": 10,
        "cook_time": 5,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
    },
    # Dinner - Vegan GF High Protein
    {
        "name": "Tofu Stir-Fry",
        "description": "Crispy tofu with vegetables in a savory sauce",
        "meal_type": "dinner",
        "calories": 480,
        "protein": 30,
        "carbs": 38,
        "fat": 24,
        "ingredients": [
            {"name": "Extra Firm Tofu", "quantity": 14, "unit": "oz", "category": "Produce"},
            {"name": "Broccoli", "quantity": 2, "unit": "cups", "category": "Produce"},
            {"name": "Bell Peppers", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Tamari", "quantity": 3, "unit": "tbsp", "category": "Pantry"},
            {"name": "Sesame Oil", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Garlic", "quantity": 3, "unit": "cloves", "category": "Produce"},
            {"name": "Brown Rice", "quantity": 0.5, "unit": "cup", "category": "Pantry"}
        ],
        "instructions": ["Press and cube tofu", "Pan-fry tofu until crispy", "Stir-fry vegetables", "Add sauce and combine", "Serve over rice"],
        "prep_time": 15,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400"
    },
    {
        "name": "Chickpea Coconut Curry",
        "description": "Creamy coconut curry with chickpeas and spinach",
        "meal_type": "dinner",
        "calories": 520,
        "protein": 20,
        "carbs": 58,
        "fat": 24,
        "ingredients": [
            {"name": "Chickpeas", "quantity": 1.5, "unit": "cups", "category": "Pantry"},
            {"name": "Coconut Milk", "quantity": 1, "unit": "can", "category": "Pantry"},
            {"name": "Spinach", "quantity": 3, "unit": "cups", "category": "Produce"},
            {"name": "Curry Powder", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Onion", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Basmati Rice", "quantity": 0.75, "unit": "cup", "category": "Pantry"}
        ],
        "instructions": ["Sauté onion", "Add curry powder", "Add coconut milk and chickpeas", "Simmer 15 minutes", "Stir in spinach", "Serve over rice"],
        "prep_time": 10,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400"
    },
    {
        "name": "Stuffed Bell Peppers",
        "description": "Bell peppers stuffed with quinoa, black beans, and corn",
        "meal_type": "dinner",
        "calories": 440,
        "protein": 18,
        "carbs": 62,
        "fat": 14,
        "ingredients": [
            {"name": "Bell Peppers", "quantity": 2, "unit": "large", "category": "Produce"},
            {"name": "Quinoa", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Black Beans", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Corn", "quantity": 0.5, "unit": "cup", "category": "Produce"},
            {"name": "Salsa", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Cumin", "quantity": 1, "unit": "tsp", "category": "Pantry"}
        ],
        "instructions": ["Cook quinoa", "Mix with beans, corn, salsa, and cumin", "Stuff peppers", "Bake at 375°F for 30 minutes"],
        "prep_time": 15,
        "cook_time": 35,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400"
    },
    {
        "name": "Lentil Bolognese",
        "description": "Hearty lentil pasta sauce over gluten-free pasta",
        "meal_type": "dinner",
        "calories": 490,
        "protein": 26,
        "carbs": 72,
        "fat": 10,
        "ingredients": [
            {"name": "Brown Lentils", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "GF Pasta", "quantity": 4, "unit": "oz", "category": "Pantry"},
            {"name": "Crushed Tomatoes", "quantity": 1, "unit": "can", "category": "Pantry"},
            {"name": "Onion", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Garlic", "quantity": 3, "unit": "cloves", "category": "Produce"},
            {"name": "Italian Herbs", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Cook lentils until tender", "Sauté onion and garlic", "Add tomatoes and herbs", "Simmer with lentils 20 minutes", "Serve over GF pasta"],
        "prep_time": 10,
        "cook_time": 40,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1598866594230-a7c12756260f?w=400"
    },
    # Snacks - Vegan GF High Protein
    {
        "name": "Roasted Chickpeas",
        "description": "Crunchy spiced roasted chickpeas",
        "meal_type": "snack",
        "calories": 200,
        "protein": 10,
        "carbs": 28,
        "fat": 6,
        "ingredients": [
            {"name": "Chickpeas", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "Olive Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Paprika", "quantity": 1, "unit": "tsp", "category": "Pantry"},
            {"name": "Garlic Powder", "quantity": 0.5, "unit": "tsp", "category": "Pantry"}
        ],
        "instructions": ["Dry chickpeas well", "Toss with oil and spices", "Roast at 400°F for 30 minutes until crispy"],
        "prep_time": 5,
        "cook_time": 30,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400"
    },
    {
        "name": "Edamame",
        "description": "Steamed edamame with sea salt",
        "meal_type": "snack",
        "calories": 180,
        "protein": 17,
        "carbs": 14,
        "fat": 8,
        "ingredients": [
            {"name": "Edamame in Pods", "quantity": 1.5, "unit": "cups", "category": "Produce"},
            {"name": "Sea Salt", "quantity": 0.5, "unit": "tsp", "category": "Pantry"}
        ],
        "instructions": ["Steam or boil edamame 5 minutes", "Drain and sprinkle with salt"],
        "prep_time": 2,
        "cook_time": 5,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1564894809611-1742fc40ed80?w=400"
    },
    {
        "name": "Trail Mix",
        "description": "Homemade high-protein trail mix with seeds and nuts",
        "meal_type": "snack",
        "calories": 280,
        "protein": 12,
        "carbs": 20,
        "fat": 20,
        "ingredients": [
            {"name": "Almonds", "quantity": 0.25, "unit": "cup", "category": "Pantry"},
            {"name": "Pumpkin Seeds", "quantity": 0.25, "unit": "cup", "category": "Pantry"},
            {"name": "Sunflower Seeds", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Dried Cranberries", "quantity": 2, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Mix all ingredients together"],
        "prep_time": 2,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400"
    },
    {
        "name": "Nut Butter Banana Bites",
        "description": "Banana slices with almond butter",
        "meal_type": "snack",
        "calories": 220,
        "protein": 8,
        "carbs": 28,
        "fat": 12,
        "ingredients": [
            {"name": "Banana", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Almond Butter", "quantity": 2, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Slice banana into rounds", "Top each with almond butter"],
        "prep_time": 3,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free", "paleo"],
        "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400"
    },
    # ============ MORE HIGH-PROTEIN VEGAN GF RECIPES ============
    {
        "name": "Seitan Stir-Fry",
        "description": "High-protein seitan with Asian vegetables",
        "meal_type": "dinner",
        "calories": 420,
        "protein": 45,
        "carbs": 28,
        "fat": 16,
        "ingredients": [
            {"name": "Seitan", "quantity": 8, "unit": "oz", "category": "Produce"},
            {"name": "Bok Choy", "quantity": 2, "unit": "cups", "category": "Produce"},
            {"name": "Tamari", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Sesame Oil", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Ginger", "quantity": 1, "unit": "tbsp", "category": "Produce"}
        ],
        "instructions": ["Slice seitan", "Stir-fry with vegetables", "Add tamari and ginger", "Serve hot"],
        "prep_time": 10,
        "cook_time": 15,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400"
    },
    {
        "name": "TVP Taco Filling",
        "description": "Textured vegetable protein with Mexican spices",
        "meal_type": "dinner",
        "calories": 380,
        "protein": 42,
        "carbs": 35,
        "fat": 8,
        "ingredients": [
            {"name": "TVP", "quantity": 1.5, "unit": "cups", "category": "Pantry"},
            {"name": "Taco Seasoning", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Corn Tortillas", "quantity": 3, "unit": "small", "category": "Bakery"},
            {"name": "Salsa", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Lettuce", "quantity": 1, "unit": "cup", "category": "Produce"}
        ],
        "instructions": ["Rehydrate TVP in hot water", "Season with taco spices", "Serve in corn tortillas with toppings"],
        "prep_time": 10,
        "cook_time": 10,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400"
    },
    {
        "name": "Protein-Packed Overnight Oats",
        "description": "GF oats with protein powder and seeds",
        "meal_type": "breakfast",
        "calories": 450,
        "protein": 32,
        "carbs": 52,
        "fat": 14,
        "ingredients": [
            {"name": "GF Rolled Oats", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Pea Protein Powder", "quantity": 1.5, "unit": "scoops", "category": "Pantry"},
            {"name": "Hemp Hearts", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Almond Milk", "quantity": 1, "unit": "cup", "category": "Dairy"},
            {"name": "Chia Seeds", "quantity": 1, "unit": "tbsp", "category": "Pantry"}
        ],
        "instructions": ["Mix all ingredients", "Refrigerate overnight", "Top with berries if desired"],
        "prep_time": 5,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400"
    },
    {
        "name": "Tempeh Bacon Bowl",
        "description": "Crispy tempeh bacon with hash browns and veggies",
        "meal_type": "breakfast",
        "calories": 480,
        "protein": 35,
        "carbs": 38,
        "fat": 24,
        "ingredients": [
            {"name": "Tempeh", "quantity": 8, "unit": "oz", "category": "Produce"},
            {"name": "Potatoes", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Tamari", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Maple Syrup", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Spinach", "quantity": 2, "unit": "cups", "category": "Produce"}
        ],
        "instructions": ["Slice tempeh thin and marinate in tamari/maple", "Shred and fry potatoes", "Pan-fry tempeh until crispy", "Serve together with sautéed spinach"],
        "prep_time": 15,
        "cook_time": 20,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400"
    },
    {
        "name": "High-Protein Lentil Salad",
        "description": "French lentils with vegetables and lemon dressing",
        "meal_type": "lunch",
        "calories": 420,
        "protein": 28,
        "carbs": 52,
        "fat": 12,
        "ingredients": [
            {"name": "French Lentils", "quantity": 1.5, "unit": "cups", "category": "Pantry"},
            {"name": "Cherry Tomatoes", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Cucumber", "quantity": 1, "unit": "whole", "category": "Produce"},
            {"name": "Lemon Juice", "quantity": 2, "unit": "tbsp", "category": "Produce"},
            {"name": "Olive Oil", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Parsley", "quantity": 0.5, "unit": "cup", "category": "Produce"}
        ],
        "instructions": ["Cook lentils until tender", "Chop vegetables", "Mix dressing", "Combine all and chill"],
        "prep_time": 10,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
    },
    {
        "name": "Chickpea Protein Bowl",
        "description": "Roasted chickpeas with quinoa and tahini",
        "meal_type": "lunch",
        "calories": 520,
        "protein": 26,
        "carbs": 62,
        "fat": 20,
        "ingredients": [
            {"name": "Chickpeas", "quantity": 1.5, "unit": "cups", "category": "Pantry"},
            {"name": "Quinoa", "quantity": 0.75, "unit": "cup", "category": "Pantry"},
            {"name": "Tahini", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Roasted Red Peppers", "quantity": 0.5, "unit": "cup", "category": "Produce"},
            {"name": "Spinach", "quantity": 2, "unit": "cups", "category": "Produce"}
        ],
        "instructions": ["Cook quinoa", "Roast seasoned chickpeas", "Assemble bowl", "Drizzle with tahini"],
        "prep_time": 10,
        "cook_time": 30,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400"
    },
    {
        "name": "Spicy Peanut Tofu",
        "description": "Crispy tofu in spicy peanut sauce",
        "meal_type": "dinner",
        "calories": 520,
        "protein": 38,
        "carbs": 32,
        "fat": 30,
        "ingredients": [
            {"name": "Extra Firm Tofu", "quantity": 16, "unit": "oz", "category": "Produce"},
            {"name": "Peanut Butter", "quantity": 3, "unit": "tbsp", "category": "Pantry"},
            {"name": "Tamari", "quantity": 2, "unit": "tbsp", "category": "Pantry"},
            {"name": "Sriracha", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Brown Rice", "quantity": 0.5, "unit": "cup", "category": "Pantry"},
            {"name": "Broccoli", "quantity": 2, "unit": "cups", "category": "Produce"}
        ],
        "instructions": ["Press and cube tofu", "Pan-fry until crispy", "Make peanut sauce", "Toss tofu in sauce", "Serve with rice and broccoli"],
        "prep_time": 15,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400"
    },
    {
        "name": "Black Bean Soup",
        "description": "Hearty black bean soup with cumin and lime",
        "meal_type": "dinner",
        "calories": 380,
        "protein": 24,
        "carbs": 58,
        "fat": 6,
        "ingredients": [
            {"name": "Black Beans", "quantity": 2, "unit": "cups", "category": "Pantry"},
            {"name": "Vegetable Broth", "quantity": 2, "unit": "cups", "category": "Pantry"},
            {"name": "Onion", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Cumin", "quantity": 1, "unit": "tbsp", "category": "Pantry"},
            {"name": "Lime", "quantity": 1, "unit": "whole", "category": "Produce"},
            {"name": "Avocado", "quantity": 0.5, "unit": "whole", "category": "Produce"}
        ],
        "instructions": ["Sauté onion", "Add beans, broth, and cumin", "Simmer 20 minutes", "Blend partially", "Serve with lime and avocado"],
        "prep_time": 10,
        "cook_time": 25,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400"
    },
    {
        "name": "Pea Protein Shake",
        "description": "Quick high-protein shake with banana and spinach",
        "meal_type": "snack",
        "calories": 280,
        "protein": 30,
        "carbs": 28,
        "fat": 6,
        "ingredients": [
            {"name": "Pea Protein Powder", "quantity": 1.5, "unit": "scoops", "category": "Pantry"},
            {"name": "Banana", "quantity": 1, "unit": "medium", "category": "Produce"},
            {"name": "Spinach", "quantity": 1, "unit": "cup", "category": "Produce"},
            {"name": "Almond Milk", "quantity": 1, "unit": "cup", "category": "Dairy"}
        ],
        "instructions": ["Blend all ingredients until smooth"],
        "prep_time": 3,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=400"
    },
    {
        "name": "Lupini Bean Salad",
        "description": "Mediterranean lupini beans with herbs",
        "meal_type": "snack",
        "calories": 200,
        "protein": 26,
        "carbs": 16,
        "fat": 4,
        "ingredients": [
            {"name": "Lupini Beans", "quantity": 1, "unit": "cup", "category": "Pantry"},
            {"name": "Lemon Juice", "quantity": 1, "unit": "tbsp", "category": "Produce"},
            {"name": "Garlic", "quantity": 1, "unit": "clove", "category": "Produce"},
            {"name": "Parsley", "quantity": 2, "unit": "tbsp", "category": "Produce"}
        ],
        "instructions": ["Drain and rinse lupini beans", "Toss with lemon, garlic, and parsley"],
        "prep_time": 5,
        "cook_time": 0,
        "servings": 1,
        "tags": ["vegan", "vegetarian", "gluten-free", "dairy-free"],
        "image_url": "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400"
    }
]

@api_router.post("/seed-recipes")
async def seed_recipes():
    """Seed the database with initial recipes."""
    existing = await db.recipes.count_documents({"user_id": None})
    if existing > 0:
        return {"message": f"Database already has {existing} seeded recipes"}
    
    for recipe_data in SEED_RECIPES:
        recipe = Recipe(**recipe_data, user_id=None)
        await db.recipes.insert_one(recipe.model_dump())
    
    return {"message": f"Seeded {len(SEED_RECIPES)} recipes"}

@api_router.get("/")
async def root():
    return {"message": "BalancedPrep API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    # Seed recipes on startup if empty
    existing = await db.recipes.count_documents({"user_id": None})
    if existing == 0:
        for recipe_data in SEED_RECIPES:
            recipe = Recipe(**recipe_data, user_id=None)
            await db.recipes.insert_one(recipe.model_dump())
        logger.info(f"Seeded {len(SEED_RECIPES)} recipes")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
