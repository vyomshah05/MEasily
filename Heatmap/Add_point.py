class Point:
    def __init__(self, name, lat, long, risk):
        self.name = name
        self.lat = lat
        self.long = long
        self.risk = risk
    
    def get_lat(self):
        return self.lat
    
    def get_long(self):
        return self.long

    def get_risk(self):
        return self.risk
    
    def set_risk(self, risk):
        self.risk = risk

    def get_name(self):
        return self.name

    def __eq__(self, point):
        if (type(point) != Point):
            return False
        return point.lat == self.lat and point.long == self.long

class All_Points:
    def __init__(self):
        self.points = []

    def add_point(self, lat, long = None, risk = None):
        if type(lat == Point):
            curr = lat
        else:
            curr = Point(lat, long, risk)
        for point in self.points:
            if point == curr:
                point.set_risk(max(point.get_risk(),risk))
                return
        self.points.append(curr)

    def get_list(self):
        return self.points
    
    def get_json(self):
        return [{"name":point.get_name(),"latitude":point.get_lat(),"longitude":point.get_long(), "risk":point.get_long()} for point in self.points]