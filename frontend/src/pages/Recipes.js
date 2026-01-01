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
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Search, Clock, BookOpen } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner', 'snack'];

const Recipes = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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
        <Button
          onClick={() => navigate('/recipes/add')}
          className="rounded-full"
          data-testid="add-recipe-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Recipe
        </Button>
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
          <p className="text-muted-foreground">No recipes found</p>
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
              {recipe.image_url ? (
                <img
                  src={recipe.image_url}
                  alt={recipe.name}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-accent flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground" strokeWidth={1} />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold line-clamp-1">{recipe.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary whitespace-nowrap">
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
                {recipe.user_id && (
                  <div className="mt-2 text-xs text-primary font-medium">Your recipe</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recipe Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedRecipe.name}</DialogTitle>
                <DialogDescription>{selectedRecipe.description}</DialogDescription>
              </DialogHeader>
              {selectedRecipe.image_url && (
                <img
                  src={selectedRecipe.image_url}
                  alt={selectedRecipe.name}
                  className="w-full h-48 object-cover rounded-xl"
                />
              )}
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
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {selectedRecipe.ingredients?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Ingredients</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i}>
                        {ing.quantity} {ing.unit} {ing.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedRecipe.instructions?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    {selectedRecipe.instructions.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-medium text-foreground">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recipes;
