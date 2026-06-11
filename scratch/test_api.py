import requests
import json

def test_api():
    print("=== TESTING FLASK API ENDPOINT /api/calculate_currency_swap ===")
    
    url = "http://127.0.0.1:5000/api/calculate_currency_swap"
    
    # Case A: Fixed Leg 2
    payload_a = {
        "trade_date": "28-05-2026",
        "spot_fx_rate": 1.08,
        "leg1": {
            "notional": 10000000.0,
            "rate_type": "float",
            "rate_or_spread": 0.0,
            "frequency": 2,
            "day_count": "ACT/365",
            "is_payer": True,
            "tenor_years": 5
        },
        "leg2": {
            "notional": 9000000.0,
            "rate_type": "fixed",
            "rate_or_spread": 3.0,
            "frequency": 2,
            "day_count": "ACT/365",
            "is_payer": False,
            "tenor_years": 5
        }
    }
    
    response_a = requests.post(url, json=payload_a)
    if response_a.status_code == 200:
        res_json = response_a.json()
        if res_json.get("success"):
            risk = res_json["risk_results"]
            print("\nCase A (Fixed Leg 2) API response:")
            print(f"  Base NPV: {risk['base_npv']}")
            print(f"  Leg 2 parallel delta: {risk['parallel']['leg2_delta']}")
        else:
            print("API error:", res_json.get("error"))
    else:
        print("API status error:", response_a.status_code)
        
    # Case B: Floating Leg 2
    payload_b = {
        "trade_date": "28-05-2026",
        "spot_fx_rate": 1.08,
        "leg1": {
            "notional": 10000000.0,
            "rate_type": "float",
            "rate_or_spread": 0.0,
            "frequency": 2,
            "day_count": "ACT/365",
            "is_payer": True,
            "tenor_years": 5
        },
        "leg2": {
            "notional": 9000000.0,
            "rate_type": "float",
            "rate_or_spread": 0.0,
            "frequency": 2,
            "day_count": "ACT/365",
            "is_payer": False,
            "tenor_years": 5
        }
    }
    
    response_b = requests.post(url, json=payload_b)
    if response_b.status_code == 200:
        res_json = response_b.json()
        if res_json.get("success"):
            risk = res_json["risk_results"]
            print("\nCase B (Floating Leg 2) API response:")
            print(f"  Base NPV: {risk['base_npv']}")
            print(f"  Leg 2 parallel delta: {risk['parallel']['leg2_delta']}")
        else:
            print("API error:", res_json.get("error"))
    else:
        print("API status error:", response_b.status_code)

if __name__ == "__main__":
    test_api()
