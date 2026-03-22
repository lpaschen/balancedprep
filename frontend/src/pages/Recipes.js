import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
import { Plus, Search, Clock, BookOpen, Sparkles, Check, Loader2, Globe, User, CalendarDays, ChevronDown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner', 'snack'];

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

// ─── Use in Meal Plan picker ─────────────────────────────────────────────────

const UseinPlanPicker = ({ recipe, token, onDone }) => {
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    axios.get(`${API}/meal-plan`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setMealPlan(r.data))
      .catch(() => setMealPlan(null))
      .finally(() => setLoading(false));
  }, [token]);

  const assign = async () => {
    if (selectedDay === null || selectedSlot === null) return;
    const day = mealPlan.days[selectedDay];
    const mealIndex = day.meals.findIndex(m => m.meal_type === selectedSlot);
    if (mealIndex === -1) return;
    setAssigning(true);
    try {
      await axios.put(`${API}/meal-plan/assign-meal`,
        { day_index: selectedDay, meal_index: mealIndex, recipe_id: recipe.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${recipe.name} added to ${DAYS_SHORT[selectedDay]} ${selectedSlot}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign recipe');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading meal plan...</div>;
  if (!mealPlan) return <div className="text-sm text-muted-foreground">No meal plan yet — generate one first.</div>;

  // Only show slots that match the recipe's meal type
  const compatibleSlots = MEAL_SLOTS.filter(s => s === recipe.meal_type);
  const slots = compatibleSlots.length > 0 ? compatibleSlots : MEAL_SLOTS;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Choose a day & meal slot:</p>
      <div className="flex flex-wrap gap-1.5">
        {mealPlan.days.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedDay === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            {DAYS_SHORT[i]}
          </button>
        ))}
      </div>
      {selectedDay !== null && (
        <div className="flex flex-wrap gap-1.5">
          {slots.map(slot => (
            <button
              key={slot}
              onClick={() => setSelectedSlot(slot)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                selectedSlot === slot
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      )}
      {selectedDay !== null && selectedSlot !== null && (
        <Button size="sm" onClick={assign} disabled={assigning} className="rounded-full w-full">
          {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
          Add to {DAYS_SHORT[selectedDay]} {selectedSlot}
        </Button>
      )}
    </div>
  );
};

// ─── Spoonacular Search Modal ────────────────────────────────────────────────

const SpoonacularModal = ({ open, onClose, token, isAdmin, onImported }) => {
  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState('all');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(null); // spoonacular_id being imported

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ query, number: 12 });
      if (mealType !== 'all') params.append('meal_type', mealType);
      const res = await axios.get(`${API}/spoonacular/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResults(res.data.results);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (result) => {
    setImporting(result.spoonacular_id);
    try {
      const params = new URLSearchParams({ meal_type: result.meal_type });
      const res = await axios.post(
        `${API}/spoonacular/import/${result.spoonacular_id}?${params}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const isGlobal = res.data.global;
      toast.success(
        isGlobal
          ? `"${result.name}" added to the global recipe bank`
          : `"${result.name}" added to your personal recipes`
      );
      // Mark as imported in results
      setResults(prev =>
        prev.map(r => r.spoonacular_id === result.spoonacular_id ? { ...r, already_imported: true } : r)
      );
      onImported();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.info('Already imported');
      } else {
        toast.error(err.response?.data?.detail || 'Import failed');
      }
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            Find Recipes
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Search Spoonacular and add recipes to the global recipe bank for all users.'
              : 'Search Spoonacular and save recipes to your personal library.'}
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="px-6 pb-4 flex-shrink-0 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="e.g. high protein chicken, vegan breakfast..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                className="pl-9 rounded-xl"
              />
            </div>
            <Button onClick={search} disabled={searching || !query.trim()} className="rounded-xl px-5">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
          <div className="flex gap-2">
            {MEAL_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setMealType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  mealType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Admin / user scope badge */}
          {results.length > 0 && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full w-fit font-medium ${
              isAdmin ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
            }`}>
              {isAdmin ? <Globe className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {isAdmin ? 'Importing as global recipes (available to all users)' : 'Importing to your personal library'}
            </div>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 overflow-y-auto px-6 pb-6">
          {results.length === 0 && !searching && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Search for recipes above to get started
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {results.map(result => (
              <div
                key={result.spoonacular_id}
                className="border border-border rounded-xl overflow-hidden flex flex-col"
              >
                {result.image_url && (
                  <div className="w-full h-28 overflow-hidden flex-shrink-0">
                    <img
                      src={result.image_url}
                      alt={result.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.parentElement.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm line-clamp-2 flex-1">{result.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary capitalize flex-shrink-0">
                      {result.meal_type}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                    <span className="font-medium text-foreground">{Math.round(result.calories)} cal</span>
                    <span>{Math.round(result.protein)}g protein</span>
                    <span>{Math.round(result.carbs)}g carbs</span>
                    <span>{Math.round(result.fat)}g fat</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {result.ready_in_minutes}m
                    </div>
                    {result.already_imported ? (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Check className="w-3.5 h-3.5" /> Imported
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-7 text-xs px-3"
                        disabled={importing === result.spoonacular_id}
                        onClick={() => handleImport(result)}
                      >
                        {importing === result.spoonacular_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3 mr-1" />
                            {isAdmin ? 'Add to bank' : 'Add to mine'}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Recipes Page ───────────────────────────────────────────────────────

const Recipes = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [spoonacularOpen, setSpoonacularOpen] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const isAdmin = user?.is_admin;

  const fetchRecipes = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/recipes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecipes(response.data);
    } catch (error) {
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || recipe.meal_type === filterType;
    return matchesSearch && matchesType;
  });

  const openRecipeModal = (recipe) => {
    setSelectedRecipe(recipe);
    setShowPlanPicker(false);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" data-testid="recipes-loading">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="recipes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Recipes</h1>
          <p className="text-muted-foreground mt-1">{recipes.length} recipes available</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSpoonacularOpen(true)}
            className="rounded-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Find Recipes
          </Button>
          <Button
            onClick={() => navigate('/recipes/add')}
            className="rounded-full"
            data-testid="add-recipe-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Recipe
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 rounded-xl"
            data-testid="recipe-search-input"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              data-testid={`filter-${type}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mb-4">
            <BookOpen className="w-10 h-10 text-primary" strokeWidth={1.5} />
          </div>
          <p className="text-muted-foreground mb-4">No recipes found</p>
          <Button variant="outline" onClick={() => setSpoonacularOpen(true)} className="rounded-full">
            <Sparkles className="w-4 h-4 mr-2" />
            Find recipes on Spoonacular
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="rounded-2xl border-border overflow-hidden cursor-pointer meal-card"
              onClick={() => openRecipeModal(recipe)}
              data-testid={`recipe-card-${recipe.id}`}
            >
              {recipe.image_url && (
                <div className="w-full h-36 overflow-hidden">
                  <img
                    src={recipe.image_url}
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold line-clamp-1">{recipe.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary whitespace-nowrap capitalize">
                    {recipe.meal_type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {recipe.description || 'No description'}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-3 text-muted-foreground">
                    <span>{recipe.calories} cal</span>
                    <span>{recipe.protein}g protein</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {recipe.prep_time + recipe.cook_time}m
                  </div>
                </div>
                {recipe.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground capitalize">
                        {tag}
                      </span>
                    ))}
                    {recipe.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{recipe.tags.length - 3}</span>
                    )}
                  </div>
                )}
                {/* Source badge */}
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {recipe.user_id === null ? (
                    <><Globe className="w-3 h-3" /> Global</>
                  ) : (
                    <><User className="w-3 h-3" /> Your recipe</>
                  )}
                  {recipe.spoonacular_id && (
                    <span className="ml-1 text-primary">· Spoonacular</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recipe Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 max-h-[85vh] overflow-hidden flex flex-col">
          {selectedRecipe && (
            <>
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

              {/* Use in meal plan */}
              <div className="px-6 pt-3">
                <button
                  onClick={() => setShowPlanPicker(v => !v)}
                  className="flex items-center gap-2 w-full p-3 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-sm font-medium text-primary"
                >
                  <CalendarDays className="w-4 h-4" />
                  Use in meal plan
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showPlanPicker ? 'rotate-180' : ''}`} />
                </button>
                {showPlanPicker && (
                  <div className="mt-3 p-3 rounded-xl border border-border bg-card">
                    <UseinPlanPicker
                      recipe={selectedRecipe}
                      token={token}
                      onDone={() => { setShowPlanPicker(false); setModalOpen(false); }}
                    />
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="space-y-5 pt-4">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                      { label: 'cal', value: selectedRecipe.calories },
                      { label: 'protein', value: `${selectedRecipe.protein}g` },
                      { label: 'carbs', value: `${selectedRecipe.carbs}g` },
                      { label: 'fat', value: `${selectedRecipe.fat}g` },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl bg-secondary">
                        <div className="text-lg font-semibold">{value}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedRecipe.prep_time + selectedRecipe.cook_time} min total
                    </div>
                    <div>{selectedRecipe.servings} serving(s)</div>
                  </div>
                  {selectedRecipe.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.tags.map((tag) => (
                        <span key={tag} className="tag-chip">{tag}</span>
                      ))}
                    </div>
                  )}
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

      {/* Spoonacular Search Modal */}
      <SpoonacularModal
        open={spoonacularOpen}
        onClose={() => setSpoonacularOpen(false)}
        token={token}
        isAdmin={isAdmin}
        onImported={fetchRecipes}
      />
    </div>
  );
};

export default Recipes;
