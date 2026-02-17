#!/usr/bin/env python3
"""
BalancedPrep Meal Plan Analysis
Detailed analysis of meal plan generation to understand macro targeting issues
"""

import requests
import sys
import json
from datetime import datetime

class MealPlanAnalyzer:
    def __init__(self, base_url="https://meal-plan-builder-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None

    def make_request(self, method: str, endpoint: str, data=None, expected_status: int = 200):
        """Make API request"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def setup_test_user(self):
        """Setup test user with vegan+GF preferences and high protein target"""
        timestamp = datetime.now().strftime("%H%M%S%f")
        
        # Register user
        test_user = {
            "email": f"analysis_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Analysis User {timestamp}"
        }

        success, response = self.make_request('POST', 'auth/register', test_user)
        
        if not success:
            print(f"❌ Registration failed: {response}")
            return False
            
        self.token = response['token']
        
        # Set targets: 1800 cal, 120g protein + vegan + gluten-free
        profile_data = {
            "targets": {
                "calories": 1800,
                "protein": 120,
                "carbs": 200,
                "fat": 60
            },
            "preferences": ["vegan", "gluten-free"],
            "prep_level": 3
        }

        success, response = self.make_request('PUT', 'user/profile', profile_data)
        
        if success:
            print("✅ Test user setup complete")
            print(f"   Targets: 1800 cal, 120g protein")
            print(f"   Preferences: vegan, gluten-free")
            return True
        else:
            print(f"❌ Profile update failed: {response}")
            return False

    def analyze_available_recipes(self):
        """Analyze available vegan+GF recipes and their protein content"""
        print("\n🔍 Analyzing available vegan+GF recipes...")
        
        meal_types = ["breakfast", "lunch", "dinner", "snack"]
        
        for meal_type in meal_types:
            success, recipes = self.make_request('GET', f'recipes?meal_type={meal_type}')
            
            if success:
                # Filter for vegan+GF recipes
                vegan_gf_recipes = [
                    r for r in recipes 
                    if 'vegan' in r.get('tags', []) and 'gluten-free' in r.get('tags', [])
                ]
                
                print(f"\n📋 {meal_type.upper()} - Vegan+GF recipes: {len(vegan_gf_recipes)}")
                
                if vegan_gf_recipes:
                    # Sort by protein content
                    vegan_gf_recipes.sort(key=lambda x: x.get('protein', 0), reverse=True)
                    
                    print("   Top protein recipes:")
                    for i, recipe in enumerate(vegan_gf_recipes[:3]):
                        print(f"   {i+1}. {recipe['name']}: {recipe['protein']}g protein, {recipe['calories']} cal")
                    
                    # Calculate average protein
                    avg_protein = sum(r['protein'] for r in vegan_gf_recipes) / len(vegan_gf_recipes)
                    max_protein = max(r['protein'] for r in vegan_gf_recipes)
                    min_protein = min(r['protein'] for r in vegan_gf_recipes)
                    
                    print(f"   Protein range: {min_protein}g - {max_protein}g (avg: {avg_protein:.1f}g)")
                else:
                    print("   ❌ No vegan+GF recipes found!")

    def analyze_meal_plan(self):
        """Generate and analyze meal plan in detail"""
        print("\n🎯 Generating and analyzing meal plan...")
        
        # Seed recipes first
        self.make_request('POST', 'seed-recipes')
        
        # Generate meal plan
        success, meal_plan = self.make_request('POST', 'meal-plan/generate', {})
        
        if not success:
            print(f"❌ Meal plan generation failed: {meal_plan}")
            return
            
        print("✅ Meal plan generated successfully")
        print(f"   Unique meals: {meal_plan.get('unique_meals_count', 'unknown')}")
        print(f"   Tolerance: {meal_plan.get('tolerance', 'unknown')}%")
        
        # Analyze each day
        for day_idx, day in enumerate(meal_plan.get('days', [])):
            print(f"\n📅 {day['day']} (Day {day_idx + 1})")
            
            totals = day.get('totals', {})
            deltas = day.get('deltas', {})
            on_target = day.get('on_target', {})
            
            print(f"   Totals: {totals.get('calories', 0):.0f} cal, {totals.get('protein', 0):.0f}g protein")
            print(f"   Deltas: {deltas.get('calories', 0):.0f} cal, {deltas.get('protein', 0):.0f}g protein")
            print(f"   On target: calories={on_target.get('calories', False)}, protein={on_target.get('protein', False)}")
            
            # Analyze individual meals
            for meal in day.get('meals', []):
                meal_type = meal.get('meal_type')
                recipe_name = meal.get('recipe_name')
                servings = meal.get('servings', 1)
                calories = meal.get('calories', 0) * servings
                protein = meal.get('protein', 0) * servings
                
                print(f"     {meal_type}: {recipe_name} ({servings:.2f} servings)")
                print(f"       → {calories:.0f} cal, {protein:.1f}g protein")
                
                # Get recipe details to check tags
                recipe_id = meal.get('recipe_id')
                recipe_success, recipe_data = self.make_request('GET', f'recipes/{recipe_id}')
                
                if recipe_success:
                    tags = recipe_data.get('tags', [])
                    has_vegan = 'vegan' in tags
                    has_gf = 'gluten-free' in tags
                    print(f"       → Tags: {tags}")
                    print(f"       → Compliant: vegan={has_vegan}, GF={has_gf}")

    def calculate_theoretical_targets(self):
        """Calculate what the theoretical daily targets should be"""
        print("\n🧮 Theoretical meal distribution analysis:")
        
        target_calories = 1800
        target_protein = 120
        
        # Meal fractions as defined in the code
        main_meal_fraction = 0.30  # breakfast, lunch, dinner
        snack_fraction = 0.10      # snack
        
        print(f"   Target calories per main meal: {target_calories * main_meal_fraction:.0f}")
        print(f"   Target protein per main meal: {target_protein * main_meal_fraction:.1f}g")
        print(f"   Target calories for snack: {target_calories * snack_fraction:.0f}")
        print(f"   Target protein for snack: {target_protein * snack_fraction:.1f}g")
        
        total_theoretical = (3 * main_meal_fraction + 1 * snack_fraction) * target_calories
        total_protein_theoretical = (3 * main_meal_fraction + 1 * snack_fraction) * target_protein
        
        print(f"   Total theoretical calories: {total_theoretical:.0f}")
        print(f"   Total theoretical protein: {total_protein_theoretical:.1f}g")

    def run_analysis(self):
        """Run complete analysis"""
        print("🔬 BalancedPrep Meal Plan Analysis")
        print("=" * 50)
        
        if not self.setup_test_user():
            return
            
        self.analyze_available_recipes()
        self.calculate_theoretical_targets()
        self.analyze_meal_plan()

def main():
    analyzer = MealPlanAnalyzer()
    analyzer.run_analysis()

if __name__ == "__main__":
    main()