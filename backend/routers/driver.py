
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel

from .auth import get_current_user

router = APIRouter()

class UpdateLocation(BaseModel):
    latitude: float
    longitude: float

class BusDetailsResponse(BaseModel):
    id: int
    bus_number: str
    route_name: str
    starting_point: str
    departure_time: str
    estimated_arrival: str
    route_stops: List[Dict[str, Any]]
    latitude: float
    longitude: float
    capacity: Optional[int] = None

class DriverDashboardResponse(BaseModel):
    assigned_bus: str
    assigned_route: str
    bus_details: BusDetailsResponse # Include full bus details

@router.get("/my_bus", response_model=BusDetailsResponse, tags=["Driver"])
async def get_my_bus(request: Request, current_user: Any = Depends(get_current_user)):
    print(f"Accessing /driver/my_bus endpoint. Current User: {current_user}")
    if current_user["role"] != "driver":
        print(f"Forbidden access to /driver/my_bus for role: {current_user["role"]}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user.get("id")  # Assuming driver ID is in the token payload
    print(f"Extracted driver_id from token: {driver_id}")
    if not driver_id:
        print("Error: Driver ID not found in token.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Driver ID not found in token")
    
    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db

    print(f"Searching for bus assigned to driver_id: {driver_id}")
    print(f"Current buses_db: {buses_db}")
    assigned_bus = next((b for b in buses_db if b.get("assigned_driver_id") == driver_id), None)
    if not assigned_bus:
        print(f"Error: No bus assigned to driver_id: {driver_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No bus assigned to this driver.")
    
    print(f"Found assigned bus: {assigned_bus}")
    print(f"Current routes_db: {routes_db}")
    route = next((r for r in routes_db if r["id"] == assigned_bus.get("route_id")), None)
    if not route:
        print(f"Error: Route not found for assigned bus: {assigned_bus.get("route_id")}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found for assigned bus.")

    print(f"Found route: {route}")

    # Extract latitude and longitude from the first stop of the route
    first_stop_lat = route["stops"][0]["lat"] if route["stops"] else None
    first_stop_lng = route["stops"][0]["lng"] if route["stops"] else None

    if first_stop_lat is None or first_stop_lng is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route stops with coordinates not found.")

    return {
        "id": assigned_bus.get("id"),
        "bus_number": assigned_bus.get("bus_number"),
        "route_name": route.get("name"), # Use 'name' from routes.json
        "starting_point": assigned_bus.get("starting_point"), # From buses.json
        "departure_time": assigned_bus.get("departure_time"),
        "estimated_arrival": assigned_bus.get("estimated_arrival"),
        "route_stops": route.get("stops"), # Use 'stops' from routes.json
        "latitude": first_stop_lat,
        "longitude": first_stop_lng,
        "capacity": assigned_bus.get("capacity", 0) # Include capacity
    }

@router.post("/trip/start", tags=["Driver"])
async def start_trip(request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user["id"] # Assuming driver ID is available in current_user
    active_trips = request.app.state.db.active_trips # Access from db object
    if driver_id in active_trips:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip already active for this driver")

    # Fetch the assigned bus details to get the actual starting location
    assigned_bus_data = await get_my_bus(request, current_user) # Pass current_user and request
    start_lat = assigned_bus_data["latitude"]
    start_lng = assigned_bus_data["longitude"]
    bus_id = assigned_bus_data["id"]
    
    active_trips[driver_id] = {"latitude": start_lat, "longitude": start_lng, "bus_id": bus_id} # Use actual bus_id
    return {"message": "Trip started successfully", "initial_location": {"latitude": start_lat, "longitude": start_lng}}

@router.post("/trip/update", tags=["Driver"])
async def update_trip_location(location: UpdateLocation, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user["id"]
    active_trips = request.app.state.db.active_trips # Access from db object
    if driver_id not in active_trips:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active trip for this driver. Start a trip first.")
    
    # Update dummy location
    active_trips[driver_id]["latitude"] = location.latitude
    active_trips[driver_id]["longitude"] = location.longitude
    return {"message": "Location updated successfully", "current_location": location.dict()}

@router.post("/trip/end", tags=["Driver"])
async def end_trip(request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user["id"]
    active_trips = request.app.state.db.active_trips # Access from db object
    if driver_id not in active_trips:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active trip to end for this driver")
    
    del active_trips[driver_id]
    return {"message": "Trip ended successfully"}

