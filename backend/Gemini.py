import os
import requests
import json
from dotenv import load_dotenv

# ---------------- Configuration ----------------
# Hardcoded API key (for demonstration). In production, store securely!

# ---------------- Helper Function ----------------
def call_gemini_flash(chance: float) -> dict:
    load_dotenv()

    API_KEY = os.getenv("GEMINI-KEY")
    # Gemini 2.0 Flash generateContent endpoint
    API_URL = (
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    )
    """
    Call the Gemini Flash generateContent API with a prompt and return the JSON response.
    """
    prompt_text = f'Speak as if you were a medical doctor given if the percent is less than 45 percent it is a low chance, if it is between 45 and 60 it is a moderate chance if it is higher than 60 it is a high chance: In 3 to 5 words explain whether or not I should go to the place I want with a {chance} percent chance of a measels contact'

    params = {"key": API_KEY}
    headers = {"Content-Type": "application/json; charset=utf-8"}
    body = {
        "contents": [{
            "parts": [{"text": prompt_text}]
        }]
    }
    response = requests.post(API_URL, params=params, headers=headers, json=body)
    response.raise_for_status()
    try:
        result = response.json()
        return(result['candidates'][0]['content']['parts'][0]['text'])

    except requests.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}\n{http_err.response.text}")
    except Exception as err:
        print(f"Unexpected error: {err}")

# ---------------- Main Execution ----------------
if __name__ == "__main__":
    try:
        gemini = call_gemini_flash(80)
    except requests.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}\n{http_err.response.text}")
    except Exception as err:
        print(f"Unexpected error: {err}")