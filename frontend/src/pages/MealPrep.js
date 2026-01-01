import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ChefHat, 
  Clock, 
  Snowflake,
  Flame,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp
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
const getSmartPrepNotes = (recipe) => {
  const notes = [];
  const name = recipe.name.toLowerCase();
  
  if (name.includes('salad') || name.includes('bowl')) {
    notes.push({ icon: '🥬', text: 'Keep dressing separate until serving' });
    notes.push({ icon: '🥗', text: 'Store greens separately, mix day-of' });
  }
  
  if (name.includes('stir-fry') || name.includes('stir fry')) {
    notes.push({ icon: '🍳', text: 'Pre-cut veggies, store in containers' });
    notes.push({ icon: '🔥', text: 'Best reheated in pan, not microwave' });
  }
  
  if (name.includes('soup') || name.includes('curry') || name.includes('stew')) {
    notes.push({ icon: '❄️', text: 'Freezes well - portion into containers' });
    notes.push({ icon: '🍚', text: 'Cook grains separately, add when serving' });
  }
  
  if (name.includes('overnight') || name.includes('oats')) {
    notes.push({ icon: '🌙', text: 'Prep all portions at once in jars' });
    notes.push({ icon: '🍓', text: 'Add fresh toppings day-of' });
  }
  
  if (name.includes('taco') || name.includes('wrap') || name.includes('burrito')) {
    notes.push({ icon: '🌮', text: 'Keep tortillas/shells separate' });
    notes.push({ icon: '🥑', text: 'Add fresh toppings when serving' });
  }
  
  if (name.includes('scramble') || name.includes('tofu')) {
    notes.push({ icon: '🥚', text: 'Best fresh, but keeps 3 days in fridge' });
  }
  
  if (name.includes('smoothie') || name.includes('shake')) {
    notes.push({ icon: '🍌', text: 'Pre-portion frozen ingredients in bags' });
    notes.push({ icon: '⚡', text: 'Blend fresh each morning' });
  }
  
  if (notes.length === 0) {
    notes.push({ icon: '📦', text: 'Portion into containers after cooking' });
    notes.push({ icon: '🧊', text: 'Store in airtight containers' });
  }
  
  return notes.slice(0, 2);
};

// Storage guidance
const getStorageGuidance = (recipe) => {
  const name = recipe.name.toLowerCase();
  
  if (name.includes('soup') || name.includes('curry') || name.includes('stew')) {
    return { fridge: '4-5 days', freezer: '2-3 months', reheat: 'Stovetop or microwave' };
  }
  if (name.includes('salad')) {
    return { fridge: '2-3 days (undressed)', freezer: 'Not recommended', reheat: 'Serve cold' };
  }
  if (name.includes('rice') || name.includes('grain') || name.includes('quinoa')) {
    return { fridge: '4-5 days', freezer: '1 month', reheat: 'Microwave with splash of water' };
  }
  if (name.includes('tofu') || name.includes('tempeh')) {
    return { fridge: '3-4 days', freezer: 'Not ideal', reheat: 'Pan or microwave' };
  }
  
  return { fridge: '3-4 days', freezer: 'Varies', reheat: 'Microwave or oven' };
};

// Scale ingredient quantity
const scaleIngredient = (quantity, originalServings, totalServings) => {
  const scaled = (quantity / originalServings) * totalServings;
  // Round to reasonable precision
  if (scaled < 1) {
    return Math.round(scaled * 4) / 4; // Round to nearest 0.25
  }
  return Math.round(scaled * 2) / 2; // Round to nearest 0.5
};

const MealPrep = () => {
  const { token } = useAuth();
  const [mealPlan, setMealPlan] = useState(null);
  const [recipes, setRecipes] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const planResponse = await axios.get(`${API}/meal-plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMealPlan(planResponse.data);

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

  const openRecipeModal = (recipe, totalServings) => {
    setSelectedRecipeForModal({ ...recipe, totalServings });
    setRecipeModalOpen(true);
  };

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

  // All items that can be prepped (frequency >= 2) vs cook fresh (frequency === 1)
  const prepItems = summaryArray.filter(item => item.frequency >= 2);
  const freshItems = summaryArray.filter(item => item.frequency === 1);

  const totalPrepMeals = prepItems.reduce((sum, item) => sum + item.frequency, 0);

  return (
    <div className="space-y-8 animate-fade-in" data-testid="meal-prep-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Meal Prep Guide</h1>
        <p className="text-muted-foreground mt-1">
          {summaryArray.length} unique recipes • {mealPlan.days.length * 4} meals this week
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{prepItems.length}</div>
            <div className="text-sm text-muted-foreground">Recipes to Prep</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{totalPrepMeals}</div>
            <div className="text-sm text-muted-foreground">Meals from Prep</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{freshItems.length}</div>
            <div className="text-sm text-muted-foreground">Cook Fresh</div>
          </CardContent>
        </Card>
      </div>

      {/* Prep Section */}
      {prepItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Prep These</h2>
            <span className="text-sm text-muted-foreground">({prepItems.length} recipes)</span>
          </div>
          <div className="space-y-4">
            {prepItems.map(item => (
              <MealPrepCard 
                key={item.recipe_id} 
                item={item}
                isExpanded={expandedRecipe === item.recipe_id}
                onToggle={() => setExpandedRecipe(
                  expandedRecipe === item.recipe_id ? null : item.recipe_id
                )}
                onViewRecipe={() => openRecipeModal(item.recipe, Math.ceil(item.total_servings))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fresh Section */}
      {freshItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <Flame className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Cook Fresh</h2>
            <span className="text-sm text-muted-foreground">(once this week)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {freshItems.map(item => (
              <MealPrepCardCompact 
                key={item.recipe_id} 
                item={item}
                onViewRecipe={() => openRecipeModal(item.recipe, Math.ceil(item.total_servings))}
              />
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
              <span><strong>Sunday prep:</strong> Cook grains, proteins, and roast veggies in batches</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Wednesday check:</strong> Refresh any items past 3 days, prep for rest of week</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Label everything:</strong> Date your containers to track freshness</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span><strong>Glass containers:</strong> Reheat better and keep food fresher than plastic</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Recipe Modal with Scaled Ingredients */}
      <Dialog open={recipeModalOpen} onOpenChange={setRecipeModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 max-h-[85vh] flex flex-col">
          {selectedRecipeForModal && (
            <>
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl">
                  {selectedRecipeForModal.name}
                  <span className="text-primary ml-2">
                    (Scaled for {selectedRecipeForModal.totalServings} servings)
                  </span>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-5 pt-4">
                  {/* Nutrition per serving */}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipeForModal.calories}</div>
                      <div className="text-xs text-muted-foreground">cal/serving</div>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipeForModal.protein}g</div>
                      <div className="text-xs text-muted-foreground">protein</div>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipeForModal.carbs}g</div>
                      <div className="text-xs text-muted-foreground">carbs</div>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipeForModal.fat}g</div>
                      <div className="text-xs text-muted-foreground">fat</div>
                    </div>
                  </div>

                  {/* Scaled Ingredients */}
                  {selectedRecipeForModal.ingredients?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center justify-between">
                        <span>Ingredients</span>
                        <span className="text-sm text-primary font-normal">
                          Scaled for {selectedRecipeForModal.totalServings} servings
                        </span>
                      </h4>
                      <ul className="space-y-2 text-sm">
                        {selectedRecipeForModal.ingredients.map((ing, i) => {
                          const scaledQty = scaleIngredient(
                            ing.quantity, 
                            selectedRecipeForModal.servings || 1, 
                            selectedRecipeForModal.totalServings
                          );
                          return (
                            <li key={i} className="flex items-center gap-3 text-muted-foreground">
                              <span className="w-2 h-2 rounded-full bg-primary/50 flex-shrink-0" />
                              <span>
                                <span className="text-foreground font-medium">{scaledQty} {ing.unit}</span> {ing.name}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {selectedRecipeForModal.instructions?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Instructions</h4>
                      <ol className="space-y-3 text-sm text-muted-foreground">
                        {selectedRecipeForModal.instructions.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-medium flex items-center justify-center text-xs">
                              {i + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Detailed card for prep items
const MealPrepCard = ({ item, isExpanded, onToggle, onViewRecipe }) => {
  const recipe = item.recipe;
  const difficulty = recipe ? getPrepDifficulty(recipe.prep_time, recipe.cook_time) : null;
  const smartNotes = recipe ? getSmartPrepNotes(recipe) : [];
  const storage = recipe ? getStorageGuidance(recipe) : null;
  
  // Total portions should match frequency (times eaten)
  const totalPortions = Math.ceil(item.total_servings);

  return (
    <Card className="rounded-2xl border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
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
              <h3 
                className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                onClick={onViewRecipe}
              >
                {item.recipe_name}
              </h3>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold text-primary">{item.frequency}x</div>
              <div className="text-xs text-muted-foreground">this week</div>
            </div>
          </div>

          {/* When it appears - just days, no meal type letter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.appearances.map((app, i) => (
              <span 
                key={i}
                className="text-xs px-2.5 py-1 rounded-lg bg-accent border border-border"
              >
                {app.day}
              </span>
            ))}
          </div>

          {/* Cook amount - matches frequency */}
          <div 
            className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 mb-4 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={onViewRecipe}
          >
            <ChefHat className="w-5 h-5 text-primary" />
            <span className="font-medium">
              Cook {totalPortions} portions
            </span>
            {recipe && (
              <span className="text-muted-foreground text-sm">
                • {recipe.prep_time + recipe.cook_time} min
              </span>
            )}
            <span className="text-primary text-sm ml-auto">View recipe →</span>
          </div>

          {/* Expandable section */}
          <button 
            onClick={onToggle}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? 'Hide' : 'Show'} prep tips & storage
          </button>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              {/* Smart prep notes */}
              {smartNotes.length > 0 && (
                <div className="space-y-2">
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Compact card for single-use items
const MealPrepCardCompact = ({ item, onViewRecipe }) => {
  const recipe = item.recipe;
  const difficulty = recipe ? getPrepDifficulty(recipe.prep_time, recipe.cook_time) : null;

  return (
    <Card className="rounded-xl border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={onViewRecipe}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{item.recipe_name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {item.appearances[0]?.day} • {item.appearances[0]?.meal_type}
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
