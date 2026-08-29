#!/usr/bin/env python3
"""
Backend API Test Suite for CKC Fleet Management
Tests all endpoints required for PDF report generation
"""

import requests
import json
import sys
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://vehicle-ops-71.preview.emergentagent.com/api"
FALLBACK_URL = "http://localhost:3000/api"

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def log_success(message: str):
    print(f"{GREEN}✓ {message}{RESET}")

def log_error(message: str):
    print(f"{RED}✗ {message}{RESET}")

def log_info(message: str):
    print(f"{YELLOW}ℹ {message}{RESET}")

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user = None
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }

    def test_login(self) -> bool:
        """Test POST /api/auth/login"""
        print("\n" + "="*60)
        print("TEST 1: POST /api/auth/login")
        print("="*60)
        
        try:
            url = f"{self.base_url}/auth/login"
            payload = {
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD
            }
            
            log_info(f"Sending POST request to {url}")
            log_info(f"Payload: {json.dumps(payload)}")
            
            response = requests.post(url, json=payload, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log_info(f"Response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                if "token" in data and "user" in data:
                    self.token = data["token"]
                    self.user = data["user"]
                    
                    if data["user"].get("role") == "admin":
                        log_success("Login successful - token and user object received")
                        log_success(f"User role: {data['user']['role']}")
                        self.test_results["passed"] += 1
                        return True
                    else:
                        log_error(f"Expected role='admin', got role='{data['user'].get('role')}'")
                        self.test_results["failed"] += 1
                        self.test_results["errors"].append("Login: Invalid user role")
                        return False
                else:
                    log_error("Response missing 'token' or 'user' field")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append("Login: Invalid response structure")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                log_error(f"Response: {response.text}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Login: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during login test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Login: {str(e)}")
            return False

    def test_dashboard(self) -> bool:
        """Test GET /api/dashboard"""
        print("\n" + "="*60)
        print("TEST 2: GET /api/dashboard")
        print("="*60)
        
        try:
            url = f"{self.base_url}/dashboard"
            log_info(f"Sending GET request to {url}")
            
            response = requests.get(url, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log_info(f"Response keys: {list(data.keys())}")
                
                # Validate required fields
                required_fields = ["fleet", "today", "month", "daily", "perVehicle", "alerts"]
                missing_fields = [f for f in required_fields if f not in data]
                
                if not missing_fields:
                    log_success("Dashboard endpoint returned all required fields")
                    log_info(f"Fleet total: {data['fleet'].get('total', 'N/A')}")
                    log_info(f"Today trips: {data['today'].get('trips', 'N/A')}")
                    log_info(f"Month km: {data['month'].get('km', 'N/A')}")
                    self.test_results["passed"] += 1
                    return True
                else:
                    log_error(f"Missing required fields: {missing_fields}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append(f"Dashboard: Missing fields {missing_fields}")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                log_error(f"Response: {response.text}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Dashboard: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during dashboard test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Dashboard: {str(e)}")
            return False

    def test_trips(self) -> bool:
        """Test GET /api/trips"""
        print("\n" + "="*60)
        print("TEST 3: GET /api/trips")
        print("="*60)
        
        try:
            url = f"{self.base_url}/trips"
            log_info(f"Sending GET request to {url}")
            
            response = requests.get(url, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    log_success(f"Trips endpoint returned array with {len(data)} trips")
                    
                    if len(data) > 0:
                        # Validate first trip has required fields
                        first_trip = data[0]
                        required_fields = ["tripId", "vehicleNumber", "dateOut", "kmRun"]
                        missing_fields = [f for f in required_fields if f not in first_trip]
                        
                        if not missing_fields:
                            log_success("Trip records contain required fields")
                            log_info(f"Sample trip: {first_trip.get('tripId')} - {first_trip.get('vehicleNumber')}")
                            self.test_results["passed"] += 1
                            return True
                        else:
                            log_error(f"Trip records missing fields: {missing_fields}")
                            self.test_results["failed"] += 1
                            self.test_results["errors"].append(f"Trips: Missing fields {missing_fields}")
                            return False
                    else:
                        log_error("No trip records found (expected seed data)")
                        self.test_results["failed"] += 1
                        self.test_results["errors"].append("Trips: No data returned")
                        return False
                else:
                    log_error(f"Expected array, got {type(data)}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append("Trips: Invalid response type")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                log_error(f"Response: {response.text}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Trips: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during trips test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Trips: {str(e)}")
            return False

    def test_fuel(self) -> bool:
        """Test GET /api/fuel"""
        print("\n" + "="*60)
        print("TEST 4: GET /api/fuel")
        print("="*60)
        
        try:
            url = f"{self.base_url}/fuel"
            log_info(f"Sending GET request to {url}")
            
            response = requests.get(url, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    log_success(f"Fuel endpoint returned array with {len(data)} entries")
                    
                    if len(data) > 0:
                        # Validate first entry has required fields
                        first_entry = data[0]
                        required_fields = ["vehicleNumber", "date", "quantity", "rate", "amount"]
                        missing_fields = [f for f in required_fields if f not in first_entry]
                        
                        if not missing_fields:
                            log_success("Fuel records contain required fields")
                            log_info(f"Sample fuel entry: {first_entry.get('vehicleNumber')} - {first_entry.get('quantity')}L")
                            self.test_results["passed"] += 1
                            return True
                        else:
                            log_error(f"Fuel records missing fields: {missing_fields}")
                            self.test_results["failed"] += 1
                            self.test_results["errors"].append(f"Fuel: Missing fields {missing_fields}")
                            return False
                    else:
                        log_error("No fuel records found (expected seed data)")
                        self.test_results["failed"] += 1
                        self.test_results["errors"].append("Fuel: No data returned")
                        return False
                else:
                    log_error(f"Expected array, got {type(data)}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append("Fuel: Invalid response type")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                log_error(f"Response: {response.text}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Fuel: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during fuel test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Fuel: {str(e)}")
            return False

    def test_vehicles(self) -> bool:
        """Test GET /api/vehicles"""
        print("\n" + "="*60)
        print("TEST 5: GET /api/vehicles")
        print("="*60)
        
        try:
            url = f"{self.base_url}/vehicles"
            log_info(f"Sending GET request to {url}")
            
            response = requests.get(url, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    log_success(f"Vehicles endpoint returned array with {len(data)} vehicles")
                    
                    # Check for expected 10 seeded vehicles
                    if len(data) >= 10:
                        # Check for specific vehicle numbers
                        vehicle_numbers = [v.get("vehicleNumber") for v in data]
                        expected_vehicles = [f"KA01AB{1234 + i}" for i in range(10)]
                        
                        found_vehicles = [v for v in expected_vehicles if v in vehicle_numbers]
                        
                        if len(found_vehicles) >= 10:
                            log_success(f"Found all 10 expected seeded vehicles (KA01AB1234-KA01AB1243)")
                            log_info(f"Sample vehicles: {', '.join(vehicle_numbers[:3])}")
                            self.test_results["passed"] += 1
                            return True
                        else:
                            log_error(f"Expected 10 seeded vehicles, found only {len(found_vehicles)}")
                            self.test_results["failed"] += 1
                            self.test_results["errors"].append("Vehicles: Missing expected seed data")
                            return False
                    else:
                        log_error(f"Expected at least 10 vehicles, got {len(data)}")
                        self.test_results["failed"] += 1
                        self.test_results["errors"].append("Vehicles: Insufficient data")
                        return False
                else:
                    log_error(f"Expected array, got {type(data)}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append("Vehicles: Invalid response type")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                log_error(f"Response: {response.text}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Vehicles: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during vehicles test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Vehicles: {str(e)}")
            return False

    def test_maintenance(self) -> bool:
        """Test GET /api/maintenance"""
        print("\n" + "="*60)
        print("TEST 6: GET /api/maintenance")
        print("="*60)
        
        try:
            url = f"{self.base_url}/maintenance"
            log_info(f"Sending GET request to {url}")
            
            response = requests.get(url, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    log_success(f"Maintenance endpoint returned array with {len(data)} entries")
                    log_info("Note: Maintenance may be empty as it's a new feature")
                    self.test_results["passed"] += 1
                    return True
                else:
                    log_error(f"Expected array, got {type(data)}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append("Maintenance: Invalid response type")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                log_error(f"Response: {response.text}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Maintenance: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during maintenance test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Maintenance: {str(e)}")
            return False

    def test_logo_image(self) -> bool:
        """Test GET /ckc-logo-pdf.png"""
        print("\n" + "="*60)
        print("TEST 7: GET /ckc-logo-pdf.png")
        print("="*60)
        
        try:
            # Logo is served from root, not /api
            url = self.base_url.replace("/api", "") + "/ckc-logo-pdf.png"
            log_info(f"Sending GET request to {url}")
            
            response = requests.get(url, timeout=10)
            
            log_info(f"Status Code: {response.status_code}")
            log_info(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
            
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                
                if 'image/png' in content_type or 'image' in content_type:
                    log_success("Logo image is accessible with correct content type")
                    log_info(f"Image size: {len(response.content)} bytes")
                    self.test_results["passed"] += 1
                    return True
                else:
                    log_error(f"Expected image/png content type, got {content_type}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append("Logo: Invalid content type")
                    return False
            else:
                log_error(f"Expected status 200, got {response.status_code}")
                self.test_results["failed"] += 1
                self.test_results["errors"].append(f"Logo: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Exception during logo test: {str(e)}")
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"Logo: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("\n" + "="*60)
        print("CKC FLEET MANAGEMENT - BACKEND API TEST SUITE")
        print("Testing endpoints required for PDF report generation")
        print("="*60)
        
        # Test 1: Login
        self.test_login()
        
        # Test 2-6: Data endpoints
        self.test_dashboard()
        self.test_trips()
        self.test_fuel()
        self.test_vehicles()
        self.test_maintenance()
        
        # Test 7: Logo image
        self.test_logo_image()
        
        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.test_results['passed'] + self.test_results['failed']}")
        print(f"{GREEN}Passed: {self.test_results['passed']}{RESET}")
        print(f"{RED}Failed: {self.test_results['failed']}{RESET}")
        
        if self.test_results["errors"]:
            print(f"\n{RED}ERRORS:{RESET}")
            for error in self.test_results["errors"]:
                print(f"  - {error}")
        
        print("="*60)
        
        return self.test_results["failed"] == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
