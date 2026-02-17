#!/usr/bin/env python3
"""
BalancedPrep Macro Targeting Detailed Test
Tests the improved macro optimization with heavy protein weighting
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class MacroTargetingTester:
    def __init__(self, base_url="https://meal-plan-builder-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def setup_user_with_targets(self, calories: int, protein: int, preferences: list):
        """Create user with specific targets and preferences"""
        import random
        timestamp = datetime.now().strftime("%H%M%S")
        random_id = random.randint(1000, 9999)
        
        # Register user
        test_user = {
            "email": f"macro_test_{timestamp}_{random_id}@example.com",
            "password": "TestPass123!",
            "name": f"Macro Test User {timestamp}_{random_id}"
        }

        success, response = self.make_request('POST', 'auth/register', test_user)
        
        if not success or 'token' not in response:
            return False, f"Registration failed: {response}"
            
        self.token = response['token']
        self.user_data = response['user']
        
        # Set specific targets
        profile_data = {
            "targets": {
                "calories": calories,
                "protein": protein,
                "carbs": int(calories * 0.45 / 4),  # 45% carbs
                "fat": int(calories * 0.25 / 9)    # 25% fat
            },
            "preferences": preferences,
            "prep_level": 3
        }

        success, response = self.make_request('PUT', 'user/profile', profile_data)
        
        if success and response.get('onboarding_complete') == True:
            self.user_data = response
            return True, "User setup successful"
        else:
            return False, f"Profile update failed: {response}"

    def test_high_protein_targeting(self):
        """Test that high protein targets are met with vegan+GF constraints"""
        # Setup user with high protein target
        success, details = self.setup_user_with_targets(1800, 120, ["vegan", "gluten-free"])
        
        if not success:
            self.log_test("High protein targeting setup", False, details)
            return False
            
        # Seed recipes
        self.make_request('POST', 'seed-recipes')
        
        # Generate meal plan
        success, meal_plan = self.make_request('POST', 'meal-plan/generate', {})
        
        if not success:
            self.log_test("High protein targeting", False, f"Meal plan generation failed: {meal_plan}")
            return False
            
        # Analyze protein distribution across days
        protein_results = []
        target_protein = 120
        tolerance = 10.0
        
        for day in meal_plan.get('days', []):
            totals = day.get('totals', {})
            day_protein = totals.get('protein', 0)
            protein_diff_pct = abs(day_protein - target_protein) / target_protein * 100
            
            protein_results.append({
                'day': day.get('day'),
                'protein': day_protein,
                'target': target_protein,
                'diff_pct': round(protein_diff_pct, 1),
                'within_tolerance': protein_diff_pct <= tolerance
            })
        
        # Check if majority of days meet protein target
        days_on_target = sum(1 for r in protein_results if r['within_tolerance'])
        total_days = len(protein_results)
        
        if days_on_target >= total_days * 0.8:  # 80% of days should be on target
            self.log_test("High protein targeting", True, 
                         f"{days_on_target}/{total_days} days within tolerance")
            return True
        else:
            details = f"Only {days_on_target}/{total_days} days within tolerance. Results: {json.dumps(protein_results, indent=2)}"
            self.log_test("High protein targeting", False, details)
            return False

    def test_low_protein_targeting(self):
        """Test that lower protein targets are also met accurately"""
        # Setup user with moderate protein target
        success, details = self.setup_user_with_targets(2000, 80, ["vegan", "gluten-free"])
        
        if not success:
            self.log_test("Low protein targeting setup", False, details)
            return False
            
        # Generate meal plan
        success, meal_plan = self.make_request('POST', 'meal-plan/generate', {})
        
        if not success:
            self.log_test("Low protein targeting", False, f"Meal plan generation failed: {meal_plan}")
            return False
            
        # Check protein accuracy
        target_protein = 80
        tolerance = 10.0
        days_on_target = 0
        
        for day in meal_plan.get('days', []):
            totals = day.get('totals', {})
            day_protein = totals.get('protein', 0)
            protein_diff_pct = abs(day_protein - target_protein) / target_protein * 100
            
            if protein_diff_pct <= tolerance:
                days_on_target += 1
        
        total_days = len(meal_plan.get('days', []))
        
        if days_on_target >= total_days * 0.8:
            self.log_test("Low protein targeting", True, 
                         f"{days_on_target}/{total_days} days within tolerance")
            return True
        else:
            self.log_test("Low protein targeting", False, 
                         f"Only {days_on_target}/{total_days} days within tolerance")
            return False

    def test_calorie_accuracy(self):
        """Test that calorie targets are met within tolerance"""
        # Setup user with specific calorie target
        success, details = self.setup_user_with_targets(1600, 100, ["vegan", "gluten-free"])
        
        if not success:
            self.log_test("Calorie accuracy setup", False, details)
            return False
            
        # Generate meal plan
        success, meal_plan = self.make_request('POST', 'meal-plan/generate', {})
        
        if not success:
            self.log_test("Calorie accuracy", False, f"Meal plan generation failed: {meal_plan}")
            return False
            
        # Check calorie accuracy
        target_calories = 1600
        tolerance = 10.0
        days_on_target = 0
        calorie_results = []
        
        for day in meal_plan.get('days', []):
            totals = day.get('totals', {})
            day_calories = totals.get('calories', 0)
            calorie_diff_pct = abs(day_calories - target_calories) / target_calories * 100
            
            calorie_results.append({
                'day': day.get('day'),
                'calories': day_calories,
                'target': target_calories,
                'diff_pct': round(calorie_diff_pct, 1)
            })
            
            if calorie_diff_pct <= tolerance:
                days_on_target += 1
        
        total_days = len(meal_plan.get('days', []))
        
        if days_on_target >= total_days * 0.8:
            self.log_test("Calorie accuracy", True, 
                         f"{days_on_target}/{total_days} days within tolerance")
            return True
        else:
            details = f"Only {days_on_target}/{total_days} days within tolerance. Results: {json.dumps(calorie_results, indent=2)}"
            self.log_test("Calorie accuracy", False, details)
            return False

    def test_edge_case_no_fallback(self):
        """Test that system doesn't fall back to non-compliant recipes"""
        # Setup user with very restrictive preferences
        success, details = self.setup_user_with_targets(2200, 150, ["vegan", "gluten-free", "nut-free"])
        
        if not success:
            self.log_test("Edge case setup", False, details)
            return False
            
        # Try to generate meal plan
        success, meal_plan = self.make_request('POST', 'meal-plan/generate', {})
        
        if success:
            # If successful, verify all recipes are compliant
            all_compliant = True
            required_tags = ["vegan", "gluten-free", "nut-free"]
            
            for day in meal_plan.get('days', []):
                for meal in day.get('meals', []):
                    recipe_id = meal.get('recipe_id')
                    recipe_success, recipe_data = self.make_request('GET', f'recipes/{recipe_id}')
                    
                    if recipe_success:
                        tags = recipe_data.get('tags', [])
                        for required_tag in required_tags:
                            if required_tag not in tags:
                                all_compliant = False
                                break
                        if not all_compliant:
                            break
                if not all_compliant:
                    break
            
            if all_compliant:
                self.log_test("No fallback to non-compliant recipes", True)
                return True
            else:
                self.log_test("No fallback to non-compliant recipes", False, 
                             "Found non-compliant recipes in meal plan")
                return False
        else:
            # If it fails, that's actually expected behavior (no fallback)
            if "No alternative" in str(meal_plan) or "No recipes found" in str(meal_plan):
                self.log_test("No fallback to non-compliant recipes", True, 
                             "System correctly refused to use non-compliant recipes")
                return True
            else:
                self.log_test("No fallback to non-compliant recipes", False, 
                             f"Unexpected error: {meal_plan}")
                return False

    def run_macro_targeting_tests(self):
        """Run all macro targeting tests"""
        print("🎯 Starting BalancedPrep Macro Targeting Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("🔬 Focus: Protein optimization & macro accuracy")
        print("=" * 60)

        # Test sequence
        tests = [
            self.test_high_protein_targeting,
            self.test_low_protein_targeting,
            self.test_calorie_accuracy,
            self.test_edge_case_no_fallback,
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(test.__name__, False, f"Exception: {str(e)}")

        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All macro targeting tests passed!")
            return 0
        else:
            print("❌ Some macro targeting tests failed!")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['details']}")
            return 1

def main():
    """Main test runner"""
    tester = MacroTargetingTester()
    return tester.run_macro_targeting_tests()

if __name__ == "__main__":
    sys.exit(main())