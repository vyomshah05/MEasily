from Path_risk import get_risk as path_risk_get_risk  # Changed this line
from Addresses import add_datapoints
from flask import Flask, jsonify, request
from flask_cors import CORS
from Add_point import Point, All_Points  # Add this import
from Gemini import call_gemini_flash
from Geolocation import get_address, get_best_points

app = Flask(__name__)
CORS(app)

# Route to fetch the datapoints
@app.route('/api/datapoints', methods=['GET'])
def get_datapoints():
    data = add_datapoints()
    return jsonify(data)

@app.route('/api/risk', methods=['POST'])
def calculate_risk():
    data = request.get_json()

    # print("RECEIVED DATA FROM FRONTEND:")
    # print(f"Full data: {data}")
    
    start_point_data = data.get('startPoint')
    end_point_data = data.get('endPoint')

    # print(f"Start Point: {start_point_data}")
    # print(f"End Point: {end_point_data}")
    
    if not start_point_data or not end_point_data:
        return jsonify({"error": "Missing startPoint or endPoint"}), 400

    # Convert frontend objects to Point objects
    start_point = Point(
        start_point_data.get('name', 'Start'),
        start_point_data.get('lat', 0),
        start_point_data.get('lng', 0),  # Note: frontend uses 'lng', not 'long'
        0  # Default risk value
    )
    
    end_point = Point(
        end_point_data.get('name', 'End'),
        end_point_data.get('lat', 0),
        end_point_data.get('lng', 0),  # Note: frontend uses 'lng', not 'long'
        0  # Default risk value
    )

    try:
        risk = path_risk_get_risk(start_point, end_point, add_datapoints())
        alternates = get_best_points(get_address(end_point.get_name()))
        gemini = call_gemini_flash(risk)
        
        return {"coefficient_of_determination": risk, 'text': gemini, 'lists':[{'name': point.get_name(),'lat': point.get_lat(), 'lng': point.get_long(), 'risk': r} for r,point in alternates.values()]}
    except Exception as e:
        return jsonify({"error": f"Failed to calculate risk: {str(e)}"}), 500

# Add a simple endpoint that works with GET requests for testing
@app.route('/api/test', methods=['GET'])
def test_endpoint():
    return jsonify({"message": "API is working!"})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
