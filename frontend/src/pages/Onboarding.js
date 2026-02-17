import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ArrowRight, 
  ArrowLeft, 
  Leaf, 
  Check, 
  Target,
  Utensils,
  RefreshCw,
  Zap,
  Calendar,
  ShoppingCart,
  Clock,
  AlertTriangle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Dietary filters
const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian', available: true },
  { id: 'vegan', label: 'Vegan', available: true },
  { id: 'keto', label: 'Keto', available: true },
  { id: 'paleo', label: 'Paleo', available: true },
  { id: 'kosher', label: 'Kosher', available: false },
  { id: 'halal', label: 'Halal', available: false },
  { id: 'dairy-free', label: 'Dairy Free', available: true },
  { id: 'gluten-free', label: 'Gluten Free', available: true },
];

// Allergen options
const ALLERGEN_OPTIONS = [
  { id: 'nuts', label: 'Nuts' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'soy', label: 'Soy' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'gluten', label: 'Gluten' },
];

// Efficiency mode configurations
const EFFICIENCY_MODES = {
  1: {
    label: 'Batch Mode',
    recipes: '3–4',
    sessions: '2–3',
    groceryItems: '15–20',
    variance: '±2g',
    description: 'Maximum efficiency'
  },
  2: {
    label: 'Balanced',
    recipes: '6–8',
    sessions: '4–5',
    groceryItems: '25–35',
    variance: '±4g',
    description: 'Best of both'
  },
  3: {
    label: 'High Variety',
    recipes: '10–14',
    sessions: '6–7',
    groceryItems: '40–50',
    variance: '±6g',
    description: 'More variety'
  }
};

// Days of the week for auto-regenerate
const DAYS_OF_WEEK = [
  { id: 'sunday', label: 'Sunday' },
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
];

const TOTAL_STEPS = 5;

const Onboarding = () => {
  const navigate = useNavigate();
  const { token, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Step 1: Macro Targets
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Step 2: Food Boundaries
  const [preferences, setPreferences] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [recipePoolCount, setRecipePoolCount] = useState({ available_count: 0, total_count: 0, percentage: 100 });
  const [loadingPoolCount, setLoadingPoolCount] = useState(false);

  // Step 3: Efficiency Mode
  const [efficiencyLevel, setEfficiencyLevel] = useState(2); // 1=batch, 2=balanced, 3=variety

  // Step 4: Weekly Automation
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const [regenerateDay, setRegenerateDay] = useState('sunday');

  // Fetch recipe pool count when preferences/allergens change
  const fetchPoolCount = useCallback(async () => {
    if (!token) return;
    setLoadingPoolCount(true);
    try {
      const response = await axios.post(
        `${API}/recipes/pool-count`,
        { preferences, allergens },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecipePoolCount(response.data);
    } catch (error) {
      console.error('Failed to fetch pool count');
    } finally {
      setLoadingPoolCount(false);
    }
  }, [token, preferences, allergens]);

  useEffect(() => {
    if (step === 2) {
      fetchPoolCount();
    }
  }, [step, fetchPoolCount]);

  const togglePreference = (id) => {
    setPreferences((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleAllergen = (id) => {
    setAllergens((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const hasAtLeastOneTarget = () => {
    return (
      (calories && parseFloat(calories) > 0) ||
      (protein && parseFloat(protein) > 0) ||
      (carbs && parseFloat(carbs) > 0) ||
      (fat && parseFloat(fat) > 0)
    );
  };

  const handleNext = () => {
    if (step === 1 && !hasAtLeastOneTarget()) {
      toast.error('Please set at least one macro target');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleStartSetup = () => {
    setStep(1);
  };

  // Map efficiency level to prep_level for backend
  const mapEfficiencyToPrepLevel = (efficiency) => {
    // efficiency 1 (batch) -> prep_level 1
    // efficiency 2 (balanced) -> prep_level 3
    // efficiency 3 (variety) -> prep_level 5
    const mapping = { 1: 1, 2: 3, 3: 5 };
    return mapping[efficiency] || 3;
  };

  const handleComplete = async () => {
    if (!hasAtLeastOneTarget()) {
      toast.error('Please set at least one macro target');
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const targets = {
        calories: calories ? parseFloat(calories) : null,
        protein: protein ? parseFloat(protein) : null,
        carbs: carbs ? parseFloat(carbs) : null,
        fat: fat ? parseFloat(fat) : null,
      };

      const response = await axios.put(
        `${API}/user/profile`,
        {
          targets,
          preferences,
          allergens,
          prep_level: mapEfficiencyToPrepLevel(efficiencyLevel),
          auto_regenerate: autoRegenerate,
          regenerate_day: autoRegenerate ? regenerateDay : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      updateUser(response.data);
      
      // Move to generation step
      setStep(5);
      generatePlan();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save settings';
      toast.error(message);
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGeneratingPlan(true);
    
    // Animated loading messages
    const messages = [
      'Balancing daily macros…',
      'Optimizing ingredient overlap…',
      'Minimizing cook sessions…',
      'Finalizing your plan…'
    ];
    
    let messageIndex = 0;
    setLoadingMessage(messages[0]);
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingMessage(messages[messageIndex]);
    }, 800);

    try {
      await axios.post(
        `${API}/meal-plan/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      clearInterval(messageInterval);
      toast.success('Your meal plan is ready!');
      navigate('/dashboard');
    } catch (error) {
      clearInterval(messageInterval);
      const message = error.response?.data?.detail || 'Failed to generate plan';
      toast.error(message);
      navigate('/dashboard');
    } finally {
      setGeneratingPlan(false);
      setLoading(false);
    }
  };

  // Get active targets for summary panel
  const getActiveTargets = () => {
    const targets = [];
    if (calories && parseFloat(calories) > 0) targets.push({ label: 'Calories', value: `${calories} kcal` });
    if (protein && parseFloat(protein) > 0) targets.push({ label: 'Protein', value: `${protein}g` });
    if (carbs && parseFloat(carbs) > 0) targets.push({ label: 'Carbs', value: `${carbs}g` });
    if (fat && parseFloat(fat) > 0) targets.push({ label: 'Fat', value: `${fat}g` });
    return targets;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <span className="text-xl font-semibold tracking-tight">BalancedPrep</span>
        </div>
      </header>

      {/* Progress Stepper (only show on steps 1-4) */}
      {step > 0 && step < 5 && (
        <div className="px-6 mb-6">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      s < step
                        ? 'bg-primary text-primary-foreground'
                        : s === step
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {s < step ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-12 sm:w-20 h-0.5 mx-1 transition-colors duration-300 ${
                        s < step ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center">Step {step} of {TOTAL_STEPS - 1}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pb-16">
        <div className="w-full max-w-lg animate-fade-in-up">
          
          {/* Step 0: Professional Positioning */}
          {step === 0 && (
            <div className="text-center py-8" data-testid="onboarding-step-0">
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                Let's dial in your weekly macro plan.
              </h1>
              <p className="text-lg text-muted-foreground mb-10">
                Precision targets. Fewer cook sessions. Automated weekly regeneration.
              </p>
              
              <div className="grid gap-4 text-left mb-12 max-w-md mx-auto">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Hit your exact macro targets</p>
                    <p className="text-sm text-muted-foreground">Daily precision within ±5g tolerance</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Utensils className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Minimize cook sessions</p>
                    <p className="text-sm text-muted-foreground">Smart meal reuse for batch cooking</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Reuse ingredients intelligently</p>
                    <p className="text-sm text-muted-foreground">Optimized grocery lists, less waste</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Regenerate weekly in one tap</p>
                    <p className="text-sm text-muted-foreground">New plan, same precision, zero effort</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleStartSetup}
                className="rounded-full px-10 py-6 text-lg"
                data-testid="start-setup-btn"
              >
                Start Setup
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 1: Macro Targets */}
          {step === 1 && (
            <Card className="border-border rounded-2xl shadow-none" data-testid="onboarding-step-1">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Set your daily macro targets</h2>
                  <p className="text-muted-foreground">
                    These targets are applied per day across your entire week.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories">Calories (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="e.g., 2000"
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid="calories-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protein">Protein (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      placeholder="e.g., 150"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid="protein-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbs">Carbs (g)</Label>
                    <Input
                      id="carbs"
                      type="number"
                      placeholder="e.g., 250"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid="carbs-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fat">Fat (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      placeholder="e.g., 65"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid="fat-input"
                    />
                  </div>
                </div>

                {/* Dynamic Target Summary Panel */}
                {hasAtLeastOneTarget() && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-sm font-medium text-primary mb-2">Your daily targets:</p>
                    <div className="flex flex-wrap gap-3">
                      {getActiveTargets().map((target) => (
                        <span key={target.label} className="px-3 py-1 rounded-full bg-primary/10 text-sm font-medium">
                          {target.value} {target.label.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Food Boundaries */}
          {step === 2 && (
            <Card className="border-border rounded-2xl shadow-none" data-testid="onboarding-step-2">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Food boundaries</h2>
                  <p className="text-muted-foreground">
                    Set dietary filters and allergens. All selections are hard exclusions.
                  </p>
                </div>

                {/* Dietary Filters */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Dietary Filters</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIETARY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => option.available && togglePreference(option.id)}
                        disabled={!option.available}
                        className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                          !option.available
                            ? 'border-border bg-secondary/30 opacity-50 cursor-not-allowed'
                            : preferences.includes(option.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                        data-testid={`preference-${option.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${!option.available ? 'text-muted-foreground' : ''}`}>
                            {option.label}
                            {!option.available && <span className="text-xs ml-1">(Soon)</span>}
                          </span>
                          {preferences.includes(option.id) && option.available && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Allergens */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Allergens</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALLERGEN_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => toggleAllergen(option.id)}
                        className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                          allergens.includes(option.id)
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                            : 'border-border hover:border-red-300'
                        }`}
                        data-testid={`allergen-${option.id}`}
                      >
                        <span className={`text-sm font-medium ${allergens.includes(option.id) ? 'text-red-600' : ''}`}>
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Viability Indicator */}
                <div className={`p-4 rounded-xl ${recipePoolCount.percentage < 75 ? 'bg-amber-50 border border-amber-200' : 'bg-secondary/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {loadingPoolCount ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : recipePoolCount.percentage < 75 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-sm font-medium">
                        Current recipe pool: {recipePoolCount.available_count} meals
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {recipePoolCount.percentage}% available
                    </span>
                  </div>
                  {recipePoolCount.percentage < 75 && (
                    <p className="text-xs text-amber-700 mt-2">
                      Fewer filters increase variety and meal plan options.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Efficiency Mode */}
          {step === 3 && (
            <Card className="border-border rounded-2xl shadow-none" data-testid="onboarding-step-3">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">How optimized do you want this week?</h2>
                  <p className="text-muted-foreground">
                    Balance between batch cooking efficiency and meal variety.
                  </p>
                </div>

                {/* Efficiency Slider */}
                <div className="space-y-6 pt-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-primary">Batch Mode</span>
                    <span className="text-muted-foreground">Balanced</span>
                    <span className="text-muted-foreground">High Variety</span>
                  </div>
                  
                  <Slider
                    value={[efficiencyLevel]}
                    onValueChange={(value) => setEfficiencyLevel(value[0])}
                    min={1}
                    max={3}
                    step={1}
                    className="py-4"
                    data-testid="efficiency-slider"
                  />

                  {/* Selected Mode Display */}
                  <div className="text-center py-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-primary">
                        {EFFICIENCY_MODES[efficiencyLevel].label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {EFFICIENCY_MODES[efficiencyLevel].description}
                    </p>
                  </div>
                </div>

                {/* Dynamic Preview */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {EFFICIENCY_MODES[efficiencyLevel].recipes}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Unique recipes</div>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {EFFICIENCY_MODES[efficiencyLevel].sessions}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Cook sessions</div>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {EFFICIENCY_MODES[efficiencyLevel].groceryItems}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Grocery items</div>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {EFFICIENCY_MODES[efficiencyLevel].variance}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Macro variance</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Weekly Automation */}
          {step === 4 && (
            <Card className="border-border rounded-2xl shadow-none" data-testid="onboarding-step-4">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Weekly automation</h2>
                  <p className="text-muted-foreground">
                    Regenerate your plan automatically each week?
                  </p>
                </div>

                {/* Yes/No Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setAutoRegenerate(true)}
                    className={`p-6 rounded-xl border-2 text-center transition-all duration-200 ${
                      autoRegenerate
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                    data-testid="auto-regen-yes"
                  >
                    <Calendar className={`w-8 h-8 mx-auto mb-3 ${autoRegenerate ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-semibold block">Yes, automate it</span>
                    <span className="text-sm text-muted-foreground">Set it and forget it</span>
                  </button>
                  
                  <button
                    onClick={() => setAutoRegenerate(false)}
                    className={`p-6 rounded-xl border-2 text-center transition-all duration-200 ${
                      !autoRegenerate
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                    data-testid="auto-regen-no"
                  >
                    <Clock className={`w-8 h-8 mx-auto mb-3 ${!autoRegenerate ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-semibold block">No, I'll do it manually</span>
                    <span className="text-sm text-muted-foreground">Full control</span>
                  </button>
                </div>

                {/* Day Selector (if auto-regenerate is on) */}
                {autoRegenerate && (
                  <div className="space-y-3 animate-fade-in">
                    <Label className="text-sm font-medium">Regenerate on:</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.id}
                          onClick={() => setRegenerateDay(day.id)}
                          className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            regenerateDay === day.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary hover:bg-secondary/80'
                          }`}
                          data-testid={`regen-day-${day.id}`}
                        >
                          {day.label.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your new plan will be ready every {DAYS_OF_WEEK.find(d => d.id === regenerateDay)?.label} morning.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 5: Plan Generation */}
          {step === 5 && (
            <div className="text-center py-16" data-testid="onboarding-step-5">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Building your plan</h2>
              <p className="text-lg text-muted-foreground mb-2 h-8">
                {loadingMessage}
              </p>
              <div className="flex justify-center gap-1 mt-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {step > 0 && step < 5 && (
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                className="rounded-full px-6"
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  className="rounded-full px-6"
                  data-testid="next-btn"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="rounded-full px-8"
                  data-testid="generate-plan-btn"
                >
                  {loading ? 'Saving...' : 'Generate My Plan'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
