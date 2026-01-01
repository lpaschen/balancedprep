import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORIES = ['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Deli', 'Pantry', 'Other'];
const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'paleo',
  'low-sodium',
  'nut-free',
];

const AddRecipe = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    meal_type: 'lunch',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    prep_time: '15',
    cook_time: '15',
    servings: '1',
    image_url: '',
    tags: [],
    ingredients: [{ name: '', quantity: '', unit: '', category: 'Pantry' }],
    instructions: [''],
  });

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { name: '', quantity: '', unit: '', category: 'Pantry' },
      ],
    }));
  };

  const updateIngredient = (index, field, value) => {
    setForm((prev) => {
      const ingredients = [...prev.ingredients];
      ingredients[index] = { ...ingredients[index], [field]: value };
      return { ...prev, ingredients };
    });
  };

  const removeIngredient = (index) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const addInstruction = () => {
    setForm((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ''],
    }));
  };

  const updateInstruction = (index, value) => {
    setForm((prev) => {
      const instructions = [...prev.instructions];
      instructions[index] = value;
      return { ...prev, instructions };
    });
  };

  const removeInstruction = (index) => {
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.calories || !form.protein || !form.carbs || !form.fat) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (form.ingredients.some((ing) => !ing.name)) {
      toast.error('Please fill in all ingredient names');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        meal_type: form.meal_type,
        calories: parseFloat(form.calories),
        protein: parseFloat(form.protein),
        carbs: parseFloat(form.carbs),
        fat: parseFloat(form.fat),
        prep_time: parseInt(form.prep_time) || 15,
        cook_time: parseInt(form.cook_time) || 15,
        servings: parseInt(form.servings) || 1,
        image_url: form.image_url,
        tags: form.tags,
        ingredients: form.ingredients
          .filter((ing) => ing.name)
          .map((ing) => ({
            name: ing.name,
            quantity: parseFloat(ing.quantity) || 1,
            unit: ing.unit || 'unit',
            category: ing.category,
          })),
        instructions: form.instructions.filter((inst) => inst.trim()),
      };

      await axios.post(`${API}/recipes`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Recipe added!');
      navigate('/recipes');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to add recipe';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="add-recipe-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/recipes')}
          className="rounded-full"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">Add Recipe</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Grilled Chicken Salad"
                className="h-12 rounded-xl"
                data-testid="recipe-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description of the recipe"
                className="rounded-xl resize-none"
                rows={2}
                data-testid="recipe-description-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meal Type *</Label>
                <Select
                  value={form.meal_type}
                  onValueChange={(value) => updateField('meal_type', value)}
                >
                  <SelectTrigger className="h-12 rounded-xl" data-testid="meal-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={form.image_url}
                  onChange={(e) => updateField('image_url', e.target.value)}
                  placeholder="https://..."
                  className="h-12 rounded-xl"
                  data-testid="image-url-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nutrition */}
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-lg">Nutrition (per serving) *</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  value={form.calories}
                  onChange={(e) => updateField('calories', e.target.value)}
                  placeholder="e.g., 450"
                  className="h-12 rounded-xl"
                  data-testid="calories-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  value={form.protein}
                  onChange={(e) => updateField('protein', e.target.value)}
                  placeholder="e.g., 35"
                  className="h-12 rounded-xl"
                  data-testid="protein-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  value={form.carbs}
                  onChange={(e) => updateField('carbs', e.target.value)}
                  placeholder="e.g., 40"
                  className="h-12 rounded-xl"
                  data-testid="carbs-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">Fat (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  value={form.fat}
                  onChange={(e) => updateField('fat', e.target.value)}
                  placeholder="e.g., 20"
                  className="h-12 rounded-xl"
                  data-testid="fat-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time & Servings */}
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-lg">Time & Servings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prep_time">Prep (min)</Label>
                <Input
                  id="prep_time"
                  type="number"
                  value={form.prep_time}
                  onChange={(e) => updateField('prep_time', e.target.value)}
                  className="h-12 rounded-xl"
                  data-testid="prep-time-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cook_time">Cook (min)</Label>
                <Input
                  id="cook_time"
                  type="number"
                  value={form.cook_time}
                  onChange={(e) => updateField('cook_time', e.target.value)}
                  className="h-12 rounded-xl"
                  data-testid="cook-time-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servings">Servings</Label>
                <Input
                  id="servings"
                  type="number"
                  value={form.servings}
                  onChange={(e) => updateField('servings', e.target.value)}
                  className="h-12 rounded-xl"
                  data-testid="servings-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-lg">Dietary Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DIETARY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`tag-chip ${form.tags.includes(tag) ? 'active' : ''}`}
                  data-testid={`tag-${tag}`}
                >
                  {form.tags.includes(tag) && <Check className="w-3 h-3 mr-1" />}
                  {tag}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Ingredients</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addIngredient}
              className="rounded-full"
              data-testid="add-ingredient-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.ingredients.map((ing, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <Input
                    placeholder="Name"
                    value={ing.name}
                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    className="h-10 rounded-lg col-span-2"
                    data-testid={`ingredient-name-${index}`}
                  />
                  <Input
                    placeholder="Qty"
                    type="number"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                    className="h-10 rounded-lg"
                    data-testid={`ingredient-qty-${index}`}
                  />
                  <Input
                    placeholder="Unit"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                    className="h-10 rounded-lg"
                    data-testid={`ingredient-unit-${index}`}
                  />
                </div>
                <Select
                  value={ing.category}
                  onValueChange={(value) => updateIngredient(index, 'category', value)}
                >
                  <SelectTrigger className="w-28 h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.ingredients.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeIngredient(index)}
                    className="h-10 w-10 p-0"
                    data-testid={`remove-ingredient-${index}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Instructions</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInstruction}
              className="rounded-full"
              data-testid="add-instruction-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Step
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.instructions.map((inst, index) => (
              <div key={index} className="flex gap-2 items-start">
                <span className="w-6 h-10 flex items-center justify-center text-sm font-medium text-muted-foreground">
                  {index + 1}.
                </span>
                <Input
                  placeholder={`Step ${index + 1}`}
                  value={inst}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  className="h-10 rounded-lg flex-1"
                  data-testid={`instruction-${index}`}
                />
                {form.instructions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInstruction(index)}
                    className="h-10 w-10 p-0"
                    data-testid={`remove-instruction-${index}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/recipes')}
            className="rounded-full px-6"
            data-testid="cancel-btn"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="rounded-full px-8"
            data-testid="save-recipe-btn"
          >
            {loading ? 'Saving...' : 'Save Recipe'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddRecipe;
