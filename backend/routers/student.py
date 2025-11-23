
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Dict, Any

from .auth import get_current_user

router = APIRouter()

# In-memory dictionary to simulate bus locations
# dummy_bus_locations = {
#     1: {"lat": 18.5204, "lng": 73.8567, "speed": 20, "driver_name": "Driver A", "estimated_arrival": "10:30 AM"},
#     2: {"lat": 18.6000, "lng": 73.9000, "speed": 25, "driver_name": "Driver B", "estimated_arrival": "10:45 AM"},
#     3: {"lat": 18.7000, "lng": 73.7000, "speed": 15, "driver_name": "Driver C", "estimated_arrival": "11:00 AM"}
# }

@router.get("/buses", tags=["Students"])
async def get_all_buses(request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db
    drivers_db = request.app.state.db.drivers_db
    
    buses_info = []
    for bus in buses_db:
        route = next((r for r in routes_db if r["id"] == bus["route_id"]), None)
        driver = next((d for d in drivers_db if d["id"] == bus["driver_id"]), None)
        
        bus_data = {
            "id": bus["id"],
            "name": bus["name"],
            "route_name": route["name"] if route else "N/A",
            "start_time": "9:00 AM", # Dummy value
            "stops": route["stops"] if route else []
        }
        buses_info.append(bus_data)
    return buses_info

@router.get("/bus/{bus_id}", tags=["Students"])
async def get_bus_details(bus_id: int, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db
    drivers_db = request.app.state.db.drivers_db

    bus = next((b for b in buses_db if b["id"] == bus_id), None)
    if not bus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found")
    
    route = next((r for r in routes_db if r["id"] == bus["route_id"]), None)
    driver = next((d for d in drivers_db if d["id"] == bus["driver_id"]), None)

    bus_data = {
        "id": bus["id"],
        "name": bus["name"],
        "route_name": route["name"] if route else "N/A",
        "start_time": "9:00 AM", # Dummy value
        "stops": route["stops"] if route else [],
        "driver_name": driver["name"] if driver else "N/A",
        "bus_number": f"KA{bus_id}ABC" # Dummy bus number
    }
    return bus_data

@router.get("/track/{bus_id}", tags=["Students"])
async def track_bus(bus_id: int, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    dummy_all_bus_locations = request.app.state.db.dummy_all_bus_locations # Access from db object
    if bus_id not in dummy_all_bus_locations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found or not currently tracking")
    
    return dummy_all_bus_locations[bus_id]

