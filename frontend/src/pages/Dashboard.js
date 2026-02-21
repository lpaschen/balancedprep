import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  X,
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

  const activeTargets = user?.targets
    ? Object.entries(user.targets).filter(([_, v]) => v !== null && v > 0)
    : [];

  // Get formatted goal badges for display
  const getGoalBadges = () => {
    const badges = [];
    if (user?.targets?.calories) {
      badges.push({ label: `${Math.round(user.targets.calories)} cal`, key: 'calories' });
    }
    if (user?.targets?.protein) {
      badges.push({ label: `${Math.round(user.targets.protein)}g protein`, key: 'protein' });
    }
    if (user?.targets?.carbs) {
      badges.push({ label: `${Math.round(user.targets.carbs)}g carbs`, key: 'carbs' });
    }
    if (user?.targets?.fat) {
      badges.push({ label: `${Math.round(user.targets.fat)}g fat`, key: 'fat' });
    }
    return badges;
  };

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
  const goalBadges = getGoalBadges();
  const contextualGuidance = getContextualGuidance(currentDay, user?.targets);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard">
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

      {/* Day Header with Goals and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          {/* Day + Date Inline */}
          <h1 className="text-2xl sm:text-3xl font-bold">
            {DAYS_FULL[selectedDay]} <span className="text-muted-foreground font-normal">· {formatShortDate(currentDay.date)}</span>
          </h1>
          {/* Goal Badges */}
          {goalBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {goalBadges.map((badge) => (
                <span
                  key={badge.key}
                  className="px-3 py-1 text-sm font-medium rounded-full bg-[#f5f0e8] text-[#5c5a52]"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/onboarding')}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            Edit goals
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateDay(selectedDay)}
            disabled={generating}
            className="rounded-full"
            data-testid="regenerate-day-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Daily Progress Card */}
      <Card className="rounded-2xl border-border">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-5">Daily Progress</h2>
          <div className="space-y-5">
            {['calories', 'protein', 'carbs', 'fat'].map((key) => {
              const target = user?.targets?.[key];
              const total = currentDay.totals[key];
              const isTracked = target !== null && target > 0;
              const remaining = isTracked ? Math.max(0, target - total) : 0;
              const percentage = isTracked ? Math.min(100, (total / target) * 100) : 0;
              const unit = key === 'calories' ? 'cal' : 'g';
              
              // Color classes based on macro type
              const barColor = key === 'calories' ? 'bg-[#5a8a5a]' : 
                              key === 'protein' ? 'bg-[#5a8a5a]' : 
                              'bg-[#c9c4b8]';

              return (
                <div key={key} className={isTracked ? '' : 'opacity-60'}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium capitalize ${isTracked ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                    <div className="text-right">
                      {isTracked ? (
                        <>
                          <span className="text-sm font-semibold">
                            {Math.round(total)} / {Math.round(target)} {unit}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {Math.round(remaining)} remaining
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground italic">No goal set</span>
                          <span className="text-sm font-medium ml-2">{Math.round(total)}{unit}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: isTracked ? `${percentage}%` : '100%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Meals */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Today&apos;s Meals</h2>
        <div className="space-y-3 stagger-children">
          {currentDay.meals.map((meal, mealIndex) => {
            const badge = getMealBadge(meal, currentDay.totals, user?.targets);
            
            return (
              <Card
                key={`${meal.meal_type}-${mealIndex}`}
                className="rounded-2xl border-border hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          {meal.meal_type}
                        </span>
                        {meal.servings !== 1 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-medium">
                            {meal.servings}x
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => fetchRecipeDetails(meal.recipe_id)}
                        className="text-left font-semibold hover:text-primary transition-colors truncate block w-full"
                        data-testid={`meal-${meal.meal_type}-name`}
                      >
                        {meal.recipe_name}
                      </button>
                      <div className="flex gap-3 mt-1.5 text-sm text-muted-foreground">
                        <span>{Math.round(meal.calories * meal.servings)} cal</span>
                        <span>{Math.round(meal.protein * meal.servings)}g protein</span>
                      </div>
                      {/* Contribution Badge */}
                      {badge && (
                        <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-[#f5f0e8] text-[#5c5a52] font-medium">
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => swapMeal(selectedDay, mealIndex)}
                        disabled={swapping === `${selectedDay}-${mealIndex}`}
                        className="rounded-full h-8 w-8 p-0"
                        data-testid={`swap-meal-${mealIndex}`}
                      >
                        {swapping === `${selectedDay}-${mealIndex}` ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Shuffle className="w-4 h-4" />
                        )}
                      </Button>
                      <ChevronRight
                        className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => fetchRecipeDetails(meal.recipe_id)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Contextual Guidance */}
      {contextualGuidance.length > 0 && (
        <Card className="rounded-2xl border-border bg-[#faf8f5]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {contextualGuidance[0].message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipe Modal - Scrollable */}
      <Dialog open={recipeModalOpen} onOpenChange={setRecipeModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 max-h-[85vh] overflow-hidden flex flex-col">
          {selectedRecipe && (
            <>
              {/* Recipe Image */}
              {selectedRecipe.image_url && (
                <div className="w-full h-40 overflow-hidden flex-shrink-0">
                  <img 
                    src={selectedRecipe.image_url} 
                    alt={selectedRecipe.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl">{selectedRecipe.name}</DialogTitle>
                <DialogDescription>{selectedRecipe.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto px-6 pb-6">
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
