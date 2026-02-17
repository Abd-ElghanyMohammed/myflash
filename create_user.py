#!/usr/bin/env python3
"""
Script to create a Firebase user with email: root123#@gmail.com and password: root251
"""

import requests
import json

# Firebase project details
PROJECT_ID = "myproject-43cda"
API_KEY = "AIzaSyAqF-tgVazUBhAADP-fUPPLDVSrrnJSNBo"

# User credentials
EMAIL = "root123#@gmail.com"
PASSWORD = "root251"

# Firebase Auth REST API endpoint
url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"

# Payload
payload = {
    "email": EMAIL,
    "password": PASSWORD,
    "returnSecureToken": True
}

headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ User created successfully!")
        print(f"  Email: {EMAIL}")
        print(f"  UID: {data.get('localId')}")
        print(f"  ID Token: {data.get('idToken')[:50]}...")
    elif response.status_code == 400:
        error_data = response.json()
        error_message = error_data.get('error', {}).get('message', '')
        
        if 'EMAIL_EXISTS' in error_message:
            print(f"✓ User already exists!")
            print(f"  Email: {EMAIL}")
            print(f"  This user can login with the provided credentials.")
        else:
            print(f"✗ Error: {error_message}")
    else:
        print(f"✗ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"✗ Exception: {e}")

