"""
Backend API tests for the new 6-step onboarding flow.
Testing: /api/recipes/pool-count endpoint, allergens in user profile, auto_regenerate settings
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecipePoolCount:
    """Tests for /api/recipes/pool-count endpoint - Step 2 of onboarding"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register a test user and get auth token"""
        timestamp = int(time.time())
        email = f"test_pool_{timestamp}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "name": "Pool Count Tester"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
    
    def test_pool_count_no_filters(self, auth_token):
        """Test pool count returns all recipes when no preferences/allergens"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/pool-count",
            json={"preferences": [], "allergens": []},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "available_count" in data
        assert "total_count" in data
        assert "percentage" in data
        
        # With no filters, all recipes should be available
        assert data["available_count"] == data["total_count"]
        assert data["percentage"] == 100
        print(f"Total recipes: {data['total_count']}")
    
    def test_pool_count_with_vegan_preference(self, auth_token):
        """Test pool count filters by dietary preference (vegan)"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/pool-count",
            json={"preferences": ["vegan"], "allergens": []},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Vegan filter should reduce available count
        assert data["available_count"] <= data["total_count"]
        assert data["available_count"] > 0, "Should have at least some vegan recipes"
        print(f"Vegan recipes: {data['available_count']} out of {data['total_count']} ({data['percentage']}%)")
    
    def test_pool_count_with_allergen_nuts(self, auth_token):
        """Test pool count excludes recipes with nut allergen"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/pool-count",
            json={"preferences": [], "allergens": ["nuts"]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Nut allergen should reduce available count
        assert data["available_count"] <= data["total_count"]
        print(f"Nut-free recipes: {data['available_count']} out of {data['total_count']} ({data['percentage']}%)")
    
    def test_pool_count_with_multiple_allergens(self, auth_token):
        """Test pool count with multiple allergens (dairy + gluten)"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/pool-count",
            json={"preferences": [], "allergens": ["dairy", "gluten"]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Multiple allergens should further reduce count
        assert data["available_count"] <= data["total_count"]
        print(f"Dairy+Gluten free recipes: {data['available_count']} out of {data['total_count']} ({data['percentage']}%)")
    
    def test_pool_count_combined_preference_and_allergen(self, auth_token):
        """Test pool count with both preferences and allergens"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/pool-count",
            json={"preferences": ["vegetarian"], "allergens": ["eggs"]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["available_count"] <= data["total_count"]
        print(f"Vegetarian + Egg-free: {data['available_count']} out of {data['total_count']} ({data['percentage']}%)")


class TestUserProfileAllergens:
    """Tests for allergens field in user profile - Step 2 of onboarding"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Register a test user and get auth token + user data"""
        timestamp = int(time.time())
        email = f"test_allergen_{timestamp}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "name": "Allergen Tester"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()
    
    def test_default_allergens_empty(self, auth_data):
        """Test that new user has empty allergens list"""
        token = auth_data["token"]
        user = auth_data["user"]
        
        # Check user has allergens field
        assert "allergens" in user
        assert user["allergens"] == []
    
    def test_update_profile_with_allergens(self, auth_data):
        """Test updating profile with allergens list"""
        token = auth_data["token"]
        
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {"calories": 2000, "protein": 150, "carbs": 200, "fat": 65},
                "preferences": ["vegetarian"],
                "allergens": ["nuts", "shellfish"],
                "prep_level": 3,
                "auto_regenerate": False,
                "regenerate_day": None
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify allergens were saved
        assert "allergens" in data
        assert "nuts" in data["allergens"]
        assert "shellfish" in data["allergens"]
        assert len(data["allergens"]) == 2
        print(f"Allergens saved: {data['allergens']}")
    
    def test_get_profile_returns_allergens(self, auth_data):
        """Test that GET profile returns saved allergens"""
        token = auth_data["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify allergens persisted
        assert "allergens" in data
        assert "nuts" in data["allergens"]
        assert "shellfish" in data["allergens"]


class TestWeeklyAutomation:
    """Tests for auto_regenerate and regenerate_day fields - Step 4 of onboarding"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register a test user and get auth token"""
        timestamp = int(time.time())
        email = f"test_auto_{timestamp}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "name": "Automation Tester"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
    
    def test_default_auto_regenerate_false(self, auth_token):
        """Test that new user has auto_regenerate=false by default"""
        response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "auto_regenerate" in data
        assert data["auto_regenerate"] == False
        assert "regenerate_day" in data
        assert data["regenerate_day"] is None
    
    def test_update_auto_regenerate_enabled(self, auth_token):
        """Test enabling auto_regenerate with a specific day"""
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {"calories": 2000, "protein": 150, "carbs": None, "fat": None},
                "preferences": [],
                "allergens": [],
                "prep_level": 3,
                "auto_regenerate": True,
                "regenerate_day": "sunday"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["auto_regenerate"] == True
        assert data["regenerate_day"] == "sunday"
        print(f"Auto-regenerate enabled for: {data['regenerate_day']}")
    
    def test_update_auto_regenerate_disabled(self, auth_token):
        """Test disabling auto_regenerate"""
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {"calories": 2000, "protein": 150, "carbs": None, "fat": None},
                "preferences": [],
                "allergens": [],
                "prep_level": 3,
                "auto_regenerate": False,
                "regenerate_day": None
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["auto_regenerate"] == False
        # regenerate_day can remain set or be null
        print(f"Auto-regenerate disabled")


class TestPrepLevelMapping:
    """Tests for prep_level mapping from efficiency slider - Step 3 of onboarding"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register a test user and get auth token"""
        timestamp = int(time.time())
        email = f"test_prep_{timestamp}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "name": "PrepLevel Tester"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
    
    def test_prep_level_batch_mode(self, auth_token):
        """Test prep_level=1 (Batch Mode from efficiency=1)"""
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {"calories": 2000, "protein": 150, "carbs": None, "fat": None},
                "preferences": [],
                "allergens": [],
                "prep_level": 1,  # Maps to efficiency slider position 1
                "auto_regenerate": False,
                "regenerate_day": None
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["prep_level"] == 1
        print(f"Prep level set to: {data['prep_level']} (Batch Mode)")
    
    def test_prep_level_balanced(self, auth_token):
        """Test prep_level=3 (Balanced from efficiency=2)"""
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {"calories": 2000, "protein": 150, "carbs": None, "fat": None},
                "preferences": [],
                "allergens": [],
                "prep_level": 3,  # Maps to efficiency slider position 2
                "auto_regenerate": False,
                "regenerate_day": None
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["prep_level"] == 3
        print(f"Prep level set to: {data['prep_level']} (Balanced)")
    
    def test_prep_level_variety(self, auth_token):
        """Test prep_level=5 (High Variety from efficiency=3)"""
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {"calories": 2000, "protein": 150, "carbs": None, "fat": None},
                "preferences": [],
                "allergens": [],
                "prep_level": 5,  # Maps to efficiency slider position 3
                "auto_regenerate": False,
                "regenerate_day": None
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["prep_level"] == 5
        print(f"Prep level set to: {data['prep_level']} (High Variety)")


class TestOnboardingComplete:
    """Test the full onboarding flow saves all fields correctly"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register a test user and get auth token"""
        timestamp = int(time.time())
        email = f"test_onboard_{timestamp}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "name": "Full Onboarding Tester"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
    
    def test_full_onboarding_profile_update(self, auth_token):
        """Test updating profile with all onboarding fields"""
        response = requests.put(
            f"{BASE_URL}/api/user/profile",
            json={
                "targets": {
                    "calories": 2200,
                    "protein": 175,
                    "carbs": 250,
                    "fat": 70
                },
                "preferences": ["vegetarian", "gluten-free"],
                "allergens": ["nuts", "soy", "shellfish"],
                "prep_level": 3,  # Balanced
                "auto_regenerate": True,
                "regenerate_day": "monday"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all fields saved correctly
        assert data["targets"]["calories"] == 2200
        assert data["targets"]["protein"] == 175
        assert data["targets"]["carbs"] == 250
        assert data["targets"]["fat"] == 70
        assert "vegetarian" in data["preferences"]
        assert "gluten-free" in data["preferences"]
        assert "nuts" in data["allergens"]
        assert "soy" in data["allergens"]
        assert "shellfish" in data["allergens"]
        assert data["prep_level"] == 3
        assert data["auto_regenerate"] == True
        assert data["regenerate_day"] == "monday"
        assert data["onboarding_complete"] == True
        
        print("Full onboarding profile verified successfully")
    
    def test_meal_plan_generation_after_onboarding(self, auth_token):
        """Test that meal plan can be generated after onboarding"""
        response = requests.post(
            f"{BASE_URL}/api/meal-plan/generate",
            json={},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify meal plan structure
        assert "days" in data
        assert len(data["days"]) == 7  # 7 days
        assert "unique_meals_count" in data
        
        print(f"Meal plan generated with {data['unique_meals_count']} unique meals")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
