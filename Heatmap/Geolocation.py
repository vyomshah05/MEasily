import requests
import os
from dotenv import load_dotenv
import json
from Add_point import All_Points, Point

load_dotenv()

def get_address(address = "Kings Cross Station, London"):
    # === Your API Key ===
    API_KEY = os.getenv("ASI-KEY")

    # === API Endpoint ===
    url = "https://api.asi1.ai/v1/chat/completions"

    headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'  # Replace with your API Key
        }

    prompt = f"""
    You are Google API Geolocation Agent give me the lattitude and longitude of: {address} in the following format: lat:x, long:y and nothing else in the response
    """

    payload = {
            "model": "asi1-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 0
        }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return(response.json()['choices'][0]['message']['content'])

    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {str(e)}")
        return

    except json.JSONDecodeError:
        print("API Error: Unable to parse JSON response")
        return