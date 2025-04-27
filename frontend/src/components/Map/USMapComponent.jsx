import React, { useEffect, useRef, useState } from 'react';
import './USMapComponent.css';
import locationData from '/Users/doubledogok/MEasily/frontend/src/data/locations.json';
import { Grid, Card, CardContent, Typography, TextField, MenuItem, Button, Box } from '@mui/material';
import { motion } from 'framer-motion';


const MotionCard = props => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -5 }}
    transition={{ duration: 0.3 }}
  >
    <Card
      sx={{
        width: '100%',        // ← full-width
       minHeight: 150,
       borderRadius: 3,      // slightly rounder
       boxShadow: 4,         // deeper shadow
       background: 'white',
       transition: 'transform 0.2s ease',
       '&:hover': { boxShadow: 6 }
     }}
     {...props}
   />
  </motion.div>
);


const travelOptions = [
  { value: 'DRIVING', label: '🚗 Driving' },
  { value: 'TRANSIT',  label: '🚆 Transit' },
  { value: 'WALKING',  label: '🚶 Walking' },
  { value: 'BICYCLING',label: '🚲 Bicycling' },
  { value: 'AIRPLANE', label: '✈️ Airplane' },
];



const USMapComponent = () => {
  const mapRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState("Select transportation mode and click \"Calculate Route\"");
  const [travelMode, setTravelMode] = useState("DRIVING");
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [blinking, setBlinking] = useState(false);


  const [riskPercent, setRiskPercent] = useState(0);
  const [targetRisk, setTargetRisk] = useState(0);
  const [riskSuggestions, setRiskSuggestions] = useState([]);
  const [geminiText, setGeminiText] = useState('');
  const riskSuggestionMarkersRef = useRef([]);


  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current < targetRisk) {
        current += 1;
        setRiskPercent(current);
      } else {
        clearInterval(interval);
        setBlinking(true); // 👈 Start blinking once counting finishes
      }
    }, 20); // speed
  
    return () => clearInterval(interval);
  }, [targetRisk]);

  const getBlinkingClass = (value) => {
    if (!blinking) return ''; // Not blinking until finished
    if (value == 0) return 'blink-white';
    else if (value <= 30) return 'blink-green';
    else if (value <= 70) return 'blink-yellow';
    return 'blink-red';
  };



  
  // Refs to store map-related objects
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const markerClusterRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const currentPathRef = useRef(null);
  
  // Hardcoded start and end points
  const [startPoint, setStartPoint] = useState({ lat: 34.05, lng: -112.2437, name: "New York" });
  
  const [endPoint, setEndPoint] = useState({ lat: 34.0522, lng: -118.2437, name: "Los Angeles"});
  
  // Style options for different transport modes
  const transportStyles = {
    DRIVING: {
      strokeColor: "#FF0000", // Red
      strokeWeight: 5,
      strokeOpacity: 0.7
    },
    TRANSIT: {
      strokeColor: "#008000", // Green
      strokeWeight: 5,
      strokeOpacity: 0.7
    },
    WALKING: {
      strokeColor: "#0000FF", // Blue
      strokeWeight: 5,
      strokeOpacity: 0.7
    },
    BICYCLING: {
      strokeColor: "#FF00FF", // Purple
      strokeWeight: 5,
      strokeOpacity: 0.7
    },
    AIRPLANE: {
      strokeColor: "#00BFFF", // Deep Sky Blue
      strokeWeight: 4,
      strokeOpacity: 0.8,
      strokeDashArray: [10, 5] // Dashed line for airplane mode
    }
  };

  // City data
  const cities = locationData.locations.map(location => ({
    title: location.name,
    lat: location.latitude,
    lng: location.longitude,
  }));

  useEffect(() => {
    if (riskPercent > 70 && mapInstance.current && riskSuggestions.length > 0) {
      // Clear old suggestion markers first if needed
      riskSuggestionMarkersRef.current.forEach(marker => marker.setMap(null));
      riskSuggestionMarkersRef.current = [];
  
      // Add new markers
      const newMarkers = riskSuggestions.map((location) => {
        const marker = new window.google.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map: mapInstance.current,
          title: location.name,
          icon: {
            url: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png",
            scaledSize: new window.google.maps.Size(30, 30),
          },
        });
        return marker;
      });
  
      riskSuggestionMarkersRef.current = newMarkers;
    } else {
      // Clear risk markers if risk is low
      riskSuggestionMarkersRef.current.forEach(marker => marker.setMap(null));
      riskSuggestionMarkersRef.current = [];
    }
  }, [riskSuggestions, riskPercent]);
  

  // Load Google Maps script dynamically
  useEffect(() => {
    // Function to load Google Maps API
    const loadGoogleMapsAPI = () => {
      const googleMapScript = document.createElement('script');
      googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDISJgs4T4krdfk4-ZihPzeZS_4CCi3Yo0
      &libraries=places,marker&callback=initMap`;
      googleMapScript.async = true;
      googleMapScript.defer = true;
      window.initMap = initMap;
      document.head.appendChild(googleMapScript);
    };

    loadGoogleMapsAPI();

    return () => {
      // Clean up resources when component unmounts
      window.initMap = null;
    };
  }, []);

  // Initialize map
  const initMap = async () => {
    try {
      // Import required libraries
      const { Map } = await google.maps.importLibrary("maps");
      const { DirectionsService, DirectionsRenderer } = await google.maps.importLibrary("routes");
      
      // Create map
      const map = new Map(mapRef.current, {
        center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
        zoom: 4,
        mapTypeId: 'roadmap'
      });
      
      mapInstance.current = map;

      // Initialize directions service and renderer
      directionsServiceRef.current = new DirectionsService();
      directionsRendererRef.current = new DirectionsRenderer({
        map: map,
        suppressMarkers: true, // We'll add our own markers
      });

      // Add yellow dots for cities
      const markers = [];
      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        const marker = new google.maps.Marker({
          position: { lat: city.lat, lng: city.lng },
          map: map,
          title: city.title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#FFD700", // bright yellow
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: "#FFA500"
          }
        });
        markers.push(marker);
      }
      
      markersRef.current = markers;

      // Add Marker Clusterer
      const { MarkerClusterer } = await google.maps.importLibrary("marker");
      markerClusterRef.current = new MarkerClusterer({ 
        map, 
        markers,
        renderer: {
          render: ({ count, position }) => {
            return new google.maps.Marker({
              position,
              label: {
                text: String(count),
                color: "white",
                fontSize: "12px",
                fontWeight: "bold"
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: Math.min(40, count * 2), // size based on count
                fillColor: "#FFA500",
                fillOpacity: 0.8,
                strokeWeight: 1,
                strokeColor: "#FF8C00"
              },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
            });
          }
        }
      });
      
      // Add markers for start and end points
      addRouteMarkers(startPoint, endPoint);
      
      // Calculate the initial route
      calculateRoute();
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  };
  
  // Add route markers
  const addRouteMarkers = (start, end) => {
    if (!mapInstance.current) return;
    
    // Clear previous markers
    if (startMarkerRef.current) startMarkerRef.current.setMap(null);
    if (endMarkerRef.current) endMarkerRef.current.setMap(null);
    
    // Add start marker
    startMarkerRef.current = new google.maps.Marker({
      position: start,
      map: mapInstance.current,
      title: "Start: " + (start.name || "Start"),
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#00FF00",  // Green
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#008000"
      },
      zIndex: 1001  // To appear above other markers
    });
    
    // Add end marker
    endMarkerRef.current = new google.maps.Marker({
      position: end,
      map: mapInstance.current,
      title: "End: " + (end.name || "End"),
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#FF0000",  // Red
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#8B0000"
      },
      zIndex: 1001  // To appear above other markers
    });
  };
  
  // Calculate route
  const calculateRoute = () => {
    if (!mapInstance.current) return;
    
    // Update route info
    setRouteInfo(`Calculating route from ${startPoint.name} to ${endPoint.name}...`);
    
    // Add markers for start and end points (refresh them)
    addRouteMarkers(startPoint, endPoint);
    
    // Call Directions API
    updateRoute();

    // sending data to backend
    sendRouteToBackend();
  };
  
  // Update route based on travel mode
  const updateRoute = () => {
    if (!mapInstance.current || !directionsServiceRef.current || !directionsRendererRef.current) return;
    
    // Remove any existing custom paths
    if (currentPathRef.current) {
      currentPathRef.current.setMap(null);
      currentPathRef.current = null;
    }
    
    // Special case for AIRPLANE mode
    if (travelMode === "AIRPLANE") {
      drawAirplanePath();
      return;
    }
    
    // For directions service
    directionsRendererRef.current.setMap(mapInstance.current);
    directionsRendererRef.current.setOptions({
      polylineOptions: transportStyles[travelMode]
    });
    
    // Create request for Directions API
    const request = {
      origin: new google.maps.LatLng(startPoint.lat, startPoint.lng),
      destination: new google.maps.LatLng(endPoint.lat, endPoint.lng),
      travelMode: google.maps.TravelMode[travelMode]
    };
    
    // Call the Directions Service
    directionsServiceRef.current.route(request, function(result, status) {
      setRouteInfo("Route calculation status: " + status);
      
      if (status === 'OK') {
        // Display the route
        directionsRendererRef.current.setDirections(result);
        
        // Get route distance and duration
        const route = result.routes[0];
        const leg = route.legs[0];
        setRouteInfo(`Mode: ${travelMode} | Distance: ${leg.distance.text} | Duration: ${leg.duration.text}`);
        
        // Fit map to the route
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(startPoint.lat, startPoint.lng));
        bounds.extend(new google.maps.LatLng(endPoint.lat, endPoint.lng));
        mapInstance.current.fitBounds(bounds);
      } else {
        let errorMessage = `Directions request failed due to ${status}`;
        
        if (status === "ZERO_RESULTS") {
          errorMessage += `. No route found for ${travelMode}. Try a different transportation mode.`;
        }
        
        setRouteInfo(errorMessage);
      }
    });
  };
  
  // Draw airplane path
  const drawAirplanePath = () => {
    if (!mapInstance.current) return;
    
    // Hide directions renderer
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }
    
    // Create a curved flight path between start and end points
    const pathCoordinates = [
      startPoint,
      {
        lat: (startPoint.lat + endPoint.lat) / 2 + 1, // Add a slight curve by offsetting the midpoint
        lng: (startPoint.lng + endPoint.lng) / 2,
      },
      endPoint
    ];
    
    // Create a polyline for the airplane path
    currentPathRef.current = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true, // Curved line following the Earth's curvature
      strokeColor: transportStyles.AIRPLANE.strokeColor,
      strokeOpacity: transportStyles.AIRPLANE.strokeOpacity,
      strokeWeight: transportStyles.AIRPLANE.strokeWeight,
      map: mapInstance.current
    });
    
    // Add airplane icon on the path
    const lineSymbol = {
      path: "M362.985,430.724l-10.248,51.234l62.332,57.969l-3.293,26.145l-71.345-23.599l-2.001,13.069l-2.057-13.529l-71.278,22.928l-5.762-23.984l64.097-59.271l-8.913-51.359l0.858-114.43l-21.945-11.338l-189.358,88.76l-1.18-32.262l213.344-180.08l0.875-107.436l7.973-32.005l7.642-12.054l7.377-0.269l7.619,12.526l7.277,31.669l-1.127,107.695l211.592,178.956l-1.496,32.262l-188.79-90.495l-21.549,10.882l-0.253,115.062z",
      scale: 0.05,
      strokeColor: "#000000",
      strokeWeight: 1,
      fillColor: "#FFFFFF",
      fillOpacity: 1,
      anchor: new google.maps.Point(400, 400)
    };
    
    // Add airplane icon to the path
    new google.maps.Marker({
      position: {
        lat: (startPoint.lat + endPoint.lat) / 2 + 0.5,
        lng: (startPoint.lng + endPoint.lng) / 2
      },
      icon: lineSymbol,
      map: mapInstance.current
    });
    
    // Calculate distance (great-circle distance using Haversine formula)
    const distance = calculateDistance(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
    
    // Estimate flight time (assuming average speed of 500 mph)
    const durationHours = distance / 500;
    const hours = Math.floor(durationHours);
    const minutes = Math.floor((durationHours - hours) * 60);
    const durationStr = hours + " hr " + minutes + " min";
    
    // Update route info
    setRouteInfo(`Mode: AIRPLANE | Distance: ${Math.round(distance)} miles | Est. Flight Time: ${durationStr}`);
    
    // Fit map to show both points
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(startPoint.lat, startPoint.lng));
    bounds.extend(new google.maps.LatLng(endPoint.lat, endPoint.lng));
    mapInstance.current.fitBounds(bounds);
  };
  
  // Calculate distance using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Convert degrees to radians
    const toRadians = (degrees) => degrees * Math.PI / 180;
    
    // Earth's radius in miles
    const earthRadius = 3959;
    
    // Haversine formula for distance
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = earthRadius * c;
    
    return distance;
  };


  // Send route data to backend
    // Send route data to backend
const sendRouteToBackend = async () => {
    // Get the data to send
    const routeData = {
      startPoint: {
        lat: startPoint.lat,
        lng: startPoint.lng,
        name: startPoint.name
      },
      endPoint: {
        lat: endPoint.lat,
        lng: endPoint.lng,
        name: endPoint.name
      },
      travelMode: travelMode
    };
    
    console.log("Sending route data to backend:", routeData);
    
    try {
      const response = await fetch('http://localhost:5001/api/risk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Backend response:", data);

      setTargetRisk(data.coefficient_of_determination); 

      setGeminiText(data.text || ""); 

      setRiskSuggestions(data.lists || []);
      
      // Display the risk coefficient in the route info
      setRouteInfo(prevInfo => 
        `${prevInfo} | Risk Coefficient: ${data.coefficient_of_determination.toFixed(2)}`
      );
      
    } catch (error) {
      console.error("Error sending data to backend:", error);
      setRouteInfo(prevInfo => `${prevInfo} | Failed to calculate risk: ${error.message}`);
    }
  };

  const geocodeStartLocation = () => {
    if (!startLocation.trim()) {
      console.log("Empty start location, skipping geocode");
      return;
    }
    
    if (!window.google || !window.google.maps) {
      console.log("Google Maps not yet loaded");
      return;
    }
    
    console.log("Geocoding start location:", startLocation);
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: startLocation }, (results, status) => {
      console.log("Geocode status:", status);
      console.log("Geocode results:", results);
      
      if (status === "OK" && results && results.length > 0) {
        const location = results[0].geometry.location;
        const newStartPoint = { 
          lat: location.lat(), 
          lng: location.lng(), 
          name: startLocation 
        };
        
        console.log("Setting new start point:", newStartPoint);
        setStartPoint(newStartPoint);
        
        // Update route markers and recalculate
        if (mapInstance.current) {
          setTimeout(() => {
            console.log("Updating markers with new start point");
            addRouteMarkers(newStartPoint, endPoint);
            updateRoute();
          }, 100); // Small delay to ensure state is updated
        }
      } else {
        console.error("Geocode was not successful:", status);
      }
    });
  };
  
  const geocodeEndLocation = () => {
    if (!endLocation.trim()) {
      console.log("Empty end location, skipping geocode");
      return;
    }
    
    if (!window.google || !window.google.maps) {
      console.log("Google Maps not yet loaded");
      return;
    }
    
    console.log("Geocoding end location:", endLocation);
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: endLocation }, (results, status) => {
      console.log("Geocode status:", status);
      console.log("Geocode results:", results);
      
      if (status === "OK" && results && results.length > 0) {
        const location = results[0].geometry.location;
        const newEndPoint = { 
          lat: location.lat(), 
          lng: location.lng(), 
          name: endLocation 
        };
        
        console.log("Setting new end point:", newEndPoint);
        setEndPoint(newEndPoint);
        
        // Update route markers and recalculate
        if (mapInstance.current) {
          setTimeout(() => {
            console.log("Updating markers with new end point");
            addRouteMarkers(startPoint, newEndPoint);
            updateRoute();
          }, 100); // Small delay to ensure state is updated
        }
      } else {
        console.error("Geocode was not successful:", status);
      }
    });
  };

  // Handle travel mode change
  const handleTravelModeChange = (e) => {
    setTravelMode(e.target.value);
  };

  const handleStartLocationChange = (event) => {
    const newStartLocation = event.target.value;
    setStartLocation(newStartLocation);
  };
  
  const handleEndLocationChange = (event) => {
    const newEndLocation = event.target.value;
    setEndLocation(newEndLocation);
  };


  // // Update route when travel mode changes
  // useEffect(() => {
  //   let current = 0;
  //   const interval = setInterval(() => {
  //     if (current < targetRisk) {
  //       current += 1;
  //       setRiskPercent(current);
  //     } else {
  //       clearInterval(interval);
  //     }
  //   }, 20); // speed of counting up (smaller = faster)
  
  //   return () => clearInterval(interval);
  // }, [targetRisk]);


  const getColor = (value) => {
    if (value <= 10) return '#d1fae5'; // very light green
    if (value <= 20) return '#6ee7b7'; // medium light green
    if (value <= 30) return '#34d399'; // dark green
    
    if (value <= 40) return '#fef08a'; // light yellow
    if (value <= 50) return '#fde047'; // brighter yellow
    if (value <= 60) return '#facc15'; // dark yellow
    
    if (value <= 70) return '#fdba74'; // light orange
    if (value <= 80) return '#fb923c'; // orange
    if (value <= 90) return '#f97316'; // dark orange
    
    return '#ef4444'; // dark red for 91–100
  };
  

  
  return (
    <div className={`map-and-controls ${getBlinkingClass(riskPercent)}`}>
  <div id="map" ref={mapRef} />

  <div className="controls-new">
  <div className="controls-left">
    {/* Starting Location */}
    <div className="box start-box">
      <label>Starting Location:</label>
      <input
        type="text"
        placeholder="Enter Text..."
        value={startLocation}
        onChange={handleStartLocationChange}
        onBlur={geocodeStartLocation}
      />
    </div>

    {/* Ending Location */}
    <div className="box end-box">
      <label>Ending Location:</label>
      <input
        type="text"
        placeholder="Enter Text..."
        value={endLocation}
        onChange={handleEndLocationChange}
        onBlur={geocodeEndLocation}
      />
    </div>

    {/* Travel Mode */}
    <div className="box mode-box">
      <label>Travel Mode:</label>
      <select value={travelMode} onChange={handleTravelModeChange}>
        {travelOptions.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>

    {/* Get Path Button */}
    <div className="box path-box">
      <button onClick={calculateRoute}>
        <span className="path-icon">🛣️</span> Get Path
      </button>
    </div>
  </div>

  <div className="controls-right">
  <div className="risk-content">
    
    {/* Circle Section */}
    <div className="risk-circle-container">
  <div
    className="circle"
    style={{
      background: `conic-gradient(${getColor(riskPercent)} ${riskPercent}%, #d1d5db 0% 100%)`
    }}
  >
    <div className="percentage">{riskPercent}%</div>
  </div>
  <div className="risk-text">
    <strong>Moderate Chance</strong>
    {/* <p>Be safe</p> */}
  </div>
</div>


    {/* Text Box Section */}
    <div>
  {/* Gemini Text */}
  <div className="risk-textbox">
  {geminiText && (
    <p style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '16px' , color:'black'}}>
      {geminiText}
    </p>
  )}

  {riskPercent > 70 ? (
    <ul>
      {riskSuggestions.map((location, index) => (
        <li key={index}>
          <span role="img" aria-label="pin">📍</span> {/* Google Pin icon */}
          <strong>{location.name}</strong> ({Math.round(location.risk * 100)}%)
        </li>
      ))}
    </ul>
  ) : riskPercent > 30 ? (
    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
      ⚠️ Moderate Risk:  
      <ul>
        <li>Wear a mask in crowded places.</li>
        <li>Maintain hand hygiene frequently.</li>
        <li>Limit close contact with others.</li>
        <li>Check vaccination status.</li>
      </ul>
    </div>
  ) : (
    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
      ✅ Low Risk: Normal precautions advised.
    </div>
  )}
  </div>
</div>


  </div>
</div>

</div>
</div>

  );
};

export default USMapComponent;
