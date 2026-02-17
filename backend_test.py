#!/usr/bin/env python3
"""
BalancedPrep Backend API Testing Suite
Tests all backend functionality including auth, meal planning, recipes, and grocery lists.
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class BalancedPrepAPITester:
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
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
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

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.make_request('GET', '')
        expected_message = "BalancedPrep API"
        
        if success and response.get('message') == expected_message:
            self.log_test("Root endpoint", True)
            return True
        else:
            self.log_test("Root endpoint", False, f"Expected message '{expected_message}', got: {response}")
            return False

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_user = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }

        success, response = self.make_request('POST', 'auth/register', test_user)
        
        if success and 'token' in response and 'user' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.log_test("User registration", True)
            return True
        else:
            self.log_test("User registration", False, f"Response: {response}")
            return False

    def test_user_login(self):
        """Test user login with registered credentials"""
        if not self.user_data:
            self.log_test("User login", False, "No user data from registration")
            return False

        login_data = {
            "email": self.user_data['email'],
            "password": "TestPass123!"
        }

        success, response = self.make_request('POST', 'auth/login', login_data)
        
        if success and 'token' in response:
            self.token = response['token']  # Update token
            self.log_test("User login", True)
            return True
        else:
            self.log_test("User login", False, f"Response: {response}")
            return False

    def test_get_profile(self):
        """Test getting user profile"""
        success, response = self.make_request('GET', 'user/profile')
        
        if success and 'email' in response:
            self.log_test("Get user profile", True)
            return True
        else:
            self.log_test("Get user profile", False, f"Response: {response}")
            return False

    def test_update_profile(self):
        """Test updating user profile with nutrition targets"""
        profile_data = {
            "targets": {
                "calories": 2000,
                "protein": 150,
                "carbs": 250,
                "fat": 65
            },
            "preferences": ["vegetarian", "gluten-free"],
            "prep_level": 3
        }

        success, response = self.make_request('PUT', 'user/profile', profile_data)
        
        if success and response.get('onboarding_complete') == True:
            self.user_data = response  # Update user data
            self.log_test("Update user profile", True)
            return True
        else:
            self.log_test("Update user profile", False, f"Response: {response}")
            return False

    def test_seed_recipes(self):
        """Test seeding recipes"""
        success, response = self.make_request('POST', 'seed-recipes')
        
        if success:
            self.log_test("Seed recipes", True)
            return True
        else:
            self.log_test("Seed recipes", False, f"Response: {response}")
            return False

    def test_get_recipes(self):
        """Test getting recipes"""
        success, response = self.make_request('GET', 'recipes')
        
        if success and isinstance(response, list) and len(response) > 0:
            self.log_test("Get recipes", True)
            return True
        else:
            self.log_test("Get recipes", False, f"Expected list of recipes, got: {response}")
            return False

    def test_create_recipe(self):
        """Test creating a custom recipe"""
        recipe_data = {
            "name": "Test Protein Smoothie",
            "description": "A test recipe for protein smoothie",
            "meal_type": "snack",
            "calories": 300,
            "protein": 25,
            "carbs": 30,
            "fat": 8,
            "ingredients": [
                {"name": "Protein Powder", "quantity": 1, "unit": "scoop", "category": "Pantry"},
                {"name": "Banana", "quantity": 1, "unit": "whole", "category": "Produce"},
                {"name": "Almond Milk", "quantity": 1, "unit": "cup", "category": "Dairy"}
            ],
            "instructions": ["Add all ingredients to blender", "Blend until smooth", "Serve immediately"],
            "prep_time": 5,
            "cook_time": 0,
            "servings": 1,
            "tags": ["vegetarian", "gluten-free"]
        }

        success, response = self.make_request('POST', 'recipes', recipe_data, 200)
        
        if success and 'id' in response:
            self.log_test("Create recipe", True)
            return True
        else:
            self.log_test("Create recipe", False, f"Response: {response}")
            return False

    def test_generate_meal_plan(self):
        """Test generating meal plan"""
        success, response = self.make_request('POST', 'meal-plan/generate', {})
        
        if success and 'days' in response and len(response['days']) == 7:
            self.log_test("Generate meal plan", True)
            return True
        else:
            self.log_test("Generate meal plan", False, f"Response: {response}")
            return False

    def test_get_meal_plan(self):
        """Test getting existing meal plan"""
        success, response = self.make_request('GET', 'meal-plan')
        
        if success and 'days' in response:
            self.log_test("Get meal plan", True)
            return True
        else:
            self.log_test("Get meal plan", False, f"Response: {response}")
            return False

    def test_swap_meal(self):
        """Test swapping a meal in the plan"""
        swap_data = {
            "day_index": 0,
            "meal_index": 0
        }

        success, response = self.make_request('PUT', 'meal-plan/swap-meal', swap_data)
        
        if success and 'days' in response:
            self.log_test("Swap meal", True)
            return True
        else:
            self.log_test("Swap meal", False, f"Response: {response}")
            return False

    def test_regenerate_day(self):
        """Test regenerating a day in the meal plan"""
        regen_data = {
            "day_index": 1
        }

        success, response = self.make_request('PUT', 'meal-plan/regenerate-day', regen_data)
        
        if success and 'days' in response:
            self.log_test("Regenerate day", True)
            return True
        else:
            self.log_test("Regenerate day", False, f"Response: {response}")
            return False

    def test_get_grocery_list(self):
        """Test getting grocery list"""
        success, response = self.make_request('GET', 'grocery-list')
        
        if success and 'items' in response:
            self.log_test("Get grocery list", True)
            return True
        else:
            self.log_test("Get grocery list", False, f"Response: {response}")
            return False

    def test_toggle_grocery_item(self):
        """Test toggling grocery list item"""
        # First get the grocery list to find an item
        success, grocery_response = self.make_request('GET', 'grocery-list')
        
        if not success or not grocery_response.get('items'):
            self.log_test("Toggle grocery item", False, "No grocery list items found")
            return False

        item_id = grocery_response['items'][0]['id']
        toggle_data = {"item_id": item_id}

        success, response = self.make_request('PUT', 'grocery-list/toggle', toggle_data)
        
        if success and 'items' in response:
            self.log_test("Toggle grocery item", True)
            return True
        else:
            self.log_test("Toggle grocery item", False, f"Response: {response}")
            return False

    def test_invalid_auth(self):
        """Test API with invalid authentication"""
        old_token = self.token
        self.token = "invalid_token"
        
        success, response = self.make_request('GET', 'user/profile', expected_status=401)
        
        self.token = old_token  # Restore valid token
        
        if success:  # Success means we got the expected 401
            self.log_test("Invalid auth handling", True)
            return True
        else:
            self.log_test("Invalid auth handling", False, f"Expected 401, got: {response}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting BalancedPrep Backend API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)

        # Test sequence
        tests = [
            self.test_root_endpoint,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_profile,
            self.test_update_profile,
            self.test_seed_recipes,
            self.test_get_recipes,
            self.test_create_recipe,
            self.test_generate_meal_plan,
            self.test_get_meal_plan,
            self.test_swap_meal,
            self.test_regenerate_day,
            self.test_get_grocery_list,
            self.test_toggle_grocery_item,
            self.test_invalid_auth,
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
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['details']}")
            return 1

def main():
    """Main test runner"""
    tester = BalancedPrepAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())