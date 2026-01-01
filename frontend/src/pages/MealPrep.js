import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ChefHat, 
  Clock, 
  Calendar, 
  Repeat, 
  Snowflake,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Utensils
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Prep difficulty based on total time
const getPrepDifficulty = (prepTime, cookTime) => {
  const total = (prepTime || 0) + (cookTime || 0);
  if (total <= 15) return { label: 'Quick', color: 'text-green-600 bg-green-100' };
  if (total <= 35) return { label: 'Moderate', color: 'text-amber-600 bg-amber-100' };
  return { label: 'Longer', color: 'text-red-600 bg-red-100' };
};

// Smart prep notes based on recipe characteristics
const getSmartPrepNotes = (recipe, frequency) => {
  const notes = [];
  const name = recipe.name.toLowerCase();
  const tags = recipe.tags || [];
  
  // Storage tips based on ingredients/recipe type
  if (name.includes('salad') || name.includes('bowl')) {
    notes.push({ icon: '🥬', text: 'Keep dressing separate until serving' });
    notes.push({ icon: '🥗', text: 'Store greens separately, mix day-of' });
  }
  
  if (name.includes('stir-fry') || name.includes('stir fry')) {
    notes.push({ icon: '🍳', text: 'Pre-cut veggies, store in containers' });
    notes.push({ icon: '🔥', text: 'Cook fresh each time for best texture' });
  }
  
  if (name.includes('soup') || name.includes('curry') || name.includes('stew')) {
    notes.push({ icon: '❄️', text: 'Freezes well - make full batch' });
    notes.push({ icon: '🍚', text: 'Cook grains separately, add when reheating' });
  }
  
  if (name.includes('overnight') || name.includes('oats')) {
    notes.push({ icon: '🌙', text: 'Prep all portions at once, refrigerate' });
    notes.push({ icon: '🍓', text: 'Add fresh toppings day-of' });
  }
  
  if (name.includes('taco') || name.includes('wrap') || name.includes('burrito')) {
    notes.push({ icon: '🌮', text: 'Keep tortillas/shells separate' });
    notes.push({ icon: '🥑', text: 'Add fresh toppings when serving' });
  }
  
  if (name.includes('scramble') || name.includes('tofu')) {
    notes.push({ icon: '🥚', text: 'Best made fresh, 2-3 day fridge max' });
  }
  
  if (name.includes('smoothie') || name.includes('shake')) {
    notes.push({ icon: '🍌', text: 'Pre-portion frozen ingredients in bags' });
    notes.push({ icon: '⚡', text: 'Blend fresh each morning' });
  }
  
  if (name.includes('roasted') || name.includes('baked')) {
    notes.push({ icon: '🥕', text: 'Roast veggies in big batch, reheat in oven' });
  }
  
  // Generic tips for high frequency
  if (frequency >= 4) {
    notes.push({ icon: '📦', text: `Make ${frequency} portions - divide into containers` });
  }
  
  // Default tips if none specific
  if (notes.length === 0) {
    notes.push({ icon: '📅', text: 'Prep ingredients ahead, cook as needed' });
    notes.push({ icon: '🧊', text: 'Store in airtight containers' });
  }
  
  return notes.slice(0, 3); // Max 3 notes
};

// Storage guidance
const getStorageGuidance = (recipe) => {
  const name = recipe.name.toLowerCase();
  
  if (name.includes('soup') || name.includes('curry') || name.includes('stew')) {
    return { fridge: '4-5 days', freezer: '2-3 months', reheat: 'Stovetop or microwave' };
  }
  if (name.includes('salad')) {
    return { fridge: '1-2 days (dressed)', freezer: 'Not recommended', reheat: 'Serve cold' };
  }
  if (name.includes('rice') || name.includes('grain') || name.includes('quinoa')) {
    return { fridge: '4-5 days', freezer: '1 month', reheat: 'Microwave with splash of water' };
  }
  if (name.includes('tofu') || name.includes('tempeh')) {
    return { fridge: '3-4 days', freezer: 'Not ideal', reheat: 'Pan or microwave' };
  }
  
  return { fridge: '3-4 days', freezer: 'Varies', reheat: 'Microwave or oven' };
};

const MealPrep = () => {
  const { token } = useAuth();
  const [mealPlan, setMealPlan] = useState(null);
  const [recipes, setRecipes] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch meal plan
      const planResponse = await axios.get(`${API}/meal-plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMealPlan(planResponse.data);

      // Fetch all recipe details
      const recipeIds = new Set();
      planResponse.data.days.forEach(day => {
        day.meals.forEach(meal => recipeIds.add(meal.recipe_id));
      });

      const recipeDetails = {};
      for (const id of recipeIds) {
        try {
          const res = await axios.get(`${API}/recipes/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          recipeDetails[id] = res.data;
        } catch (e) {
          console.error(`Failed to fetch recipe ${id}`);
        }
      }
      setRecipes(recipeDetails);
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Failed to load meal prep data');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" data-testid="meal-prep-loading">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up" data-testid="no-meal-prep">
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mb-6">
          <ChefHat className="w-12 h-12 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No meal plan yet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Generate a meal plan first, and your prep guide will appear here.
        </p>
      </div>
    );
  }

  // Build meal summary
  const mealSummary = {};
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  mealPlan.days.forEach((day, dayIndex) => {
    day.meals.forEach(meal => {
      const key = meal.recipe_id;
      if (!mealSummary[key]) {
        mealSummary[key] = {
          recipe_id: meal.recipe_id,
          recipe_name: meal.recipe_name,
          meal_types: new Set(),
          frequency: 0,
          total_servings: 0,
          appearances: [],
          recipe: recipes[meal.recipe_id] || null
        };
      }
      mealSummary[key].meal_types.add(meal.meal_type);
      mealSummary[key].frequency += 1;
      mealSummary[key].total_servings += meal.servings;
      mealSummary[key].appearances.push({
        day: dayNames[dayIndex],
        meal_type: meal.meal_type,
        servings: meal.servings
      });
    });
  });

  // Convert to array and sort by frequency (most frequent first)
  const summaryArray = Object.values(mealSummary)
    .map(item => ({
      ...item,
      meal_types: Array.from(item.meal_types)
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // Group by prep strategy
  const batchCookItems = summaryArray.filter(item => item.frequency >= 3);
  const moderateItems = summaryArray.filter(item => item.frequency === 2);
  const freshItems = summaryArray.filter(item => item.frequency === 1);

  return (
    <div className="space-y-8 animate-fade-in" data-testid="meal-prep-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Meal Prep Guide</h1>
        <p className="text-muted-foreground mt-1">
          {summaryArray.length} unique recipes • {mealPlan.days.length * 4} total meals this week
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{batchCookItems.length}</div>
            <div className="text-sm text-muted-foreground">Batch Cook</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{moderateItems.length}</div>
            <div className="text-sm text-muted-foreground">Cook Twice</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{freshItems.length}</div>
            <div className="text-sm text-muted-foreground">Cook Fresh</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{mealPlan.unique_meals_count}</div>
            <div className="text-sm text-muted-foreground">Unique Meals</div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Cook Section */}
      {batchCookItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Repeat className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Batch Cook These</h2>
            <span className="text-sm text-muted-foreground">(3+ times this week)</span>
          </div>
          <div className="space-y-4">
            {batchCookItems.map(item => (
              <MealPrepCard key={item.recipe_id} item={item} highlight="batch" />
            ))}
          </div>
        </section>
      )}

      {/* Cook Twice Section */}
      {moderateItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold">Cook Twice</h2>
            <span className="text-sm text-muted-foreground">(appears 2x)</span>
          </div>
          <div className="space-y-4">
            {moderateItems.map(item => (
              <MealPrepCard key={item.recipe_id} item={item} highlight="moderate" />
            ))}
          </div>
        </section>
      )}

      {/* Fresh Each Time Section */}
      {freshItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Cook Fresh</h2>
            <span className="text-sm text-muted-foreground">(once this week)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {freshItems.map(item => (
              <MealPrepCardCompact key={item.recipe_id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* General Tips */}
      <Card className="rounded-2xl border-border bg-accent/30">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Weekly Prep Tips
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Sunday prep:</strong> Cook grains, chop veggies, prep proteins</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Wednesday refresh:</strong> Cook fresh items, check storage</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Label containers</strong> with recipe name and date</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Glass containers</strong> reheat better than plastic</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

// Detailed card for batch cook items
const MealPrepCard = ({ item, highlight }) => {
  const recipe = item.recipe;
  const difficulty = recipe ? getPrepDifficulty(recipe.prep_time, recipe.cook_time) : null;
  const smartNotes = recipe ? getSmartPrepNotes(recipe, item.frequency) : [];
  const storage = recipe ? getStorageGuidance(recipe) : null;

  return (
    <Card className="rounded-2xl border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{item.recipe_name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {item.meal_types.map(type => (
                  <span key={type} className="text-xs px-2 py-0.5 rounded-full bg-secondary capitalize">
                    {type}
                  </span>
                ))}
                {difficulty && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${difficulty.color}`}>
                    {difficulty.label}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold text-primary">{item.frequency}x</div>
              <div className="text-xs text-muted-foreground">this week</div>
            </div>
          </div>

          {/* When it appears */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.appearances.map((app, i) => (
              <span 
                key={i}
                className="text-xs px-2 py-1 rounded-lg bg-accent border border-border"
              >
                {app.day} {app.meal_type.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>

          {/* Cook amount */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 mb-4">
            <ChefHat className="w-5 h-5 text-primary" />
            <span className="font-medium">
              Cook {Math.ceil(item.total_servings)} portions total
            </span>
            {recipe && (
              <span className="text-muted-foreground text-sm">
                ({recipe.prep_time + recipe.cook_time} min cook time)
              </span>
            )}
          </div>

          {/* Smart prep notes */}
          {smartNotes.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Prep Smart
              </div>
              <div className="grid gap-1.5">
                {smartNotes.map((note, i) => (
                  <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{note.icon}</span>
                    <span>{note.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storage guidance */}
          {storage && (
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-muted-foreground">Fridge: {storage.fridge}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-muted-foreground">Reheat: {storage.reheat}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Compact card for single-use items
const MealPrepCardCompact = ({ item }) => {
  const recipe = item.recipe;
  const difficulty = recipe ? getPrepDifficulty(recipe.prep_time, recipe.cook_time) : null;

  return (
    <Card className="rounded-xl border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{item.recipe_name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground capitalize">
                {item.appearances[0]?.day} {item.appearances[0]?.meal_type}
              </span>
              {difficulty && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${difficulty.color}`}>
                  {difficulty.label}
                </span>
              )}
            </div>
          </div>
          {recipe && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {recipe.prep_time + recipe.cook_time}m
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MealPrep;
