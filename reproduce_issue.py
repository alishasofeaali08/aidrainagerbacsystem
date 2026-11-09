
import requests

def test_registration():
    url = "http://localhost:8000/api/auth/register"
    
    # Test cases
    cases = [
        {
            "name": "Citizen User",
            "data": {
                "name": "Test Citizen",
                "email": "citizen@test.com",
                "password": "Password123!",
                "ic_number": "990101011234",
                "role": "citizen"
            }
        },
        {
            "name": "Technician User",
            "data": {
                "name": "Test Tech",
                "email": "tech@test.com",
                "password": "Password123!",
                "ic_number": "990101015678",
                "department_office": "JPS HQ",
                "role": "technician"
            }
        },
        {
            "name": "Missing IC",
            "data": {
                "name": "No IC",
                "email": "noic@test.com",
                "password": "Password123!",
                "role": "citizen"
            }
        },
        {
            "name": "Invalid IC",
            "data": {
                "name": "Bad IC",
                "email": "badic@test.com",
                "password": "Password123!",
                "ic_number": "123",
                "role": "citizen"
            }
        }
    ]

    for case in cases:
        print(f"Testing: {case['name']}")
        try:
            # Using data= for Form data
            r = requests.post(url, data=case['data'])
            print(f"Status: {r.status_code}")
            print(f"Response: {r.text}")
        except Exception as e:
            print(f"Error: {e}")
        print("-" * 20)

if __name__ == "__main__":
    test_registration()
