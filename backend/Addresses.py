'''import pandas as pd
import numpy as np
import requests
from dotenv import load_dotenv 
import os'''
from Add_point import Point, All_Points
from flask import Flask, jsonify
from Geolocation import get_address
from Add_point import Point, All_Points

def add_datapoints(data="2025LAHacks_Addresses.csv"):
    locs = All_Points()
    locs.add_point(Point("Point 1", 35.36533, -103.285393, 100))
    locs.add_point(Point("Point 2", 36.504315, -110.623989, 100))
    locs.add_point(Point("Point 3", 36.668913, -104.07088, 100))
    locs.add_point(Point("Point 4", 31.999207, -109.496635, 100))
    locs.add_point(Point("Point 5", 32.451218, -106.815506, 100))
    locs.add_point(Point("Point 6", 33.692817, -106.180855, 100))
    locs.add_point(Point("Point 7", 32.669337, -112.051643, 100))
    locs.add_point(Point("Point 8", 34.714948, -111.136505, 100))
    locs.add_point(Point("Point 9", 33.289541, -111.854949, 100))
    locs.add_point(Point("Point 10", 35.558228, -112.095781, 100))
    locs.add_point(Point("Point 11", 35.955641, -108.596743, 100))
    locs.add_point(Point("Point 12", 32.059985, -103.028518, 100))
    locs.add_point(Point("Point 13", 32.693251, -113.368579, 100))
    locs.add_point(Point("Point 14", 32.439455, -114.978231, 100))
    locs.add_point(Point("Point 15", 35.479894, -103.484211, 100))
    locs.add_point(Point("Point 16", 36.834641, -106.671, 100))
    locs.add_point(Point("Point 17", 31.660974, -102.24508, 100))
    locs.add_point(Point("Point 18", 34.843735, -114.089128, 100))
    locs.add_point(Point("Point 19", 37.621947, -114.630343, 100))  # California
    locs.add_point(Point("Point 20", 37.762407, -118.832931, 100))  # California
    return locs.get_json()




