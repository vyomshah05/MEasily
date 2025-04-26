from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
import json
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for all routes to allow requests from your React frontend
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(data_dir, exist_ok=True)

@app.route('/api/route', methods=['POST'])
def save_route():
    """
    Endpoint to receive and save route data from the frontend
    """
    try:
        # Get data from the request
        route_data = request.get_json()
        
        # Log the received data
        logger.info(f"Received route data: {route_data}")
        
        # Validate required fields
        required_fields = ['startPoint', 'endPoint', 'travelMode']
        for field in required_fields:
            if field not in route_data:
                return jsonify({
                    'status': 'error', 
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Add timestamp to the data
        route_data['timestamp'] = datetime.now().isoformat()
        
        # Generate a unique filename based on timestamp
        filename = f"route_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        file_path = os.path.join(data_dir, filename)
        
        # Save the data to a JSON file
        with open(file_path, 'w') as f:
            json.dump(route_data, f, indent=2)
        
        logger.info(f"Route data saved to {file_path}")
        
        # Return success response
        return jsonify({
            'status': 'success',
            'message': 'Route data saved successfully',
            'filename': filename
        })
        
    except Exception as e:
        logger.error(f"Error processing route data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/api/routes', methods=['GET'])
def get_routes():
    """
    Endpoint to retrieve all saved routes
    """
    try:
        routes = []
        
        # Read all JSON files in the data directory
        for filename in os.listdir(data_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(data_dir, filename)
                with open(file_path, 'r') as f:
                    route_data = json.load(f)
                    # Add filename to the data
                    route_data['filename'] = filename
                    routes.append(route_data)
        
        # Sort routes by timestamp (newest first)
        routes.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({
            'status': 'success',
            'routes': routes
        })
        
    except Exception as e:
        logger.error(f"Error retrieving routes: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

# Add a route to retrieve a specific saved route
@app.route('/api/routes/<filename>', methods=['GET'])
def get_route(filename):
    """
    Endpoint to retrieve a specific route by filename
    """
    try:
        file_path = os.path.join(data_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'status': 'error',
                'message': f'Route not found: {filename}'
            }), 404
        
        with open(file_path, 'r') as f:
            route_data = json.load(f)
        
        return jsonify({
            'status': 'success',
            'route': route_data
        })
        
    except Exception as e:
        logger.error(f"Error retrieving route {filename}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Run the app on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)