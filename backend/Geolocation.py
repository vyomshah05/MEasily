from flask import jsonify
import requests
import os
from dotenv import load_dotenv
import json
from Add_point import All_Points, Point
from Path_risk import get_risk
from Addresses import add_datapoints, add_locs

load_dotenv()

def get_address(address = "Cal Train Station, Sunnyvale"):
    # === Your API Key ===
    API_KEY = os.getenv("ASI-KEY")

    # === API Endpoint ===
    url = "https://api.asi1.ai/v1/chat/completions"

    headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'  # Replace with your API Key
        }

    prompt = f"""
    Give me 10 places similar to whatever establishments is at {address} in the following format with nothing else per line: "name:<name>=lat:<lat>=long:<long>" for example: "name:Euston Station=lat:51.5288=long:-0.1339" per line nothing before and nothing after
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

def get_best_points(response, sp, points):
    places = response.split('\n')
    spots = All_Points()
    for place in places:
        if not place:
            break
        tokens = place.split('=')
        i = 0
        name = ''
        lat = 0
        long = 0
        for t in tokens:
            if i == 0:
                name = t.split(':')[1]
                i += 1
            elif i == 1:
                lat = float(t.split(':')[1])
                i += 1
            elif i == 2:
                long = float(t.split(':')[1])
                i = 0
        spots.add_point(Point(name, lat, long, 100))

    # correctly use the best ones
    best = sorted(spots.get_list(), key=lambda x: get_risk(sp, x, points))[:3]
    return {spot.get_name(): (get_risk(sp, spot, points)/100, spot) for spot in best}

'''
if __name__ == '__main__':
    alternates = get_best_points(get_address(), sp=Point("Boom", lat=34.05, long=-112.2437, risk=0), points=add_locs())
    print({"coefficient_of_determination": 80, 'lists':[{'name': point.get_name(),'lat': point.get_lat(), 'lng': point.get_long(), 'risk': 80} for risk,point in alternates.values()]})
'''