import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import { ShoppingCart, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORY_ORDER = [
  'Produce',
  'Meat',
  'Seafood',
  'Dairy',
  'Bakery',
  'Deli',
  'Pantry',
  'Other',
];

const GroceryList = () => {
  const { token } = useAuth();
  const [groceryList, setGroceryList] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGroceryList = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/grocery-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroceryList(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setGroceryList(null);
      } else {
        toast.error('Failed to load grocery list');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchGroceryList();
  }, [fetchGroceryList]);

  const toggleItem = async (itemId) => {
    try {
      const response = await axios.put(
        `${API}/grocery-list/toggle`,
        { item_id: itemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGroceryList(response.data);
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const groupByCategory = (items) => {
    const groups = {};
    items.forEach((item) => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Sort by predefined order
    const sortedGroups = {};
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });
    // Add any remaining categories
    Object.keys(groups).forEach((cat) => {
      if (!sortedGroups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });

    return sortedGroups;
  };

  const formatQuantity = (quantity, unit) => {
    const rounded = Math.round(quantity * 10) / 10;
    return `${rounded} ${unit}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" data-testid="grocery-loading">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!groceryList || groceryList.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up" data-testid="no-grocery-list">
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mb-6">
          <ShoppingCart className="w-12 h-12 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No grocery list yet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Generate a meal plan first, and your grocery list will appear here automatically.
        </p>
      </div>
    );
  }

  const groupedItems = groupByCategory(groceryList.items);
  const totalItems = groceryList.items.length;
  const checkedItems = groceryList.items.filter((item) => item.checked).length;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="grocery-list">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Grocery List</h1>
        <p className="text-muted-foreground mt-1">
          {checkedItems} of {totalItems} items checked
        </p>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <div className="absolute -right-1 -top-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Grocery Items by Category */}
      <div className="space-y-6 stagger-children">
        {Object.entries(groupedItems).map(([category, items]) => (
          <Card key={category} className="rounded-2xl border-border overflow-hidden">
            <div className="px-6 py-3 bg-secondary/50 border-b border-border">
              <h2 className="font-semibold">{category}</h2>
            </div>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-accent/30 transition-colors"
                  >
                    <Checkbox
                      id={item.id}
                      checked={item.checked}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="w-6 h-6 rounded-full border-2"
                      data-testid={`grocery-item-${item.id}`}
                    />
                    <label
                      htmlFor={item.id}
                      className={`flex-1 cursor-pointer select-none ${
                        item.checked ? 'grocery-item-checked' : ''
                      }`}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        {formatQuantity(item.quantity, item.unit)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Image */}
      {progress < 100 && (
        <div className="flex justify-center pt-8">
          <img
            src="https://images.unsplash.com/photo-1617500603321-bcd6286973b7?w=400&q=80"
            alt="Fresh groceries"
            className="w-32 h-32 rounded-full object-cover opacity-50"
          />
        </div>
      )}
    </div>
  );
};

export default GroceryList;
