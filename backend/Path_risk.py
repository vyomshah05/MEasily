from Add_point import Point, All_Points
import math

def distance(p1, p2):
    return math.sqrt((p1.get_lat() - p2.get_lat())**2 + (p1.get_long() - p2.get_long())**2)

def linear(sp, ep, x):
    m = (ep.get_lat() - sp.get_lat()) / (ep.get_long() - sp.get_long())
    b = sp.get_lat() - m * sp.get_long()
    return Point("", m * x + b, x, 0)

def get_closest_points(points, sp, ep, num):
    sorted_points = sorted(points.get_list(), key=lambda point: distance(linear(sp, ep, point.get_long()), point))
    closest = All_Points()
    for i in range(num):
        closest.add_point(sorted_points[i])
    return closest

def calculate_coefficient_of_determination(sp, ep, points):
    y_vals = [p.get_lat() for p in points.get_list()]
    x_vals = [p.get_long() for p in points.get_list()]
    average = sum(y_vals) / len(y_vals)
    SSR = sum((y - linear(sp, ep, x).get_lat())**2 for y, x in zip(y_vals, x_vals))
    SST = sum((y - average)**2 for y in y_vals)
    # print(f"SSR: {SSR}, SST: {SST} this is our predicted percentage of risk")
    return (SSR / SST)*100

def get_risk(sp, ep, points):
    # Since points is already a list, we don't need to call get_list()
    # Convert the list to an All_Points object
    points_obj = All_Points()
    for point_data in points:
        # The JSON structure has 'latitude', 'longitude', etc. keys
        name = point_data.get('name', '')
        lat = point_data.get('latitude', 0)
        long = point_data.get('longitude', 0)
        risk = point_data.get('risk', 0)
        points_obj.add_point(Point(name, lat, long, risk))
    
    closest_points = get_closest_points(points_obj, sp, ep, 10)  # Using our newly created All_Points object
    final_percentage = calculate_coefficient_of_determination(sp, ep, closest_points)
    return final_percentage

