import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowRight, ArrowLeft, Leaf, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'keto', label: 'Keto' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'low-sodium', label: 'Low-sodium' },
  { id: 'nut-free', label: 'Nut-free' },
];

const PREP_LABELS = ['Minimal', 'Low', 'Moderate', 'High', 'Maximum'];

const Onboarding = () => {
  const navigate = useNavigate();
  const { token, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Targets
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Preferences
  const [preferences, setPreferences] = useState([]);
  const [prepLevel, setPrepLevel] = useState(3);

  const togglePreference = (id) => {
    setPreferences((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
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
    if (step === 1) {
      if (!hasAtLeastOneTarget()) {
        toast.error('Please set at least one nutrition target');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleComplete = async () => {
    if (!hasAtLeastOneTarget()) {
      toast.error('Please set at least one nutrition target');
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
          prep_level: prepLevel,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      updateUser(response.data);
      toast.success('Setup complete! Generating your meal plan...');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save settings';
      toast.error(message);
    } finally {
      setLoading(false);
    }
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

      {/* Progress */}
      <div className="px-6 mb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  s <= step ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Step {step} of 3</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pb-16">
        <div className="w-full max-w-lg animate-fade-in-up">
          {step === 1 && (
            <Card className="border-border rounded-2xl shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">Set your nutrition targets</CardTitle>
                <CardDescription>
                  Set at least one target. Leave others blank if you don't want to track them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories">Daily Calories</Label>
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
                <p className="text-sm text-muted-foreground">
                  Tip: For weight loss, try 1500-1800 cal. For maintenance, 2000-2200 cal.
                </p>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-border rounded-2xl shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">Dietary preferences</CardTitle>
                <CardDescription>
                  Select any dietary restrictions. Skip if none apply.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {DIETARY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => togglePreference(option.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        preferences.includes(option.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                      data-testid={`preference-${option.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.label}</span>
                        {preferences.includes(option.id) && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-border rounded-2xl shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">Meal prep style</CardTitle>
                <CardDescription>
                  How much variety do you want in your weekly meals?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Batch cooking</span>
                    <span className="text-muted-foreground">Maximum variety</span>
                  </div>
                  <Slider
                    value={[prepLevel]}
                    onValueChange={(value) => setPrepLevel(value[0])}
                    min={1}
                    max={5}
                    step={1}
                    className="py-4"
                    data-testid="prep-level-slider"
                  />
                  <div className="text-center">
                    <span className="text-lg font-semibold text-primary">
                      {PREP_LABELS[prepLevel - 1]} Variety
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {prepLevel === 1 && '~7 unique meals (great for batch cooking)'}
                      {prepLevel === 2 && '~12 unique meals'}
                      {prepLevel === 3 && '~17 unique meals (balanced)'}
                      {prepLevel === 4 && '~22 unique meals'}
                      {prepLevel === 5 && '~28 unique meals (daily variety)'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-accent/50">
                  <p className="text-sm text-muted-foreground">
                    <strong>Lower variety</strong> = fewer unique meals, more repeats (batch cooking friendly)
                    <br />
                    <strong>Higher variety</strong> = more unique meals, less repetition
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={handleBack}
                className="rounded-full px-6"
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < 3 ? (
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
                data-testid="complete-setup-btn"
              >
                {loading ? 'Saving...' : 'Generate My Plan'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
