#!/usr/bin/env python3
"""
BalancedPrep Dietary Preference & Macro Targeting Test Suite
Specifically tests the fixes for:
1. Strict dietary preference filtering (vegan + gluten-free)
2. Macro targets within 10% tolerance
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional, List

class DietaryPreferenceAPITester:
    def __init__(self, base_url="https://meal-plan-builder-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.meal_plan = None

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200) -> tuple[bool, Dict]:
        """Make API request and return success status and response data"""
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
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def setup_vegan_gf_user(self):
        """Create user with vegan + gluten-free preferences and specific targets"""
        timestamp = datetime.now().strftime("%H%M%S")
        
        # Register user
        test_user = {
            "email": f"vegan_gf_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Vegan GF User {timestamp}"
        }

        success, response = self.make_request('POST', 'auth/register', test_user)
        
        if not success or 'token' not in response:
            self.log_test("Setup: User registration", False, f"Registration failed: {response}")
            return False
            
        self.token = response['token']
        self.user_data = response['user']
        
        # Set targets: 1800 cal, 120g protein + vegan + gluten-free preferences
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
        
        if success and response.get('onboarding_complete') == True:
            self.user_data = response
            self.log_test("Setup: Vegan+GF user with targets", True)
            return True
        else:
            self.log_test("Setup: Vegan+GF user with targets", False, f"Profile update failed: {response}")
            return False

    def seed_recipes(self):
        """Seed recipes to ensure we have vegan+GF options"""
        success, response = self.make_request('POST', 'seed-recipes')
        
        if success:
            self.log_test("Setup: Seed recipes", True)
            return True
        else:
            self.log_test("Setup: Seed recipes", False, f"Response: {response}")
            return False

    def test_vegan_gf_recipe_availability(self):
        """Test that vegan+GF recipes are available for all meal types"""
        meal_types = ["breakfast", "lunch", "dinner", "snack"]
        
        for meal_type in meal_types:
            success, response = self.make_request('GET', f'recipes?meal_type={meal_type}')
            
            if not success:
                self.log_test(f"Recipe availability: {meal_type}", False, f"API call failed: {response}")
                continue
                
            # Filter for vegan+GF recipes
            vegan_gf_recipes = [
                r for r in response 
                if 'vegan' in r.get('tags', []) and 'gluten-free' in r.get('tags', [])
            ]
            
            if len(vegan_gf_recipes) > 0:
                self.log_test(f"Vegan+GF recipes available: {meal_type}", True, 
                             f"Found {len(vegan_gf_recipes)} recipes")
            else:
                self.log_test(f"Vegan+GF recipes available: {meal_type}", False, 
                             f"No vegan+GF recipes found for {meal_type}")

    def test_generate_vegan_gf_meal_plan(self):
        """Generate meal plan and verify ALL recipes have vegan+GF tags"""
        success, response = self.make_request('POST', 'meal-plan/generate', {})
        
        if not success:
            self.log_test("Generate vegan+GF meal plan", False, f"Generation failed: {response}")
            return False
            
        self.meal_plan = response
        
        # Check every recipe in every day
        all_recipes_compliant = True
        non_compliant_recipes = []
        
        for day_idx, day in enumerate(response.get('days', [])):
            for meal_idx, meal in enumerate(day.get('meals', [])):
                recipe_id = meal.get('recipe_id')
                recipe_name = meal.get('recipe_name', 'Unknown')
                
                # Get recipe details to check tags
                recipe_success, recipe_data = self.make_request('GET', f'recipes/{recipe_id}')
                
                if recipe_success:
                    tags = recipe_data.get('tags', [])
                    has_vegan = 'vegan' in tags
                    has_gf = 'gluten-free' in tags
                    
                    if not (has_vegan and has_gf):
                        all_recipes_compliant = False
                        non_compliant_recipes.append({
                            'day': day.get('day'),
                            'meal_type': meal.get('meal_type'),
                            'recipe_name': recipe_name,
                            'tags': tags,
                            'missing': [tag for tag in ['vegan', 'gluten-free'] if tag not in tags]
                        })
        
        if all_recipes_compliant:
            self.log_test("All recipes have vegan+GF tags", True)
            return True
        else:
            details = f"Non-compliant recipes: {json.dumps(non_compliant_recipes, indent=2)}"
            self.log_test("All recipes have vegan+GF tags", False, details)
            return False

    def test_macro_targets_within_tolerance(self):
        """Verify daily totals are within 10% of targets for calories and protein"""
        if not self.meal_plan:
            self.log_test("Macro targets within tolerance", False, "No meal plan available")
            return False
            
        target_calories = 1800
        target_protein = 120
        tolerance = 10.0  # 10%
        
        all_days_on_target = True
        off_target_days = []
        
        for day in self.meal_plan.get('days', []):
            totals = day.get('totals', {})
            day_calories = totals.get('calories', 0)
            day_protein = totals.get('protein', 0)
            
            # Calculate percentage differences
            cal_diff_pct = abs(day_calories - target_calories) / target_calories * 100
            prot_diff_pct = abs(day_protein - target_protein) / target_protein * 100
            
            cal_on_target = cal_diff_pct <= tolerance
            prot_on_target = prot_diff_pct <= tolerance
            
            if not (cal_on_target and prot_on_target):
                all_days_on_target = False
                off_target_days.append({
                    'day': day.get('day'),
                    'calories': {
                        'actual': day_calories,
                        'target': target_calories,
                        'diff_pct': round(cal_diff_pct, 1),
                        'on_target': cal_on_target
                    },
                    'protein': {
                        'actual': day_protein,
                        'target': target_protein,
                        'diff_pct': round(prot_diff_pct, 1),
                        'on_target': prot_on_target
                    }
                })
        
        if all_days_on_target:
            self.log_test("Daily totals within 10% tolerance", True)
            return True
        else:
            details = f"Off-target days: {json.dumps(off_target_days, indent=2)}"
            self.log_test("Daily totals within 10% tolerance", False, details)
            return False

    def test_swap_meal_maintains_preferences(self):
        """Test that swapping a meal maintains vegan+GF preferences"""
        if not self.meal_plan:
            self.log_test("Swap meal maintains preferences", False, "No meal plan available")
            return False
            
        # Swap first meal of first day
        swap_data = {
            "day_index": 0,
            "meal_index": 0
        }

        success, response = self.make_request('PUT', 'meal-plan/swap-meal', swap_data)
        
        if not success:
            self.log_test("Swap meal maintains preferences", False, f"Swap failed: {response}")
            return False
            
        # Check the swapped meal has vegan+GF tags
        swapped_meal = response['days'][0]['meals'][0]
        recipe_id = swapped_meal.get('recipe_id')
        
        recipe_success, recipe_data = self.make_request('GET', f'recipes/{recipe_id}')
        
        if recipe_success:
            tags = recipe_data.get('tags', [])
            has_vegan = 'vegan' in tags
            has_gf = 'gluten-free' in tags
            
            if has_vegan and has_gf:
                self.log_test("Swap meal maintains preferences", True)
                return True
            else:
                self.log_test("Swap meal maintains preferences", False, 
                             f"Swapped recipe missing tags: {tags}")
                return False
        else:
            self.log_test("Swap meal maintains preferences", False, 
                         f"Could not fetch swapped recipe: {recipe_data}")
            return False

    def test_regenerate_day_maintains_preferences(self):
        """Test that regenerating a day maintains vegan+GF preferences"""
        if not self.meal_plan:
            self.log_test("Regenerate day maintains preferences", False, "No meal plan available")
            return False
            
        # Regenerate second day
        regen_data = {
            "day_index": 1
        }

        success, response = self.make_request('PUT', 'meal-plan/regenerate-day', regen_data)
        
        if not success:
            self.log_test("Regenerate day maintains preferences", False, f"Regeneration failed: {response}")
            return False
            
        # Check all meals in regenerated day have vegan+GF tags
        regenerated_day = response['days'][1]
        all_compliant = True
        non_compliant = []
        
        for meal in regenerated_day.get('meals', []):
            recipe_id = meal.get('recipe_id')
            recipe_success, recipe_data = self.make_request('GET', f'recipes/{recipe_id}')
            
            if recipe_success:
                tags = recipe_data.get('tags', [])
                has_vegan = 'vegan' in tags
                has_gf = 'gluten-free' in tags
                
                if not (has_vegan and has_gf):
                    all_compliant = False
                    non_compliant.append({
                        'meal_type': meal.get('meal_type'),
                        'recipe_name': meal.get('recipe_name'),
                        'tags': tags
                    })
        
        if all_compliant:
            self.log_test("Regenerate day maintains preferences", True)
            return True
        else:
            self.log_test("Regenerate day maintains preferences", False, 
                         f"Non-compliant meals: {json.dumps(non_compliant, indent=2)}")
            return False

    def test_no_meat_dairy_ingredients(self):
        """Verify no meat or dairy ingredients appear in any recipe"""
        if not self.meal_plan:
            self.log_test("No meat/dairy ingredients", False, "No meal plan available")
            return False
            
        # Common meat and dairy ingredients to check for
        meat_keywords = ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'meat', 'bacon', 'ham']
        dairy_keywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'dairy']
        
        all_recipes_clean = True
        problematic_recipes = []
        
        # Get all unique recipe IDs from meal plan
        recipe_ids = set()
        for day in self.meal_plan.get('days', []):
            for meal in day.get('meals', []):
                recipe_ids.add(meal.get('recipe_id'))
        
        for recipe_id in recipe_ids:
            recipe_success, recipe_data = self.make_request('GET', f'recipes/{recipe_id}')
            
            if recipe_success:
                recipe_name = recipe_data.get('name', 'Unknown')
                ingredients = recipe_data.get('ingredients', [])
                
                problematic_ingredients = []
                
                for ingredient in ingredients:
                    ingredient_name = ingredient.get('name', '').lower()
                    
                    # Check for meat keywords
                    for meat in meat_keywords:
                        if meat in ingredient_name:
                            problematic_ingredients.append(f"MEAT: {ingredient['name']}")
                    
                    # Check for dairy keywords (excluding plant-based alternatives)
                    for dairy in dairy_keywords:
                        if dairy in ingredient_name and 'almond' not in ingredient_name and 'coconut' not in ingredient_name and 'soy' not in ingredient_name:
                            problematic_ingredients.append(f"DAIRY: {ingredient['name']}")
                
                if problematic_ingredients:
                    all_recipes_clean = False
                    problematic_recipes.append({
                        'recipe_name': recipe_name,
                        'problematic_ingredients': problematic_ingredients
                    })
        
        if all_recipes_clean:
            self.log_test("No meat/dairy ingredients", True)
            return True
        else:
            details = f"Recipes with meat/dairy: {json.dumps(problematic_recipes, indent=2)}"
            self.log_test("No meat/dairy ingredients", False, details)
            return False

    def run_dietary_preference_tests(self):
        """Run all dietary preference and macro targeting tests"""
        print("🥗 Starting BalancedPrep Dietary Preference & Macro Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("🎯 Focus: Vegan + Gluten-Free filtering & 10% macro tolerance")
        print("=" * 70)

        # Test sequence
        tests = [
            self.setup_vegan_gf_user,
            self.seed_recipes,
            self.test_vegan_gf_recipe_availability,
            self.test_generate_vegan_gf_meal_plan,
            self.test_macro_targets_within_tolerance,
            self.test_swap_meal_maintains_preferences,
            self.test_regenerate_day_maintains_preferences,
            self.test_no_meat_dairy_ingredients,
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(test.__name__, False, f"Exception: {str(e)}")

        # Print summary
        print("=" * 70)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All dietary preference tests passed!")
            return 0
        else:
            print("❌ Some dietary preference tests failed!")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['details']}")
            return 1

def main():
    """Main test runner"""
    tester = DietaryPreferenceAPITester()
    return tester.run_dietary_preference_tests()

if __name__ == "__main__":
    sys.exit(main())