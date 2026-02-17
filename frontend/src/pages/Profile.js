import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, Save } from 'lucide-react';

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

const Profile = () => {
  const navigate = useNavigate();
  const { user, token, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const [calories, setCalories] = useState(user?.targets?.calories?.toString() || '');
  const [protein, setProtein] = useState(user?.targets?.protein?.toString() || '');
  const [carbs, setCarbs] = useState(user?.targets?.carbs?.toString() || '');
  const [fat, setFat] = useState(user?.targets?.fat?.toString() || '');
  const [preferences, setPreferences] = useState(user?.preferences || []);
  const [prepLevel, setPrepLevel] = useState(user?.prep_level || 3);

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

  const handleSave = async () => {
    if (!hasAtLeastOneTarget()) {
      toast.error('Please set at least one nutrition target');
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
      toast.success('Profile updated! Regenerate your meal plan to apply changes.');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save settings';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="profile-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">{user?.email}</p>
      </div>

      {/* Account Info */}
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-sm">Name</Label>
            <p className="font-medium">{user?.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">Email</Label>
            <p className="font-medium">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Nutrition Targets */}
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-lg">Daily Nutrition Targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set at least one target. Leave others blank if you don't want to track them.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calories">Calories</Label>
              <Input
                id="calories"
                type="number"
                placeholder="e.g., 2000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="h-12 rounded-xl"
                data-testid="profile-calories-input"
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
                data-testid="profile-protein-input"
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
                data-testid="profile-carbs-input"
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
                data-testid="profile-fat-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dietary Preferences */}
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-lg">Dietary Preferences</CardTitle>
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
                data-testid={`profile-preference-${option.id}`}
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

      {/* Meal Prep Style */}
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-lg">Meal Prep Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
            data-testid="profile-prep-slider"
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
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button
          onClick={handleSave}
          disabled={loading}
          className="rounded-full px-8 flex-1 sm:flex-none"
          data-testid="save-profile-btn"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/onboarding')}
          className="rounded-full px-8"
          data-testid="redo-onboarding-btn"
        >
          Redo Setup
        </Button>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="rounded-full px-8"
          data-testid="profile-logout-btn"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;
