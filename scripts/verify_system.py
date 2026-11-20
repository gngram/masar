#!/usr/bin/env python
"""End-to-End System Verification for Masar Django & InvenTree Architecture."""
import os
import sys
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Setup Django test client
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'masar_backend.settings')
import django
django.setup()

from django.test import Client

def run_verification():
    c = Client()
    print("==================================================")
    print(" RUNNING MASAR E2E VERIFICATION SUITE")
    print("==================================================")

    endpoints = [
        # Health
        ('/healthz', 200, "Health probe"),

        # Frontend HTML Pages
        ('/', 200, "Main Hub (index.html)"),
        ('/dashboard', 200, "Dashboard Page"),
        ('/parts', 200, "InvenTree Parts & BoM Explorer"),
        ('/stock', 200, "Cleanroom Stock Page"),
        ('/production', 200, "Production Traceability Page"),
        ('/procurement', 200, "Procurement Page"),
        ('/settings', 200, "Settings & Customization Page"),
        ('/pipeline', 200, "Pipeline Traceability Page"),
        ('/stage', 200, "Stage Team Governance Page"),
        ('/assembly', 200, "Assembly Flow Page"),
        ('/build', 200, "Build & Sub-Assemblies Explorer Page"),
        ('/build.html', 200, "Build Static HTML Page"),

        # Core Card Endpoints
        ('/api/v1/cards/dashboard', 200, "Dashboard Card API"),
        ('/api/v1/cards/production-status', 200, "Production Status Card API"),
        ('/api/v1/cards/stock', 200, "Stock Card API"),
        ('/api/v1/cards/procurement', 200, "Procurement Card API"),
        ('/api/v1/cards/settings', 200, "Settings Card API"),

        # InvenTree Parts & Categories
        ('/api/v1/parts', 200, "Parts Catalog List API"),
        ('/api/v1/parts/categories', 200, "Part Categories Tree API"),

        # Stock Locations & Items
        ('/api/v1/stock/items', 200, "Stock Items List API"),
        ('/api/v1/stock/locations', 200, "Stock Locations Tree API"),

        # Hardware Units & Pairing
        ('/api/v1/production/units', 200, "Production Traceability Units API"),

        # Procurement Orders & Suppliers
        ('/api/v1/procurement/orders', 200, "Procurement Orders API"),
        ('/api/v1/procurement/suppliers', 200, "Suppliers List API"),

        # Customization Presets (Save & Load)
        ('/api/v1/customization/presets', 200, "Customization Presets List API"),
        ('/api/v1/customization/export', 200, "Export Customization API"),
    ]

    passed = 0
    failed = 0

    for path, expected_status, name in endpoints:
        res = c.get(path, HTTP_X_BYPASS_TOKEN='masar-dev-bypass-secret-token-2026')
        if res.status_code == expected_status:
            print(f"[PASS] {name} ({path}) -> HTTP {res.status_code}")
            passed += 1
        else:
            print(f"[FAIL] {name} ({path}) -> Got HTTP {res.status_code}, expected {expected_status}")
            failed += 1

    # Test Unified Login with Admin
    print("\n--- Testing Authentication ---")
    login_res = c.post('/api/v1/identity/login', {
        'email': 'ganga.ram@tii.ae',
        'password': 'WrongPassword'
    }, content_type='application/json')
    if login_res.status_code == 401:
        print("[PASS] Login rejected invalid credentials as expected (HTTP 401)")
        passed += 1
    else:
        print(f"[FAIL] Login expected 401, got {login_res.status_code}")
        failed += 1

    print("\n==================================================")
    print(f" RESULTS: {passed} PASSED, {failed} FAILED")
    print("==================================================")

    if failed > 0:
        sys.exit(1)

if __name__ == '__main__':
    run_verification()
