import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import axios from 'axios';
import {
  RefreshCw,
  ChevronRight,
  Check,
  AlertCircle,
  Utensils,
  Clock,
  Shuffle,
  Settings,
  Lightbulb,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Helper to format date like "Jan 5"
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper to generate meal contribution badge
const getMealBadge = (meal, dailyTotals, userTargets) => {
  const mealCalories = Math.round(meal.calories * meal.servings);
  const mealProtein = Math.round(meal.protein * meal.servings);
  
  const proteinTarget = userTargets?.protein;
  const calorieTarget = userTargets?.calories;
  
  // Calculate protein percentage of daily target
  if (proteinTarget && mealProtein > 0) {
    const proteinPercentage = Math.round((mealProtein / proteinTarget) * 100);
    if (proteinPercentage >= 30) {
      return { text: `~${proteinPercentage}% of daily protein`, type: 'protein' };
    }
  }
  
  // Check if it's protein-forward (high protein relative to calories)
  const proteinRatio = mealProtein / (mealCalories || 1) * 100;
  if (proteinRatio > 10) {
    return { text: 'Protein-forward meal', type: 'protein' };
  }
  
  // Check if it's a light calorie option
  if (calorieTarget && mealCalories < (calorieTarget * 0.15)) {
    return { text: 'Light calorie option', type: 'light' };
  }
  
  return null;
};

// Helper to generate contextual guidance
const getContextualGuidance = (currentDay, userTargets) => {
  const guidance = [];
  
  if (userTargets?.calories) {
    const remaining = userTargets.calories - currentDay.totals.calories;
    if (remaining > 200) {
      guidance.push({
        type: 'calories',
        message: 'Room for more calories today — a balanced snack could help you reach your energy goals.'
      });
    }
  }
  
  if (userTargets?.protein) {
    const remaining = userTargets.protein - currentDay.totals.protein;
    if (remaining > 15) {
      guidance.push({
        type: 'protein',
        message: 'Slightly under protein — consider a small protein-forward snack.'
      });
    }
  }
  
  return guidance;
};

const Dashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [swapping, setSwapping] = useState(null);

  const fetchMealPlan = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/meal-plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMealPlan(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setMealPlan(null);
      } else {
        toast.error('Failed to load meal plan');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMealPlan();
  }, [fetchMealPlan]);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(
        `${API}/meal-plan/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMealPlan(response.data);
      toast.success('Meal plan generated!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to generate plan';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const swapMeal = async (dayIndex, mealIndex) => {
    setSwapping(`${dayIndex}-${mealIndex}`);
    try {
      const response = await axios.put(
        `${API}/meal-plan/swap-meal`,
        { day_index: dayIndex, meal_index: mealIndex },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMealPlan(response.data);
      toast.success('Meal swapped!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to swap meal';
      toast.error(message);
    } finally {
      setSwapping(null);
    }
  };

  const regenerateDay = async (dayIndex) => {
    setGenerating(true);
    try {
      const response = await axios.put(
        `${API}/meal-plan/regenerate-day`,
        { day_index: dayIndex },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMealPlan(response.data);
      toast.success('Day regenerated!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to regenerate day';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const fetchRecipeDetails = async (recipeId) => {
    try {
      const response = await axios.get(`${API}/recipes/${recipeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedRecipe(response.data);
      setRecipeModalOpen(true);
    } catch (error) {
      toast.error('Failed to load recipe');
    }
  };

  const formatDelta = (value, unit = '') => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Math.round(value)}${unit}`;
  };

  const activeTargets = user?.targets
    ? Object.entries(user.targets).filter(([_, v]) => v !== null && v > 0)
    : [];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" data-testid="dashboard-loading">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-64 skeleton rounded-2xl" />
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up" data-testid="no-meal-plan">
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mb-6">
          <Utensils className="w-12 h-12 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No meal plan yet</h2>
        <p className="text-muted-foreground text-center mb-8 max-w-md">
          Generate your personalized 7-day meal plan based on your targets and preferences.
        </p>
        <Button
          onClick={generatePlan}
          disabled={generating}
          className="rounded-full px-8 py-6 text-lg"
          data-testid="generate-plan-btn"
        >
          {generating ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate My Plan'
          )}
        </Button>
      </div>
    );
  }

  const currentDay = mealPlan.days[selectedDay];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Your Meal Plan</h1>
          <p className="text-muted-foreground mt-1">
            {mealPlan.unique_meals_count} unique meals • ±{mealPlan.tolerance}% tolerance
          </p>
        </div>
        <Button
          variant="outline"
          onClick={generatePlan}
          disabled={generating}
          className="rounded-full"
          data-testid="regenerate-week-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
          Regenerate Week
        </Button>
      </div>

      {/* Day Selector - Full Width Tabs */}
      <div className="w-full">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 p-1 bg-secondary/50 rounded-2xl">
          {mealPlan.days.map((day, index) => {
            const allOnTarget = Object.values(day.on_target).every((v) => v);
            const isSelected = selectedDay === index;
            return (
              <button
                key={day.day}
                onClick={() => setSelectedDay(index)}
                className={`relative flex flex-col items-center py-3 sm:py-4 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-card shadow-sm'
                    : 'hover:bg-card/50'
                }`}
                data-testid={`day-selector-${index}`}
              >
                <span className={`text-xs sm:text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {DAYS_SHORT[index]}
                </span>
                <div className="flex items-center justify-center mt-1">
                  {allOnTarget ? (
                    <Check className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-primary/60'}`} />
                  ) : (
                    <AlertCircle className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-500' : 'text-amber-400/60'}`} />
                  )}
                </div>
                {isSelected && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      <Card className="rounded-2xl border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">{DAYS_FULL[selectedDay]}</h2>
              <p className="text-sm text-muted-foreground">{currentDay.date}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerateDay(selectedDay)}
              disabled={generating}
              className="rounded-full"
              data-testid="regenerate-day-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${generating ? 'animate-spin' : ''}`} />
              Regenerate Day
            </Button>
          </div>

          {/* Nutrition Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {['calories', 'protein', 'carbs', 'fat'].map((key) => {
              const target = user?.targets?.[key];
              const total = currentDay.totals[key];
              const delta = currentDay.deltas[key];
              const onTarget = currentDay.on_target[key];
              const isTracked = target !== null && target > 0;

              return (
                <div
                  key={key}
                  className={`p-4 rounded-xl ${isTracked ? 'bg-secondary' : 'bg-muted/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {key}
                    </span>
                    {isTracked && (
                      <div
                        className={`w-2 h-2 rounded-full ${
                          onTarget ? 'bg-primary' : 'bg-amber-500'
                        }`}
                      />
                    )}
                  </div>
                  <div className="text-lg font-semibold">
                    {Math.round(total)}
                    {key !== 'calories' && 'g'}
                  </div>
                  {isTracked && (
                    <div
                      className={`text-xs ${
                        onTarget ? 'text-primary' : 'text-amber-600'
                      }`}
                    >
                      {formatDelta(delta, key !== 'calories' ? 'g' : '')} vs target
                    </div>
                  )}
                  {!isTracked && (
                    <div className="text-xs text-muted-foreground">Not tracked</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Meals */}
          <div className="space-y-3 stagger-children">
            {currentDay.meals.map((meal, mealIndex) => (
              <div
                key={`${meal.meal_type}-${mealIndex}`}
                className="meal-card p-4 rounded-xl border border-border bg-card flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {meal.meal_type}
                    </span>
                    {meal.servings !== 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent">
                        {meal.servings}x
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => fetchRecipeDetails(meal.recipe_id)}
                    className="text-left font-medium hover:text-primary transition-colors truncate block w-full"
                    data-testid={`meal-${meal.meal_type}-name`}
                  >
                    {meal.recipe_name}
                  </button>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{Math.round(meal.calories * meal.servings)} cal</span>
                    <span>{Math.round(meal.protein * meal.servings)}g protein</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => swapMeal(selectedDay, mealIndex)}
                  disabled={swapping === `${selectedDay}-${mealIndex}`}
                  className="rounded-full"
                  data-testid={`swap-meal-${mealIndex}`}
                >
                  {swapping === `${selectedDay}-${mealIndex}` ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shuffle className="w-4 h-4" />
                  )}
                </Button>
                <ChevronRight
                  className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => fetchRecipeDetails(meal.recipe_id)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Target Summary */}
      {activeTargets.length > 0 && (
        <Card className="rounded-2xl border-border">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Your Daily Targets</h3>
            <div className="flex flex-wrap gap-3">
              {activeTargets.map(([key, value]) => (
                <div key={key} className="px-4 py-2 rounded-full bg-secondary">
                  <span className="font-medium">{Math.round(value)}</span>
                  <span className="text-muted-foreground ml-1">
                    {key === 'calories' ? 'cal' : `g ${key}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipe Modal - Scrollable */}
      <Dialog open={recipeModalOpen} onOpenChange={setRecipeModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 max-h-[85vh] flex flex-col">
          {selectedRecipe && (
            <>
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl">{selectedRecipe.name}</DialogTitle>
                <DialogDescription>{selectedRecipe.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-5 pt-4">
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipe.calories}</div>
                      <div className="text-xs text-muted-foreground">cal</div>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipe.protein}g</div>
                      <div className="text-xs text-muted-foreground">protein</div>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipe.carbs}g</div>
                      <div className="text-xs text-muted-foreground">carbs</div>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary">
                      <div className="text-lg font-semibold">{selectedRecipe.fat}g</div>
                      <div className="text-xs text-muted-foreground">fat</div>
                    </div>
                  </div>

                  {/* Time & Servings */}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedRecipe.prep_time + selectedRecipe.cook_time} min total
                    </div>
                    <div>{selectedRecipe.servings} serving(s)</div>
                  </div>

                  {/* Tags */}
                  {selectedRecipe.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.tags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ingredients */}
                  {selectedRecipe.ingredients?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Ingredients</h4>
                      <ul className="space-y-2 text-sm">
                        {selectedRecipe.ingredients.map((ing, i) => (
                          <li key={i} className="flex items-center gap-3 text-muted-foreground">
                            <span className="w-2 h-2 rounded-full bg-primary/50 flex-shrink-0" />
                            <span>
                              <span className="text-foreground font-medium">{ing.quantity} {ing.unit}</span> {ing.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {selectedRecipe.instructions?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Instructions</h4>
                      <ol className="space-y-3 text-sm text-muted-foreground">
                        {selectedRecipe.instructions.map((step, i) => (
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

export default Dashboard;
