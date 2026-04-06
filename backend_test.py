#!/usr/bin/env python3
"""
Backend API Testing for T.P Social Media Platform
Tests all API endpoints for authentication, posts, users, messages, AI, and stories
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class TPAPITester:
    def __init__(self, base_url: str = "https://wsgi-deploy-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.username = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"test": test_name, "details": details})

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, use_auth: bool = True) -> tuple[bool, Dict]:
        """Make API request and validate response"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {}
        if use_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
            
            return success, response_data
        except Exception as e:
            return False, {"error": str(e)}

    def test_auth_register(self):
        """Test user registration"""
        test_user = f"testuser_{datetime.now().strftime('%H%M%S')}"
        data = {
            "username": test_user,
            "email": f"{test_user}@test.com",
            "password": "testpass123",
            "display_name": f"Test User {test_user}"
        }
        
        success, response = self.make_request('POST', '/auth/register', data, 200, use_auth=False)
        if success and 'token' in response and 'user' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.username = response['user']['username']
            self.log_result("User Registration", True, f"Created user: {test_user}")
            return True
        else:
            self.log_result("User Registration", False, f"Response: {response}")
            return False

    def test_auth_login_existing(self):
        """Test login with existing demo user"""
        data = {"identifier": "alice", "password": "password123"}
        success, response = self.make_request('POST', '/auth/login', data, 200, use_auth=False)
        
        if success and 'token' in response:
            # Store demo user token for later tests
            self.demo_token = response['token']
            self.demo_user_id = response['user']['id']
            self.log_result("Login with Demo User", True, "alice login successful")
            return True
        else:
            self.log_result("Login with Demo User", False, f"Response: {response}")
            return False

    def test_auth_invalid_credentials(self):
        """Test login with invalid credentials"""
        data = {"identifier": "alice", "password": "wrongpassword"}
        success, response = self.make_request('POST', '/auth/login', data, 401, use_auth=False)
        
        if success:
            self.log_result("Invalid Credentials Test", True, "Correctly rejected invalid password")
            return True
        else:
            self.log_result("Invalid Credentials Test", False, f"Expected 401, got: {response}")
            return False

    def test_auth_duplicate_username(self):
        """Test registration with duplicate username"""
        data = {
            "username": "alice",  # Existing user
            "email": "newalice@test.com",
            "password": "testpass123"
        }
        success, response = self.make_request('POST', '/auth/register', data, 400, use_auth=False)
        
        if success:
            self.log_result("Duplicate Username Test", True, "Correctly rejected duplicate username")
            return True
        else:
            self.log_result("Duplicate Username Test", False, f"Expected 400, got: {response}")
            return False

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.make_request('GET', '/auth/me', expected_status=200)
        
        if success and 'username' in response:
            self.log_result("Get Current User", True, f"Retrieved user: {response.get('username')}")
            return True
        else:
            self.log_result("Get Current User", False, f"Response: {response}")
            return False

    def test_create_post(self):
        """Test creating a new post"""
        data = {
            "content": f"Test post created at {datetime.now().isoformat()}",
            "image": None
        }
        success, response = self.make_request('POST', '/posts', data, 200)
        
        if success and 'id' in response:
            self.test_post_id = response['id']
            self.log_result("Create Post", True, f"Created post ID: {response['id']}")
            return True
        else:
            self.log_result("Create Post", False, f"Response: {response}")
            return False

    def test_get_feed(self):
        """Test getting posts feed"""
        success, response = self.make_request('GET', '/posts/feed', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Get Feed", True, f"Retrieved {len(response)} posts")
            return True
        else:
            self.log_result("Get Feed", False, f"Response: {response}")
            return False

    def test_like_post(self):
        """Test liking a post"""
        if not hasattr(self, 'test_post_id'):
            self.log_result("Like Post", False, "No test post available")
            return False
            
        success, response = self.make_request('POST', f'/posts/{self.test_post_id}/like', expected_status=200)
        
        if success and 'liked' in response:
            self.log_result("Like Post", True, f"Like status: {response['liked']}")
            return True
        else:
            self.log_result("Like Post", False, f"Response: {response}")
            return False

    def test_add_comment(self):
        """Test adding a comment to a post"""
        if not hasattr(self, 'test_post_id'):
            self.log_result("Add Comment", False, "No test post available")
            return False
            
        data = {"content": "Test comment from API test"}
        success, response = self.make_request('POST', f'/posts/{self.test_post_id}/comment', data, 200)
        
        if success and 'id' in response:
            self.log_result("Add Comment", True, f"Added comment ID: {response['id']}")
            return True
        else:
            self.log_result("Add Comment", False, f"Response: {response}")
            return False

    def test_get_user_profile(self):
        """Test getting user profile"""
        success, response = self.make_request('GET', '/users/profile/alice', expected_status=200)
        
        if success and 'username' in response:
            self.log_result("Get User Profile", True, f"Retrieved profile for: {response['username']}")
            return True
        else:
            self.log_result("Get User Profile", False, f"Response: {response}")
            return False

    def test_search_users(self):
        """Test searching users"""
        success, response = self.make_request('GET', '/users/search?q=alice', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Search Users", True, f"Found {len(response)} users")
            return True
        else:
            self.log_result("Search Users", False, f"Response: {response}")
            return False

    def test_get_suggestions(self):
        """Test getting user suggestions"""
        success, response = self.make_request('GET', '/users/suggestions', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Get User Suggestions", True, f"Got {len(response)} suggestions")
            return True
        else:
            self.log_result("Get User Suggestions", False, f"Response: {response}")
            return False

    def test_follow_user(self):
        """Test following a user"""
        # Try to follow marcus (demo user)
        success, response = self.make_request('GET', '/users/profile/marcus', expected_status=200)
        if not success:
            self.log_result("Follow User", False, "Could not find marcus profile")
            return False
            
        marcus_id = response['id']
        success, response = self.make_request('POST', f'/users/{marcus_id}/follow', expected_status=200)
        
        if success and response.get('status') == 'followed':
            self.followed_user_id = marcus_id
            self.log_result("Follow User", True, "Successfully followed marcus")
            return True
        else:
            self.log_result("Follow User", False, f"Response: {response}")
            return False

    def test_unfollow_user(self):
        """Test unfollowing a user"""
        if not hasattr(self, 'followed_user_id'):
            self.log_result("Unfollow User", False, "No followed user available")
            return False
            
        success, response = self.make_request('POST', f'/users/{self.followed_user_id}/unfollow', expected_status=200)
        
        if success and response.get('status') == 'unfollowed':
            self.log_result("Unfollow User", True, "Successfully unfollowed user")
            return True
        else:
            self.log_result("Unfollow User", False, f"Response: {response}")
            return False

    def test_get_stories(self):
        """Test getting stories"""
        success, response = self.make_request('GET', '/stories', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Get Stories", True, f"Retrieved {len(response)} story groups")
            return True
        else:
            self.log_result("Get Stories", False, f"Response: {response}")
            return False

    def test_get_conversations(self):
        """Test getting message conversations"""
        success, response = self.make_request('GET', '/messages/conversations', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_result("Get Conversations", True, f"Retrieved {len(response)} conversations")
            return True
        else:
            self.log_result("Get Conversations", False, f"Response: {response}")
            return False

    def test_ai_chat(self):
        """Test AI chat functionality"""
        data = {"message": "Hello, this is a test message"}
        success, response = self.make_request('POST', '/ai/chat', data, 200)
        
        if success and 'response' in response:
            self.log_result("AI Chat", True, f"AI responded: {response['response'][:50]}...")
            return True
        else:
            self.log_result("AI Chat", False, f"Response: {response}")
            return False

    def test_update_profile(self):
        """Test updating user profile"""
        data = {
            "display_name": "Updated Test User",
            "bio": "This is a test bio from API testing"
        }
        success, response = self.make_request('PUT', '/users/profile', data, 200)
        
        if success and 'display_name' in response:
            self.log_result("Update Profile", True, f"Updated profile: {response['display_name']}")
            return True
        else:
            self.log_result("Update Profile", False, f"Response: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting T.P Backend API Tests")
        print("=" * 50)
        
        # Authentication Tests
        print("\n📝 Authentication Tests")
        self.test_auth_register()
        self.test_auth_login_existing()
        self.test_auth_invalid_credentials()
        self.test_auth_duplicate_username()
        self.test_auth_me()
        
        # Posts Tests
        print("\n📄 Posts Tests")
        self.test_create_post()
        self.test_get_feed()
        self.test_like_post()
        self.test_add_comment()
        
        # Users Tests
        print("\n👥 Users Tests")
        self.test_get_user_profile()
        self.test_search_users()
        self.test_get_suggestions()
        self.test_follow_user()
        self.test_unfollow_user()
        self.test_update_profile()
        
        # Stories Tests
        print("\n📸 Stories Tests")
        self.test_get_stories()
        
        # Messages Tests
        print("\n💬 Messages Tests")
        self.test_get_conversations()
        
        # AI Tests
        print("\n🤖 AI Tests")
        self.test_ai_chat()
        
        # Print Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = TPAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())