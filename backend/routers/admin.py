
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel

from backend.routers.auth import get_current_user

router = APIRouter()

# Pydantic models for Admin operations
class BusBase(BaseModel):
    bus_number: str
    route_name: str
    starting_point: str
    assigned_driver_id: Optional[int] = None
    departure_time: str
    estimated_arrival: str
    route_stops: List[str]

class BusCreate(BusBase):
    pass

class RouteStop(BaseModel):
    lat: float
    lng: float

class RouteBase(BaseModel):
    name: str
    stops: List[RouteStop]

class RouteCreate(RouteBase):
    pass

class RouteUpdate(BaseModel):
    name: Optional[str] = None
    stops: Optional[List[RouteStop]] = None

class BusUpdate(BaseModel):
    bus_number: Optional[str] = None
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    assigned_driver_id: Optional[int] = None
    departure_time: Optional[str] = None
    estimated_arrival: Optional[str] = None
    # Allow updating route_stops directly on the bus, overriding from BusBase if needed
    # This will be a list of RouteStop objects for detailed updates
    route_stops: Optional[List[RouteStop]] = None
    route_id: Optional[int] = None # Added route_id to allow changing the associated route
    name: Optional[str] = None # Re-added original fields for flexibility
    driver_id: Optional[int] = None # Re-added original fields for flexibility

class DriverBase(BaseModel):
    username: str
    password: str
    name: str
    phone: str

class DriverCreate(DriverBase):
    pass

class DriverUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None


def get_admin_user(current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    return current_user

# Admin Dashboard Stats
@router.get("/stats", tags=["Admin"])
async def get_admin_stats(request: Request, current_user: Any = Depends(get_admin_user)):
    return {
        "total_buses": len(request.app.state.db.buses_db),
        "total_drivers": len(request.app.state.db.drivers_db),
        "total_routes": len(request.app.state.db.routes_db),
        "total_students": len(request.app.state.db.students_db),
    }

# Manage Buses
@router.get("/buses", tags=["Admin"])
async def get_all_buses(request: Request, current_user: Any = Depends(get_admin_user)):
    buses_with_details = []
    for bus in request.app.state.db.buses_db:
        driver = next((d for d in request.app.state.db.drivers_db if d["id"] == bus.get("assigned_driver_id")), None)
        route = next((r for r in request.app.state.db.routes_db if r["id"] == bus.get("route_id")), None)
        bus_details = {
            **bus,
            "driver_name": driver["name"] if driver else "N/A",
            "route_name": route["name"] if route else "N/A",
        }
        buses_with_details.append(bus_details)
    return buses_with_details

@router.post("/buses", tags=["Admin"])
async def add_bus(bus: BusCreate, request: Request, current_user: Any = Depends(get_admin_user)):
    buses_db = request.app.state.db.buses_db
    # Find the maximum existing bus ID and increment it, or start from 1 if no buses exist
    new_id = max([b["id"] for b in buses_db]) + 1 if buses_db else 1
    new_bus = bus.dict() # Convert Pydantic model to dictionary
    new_bus["id"] = new_id
    buses_db.append(new_bus) # Add the new bus to the in-memory database
    request.app.state.save_data("buses", buses_db) # Persist the updated data to the JSON file
    return new_bus

@router.put("/buses/{bus_id}", tags=["Admin"])
async def update_bus(bus_id: int, bus_update: BusUpdate, request: Request, current_user: Any = Depends(get_admin_user)):
    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db
    bus_found = False
    for idx, bus in enumerate(buses_db):
        if bus["id"] == bus_id:
            updated_bus_data = bus.copy()
            # Update bus details in buses_db
            updated_bus_data.update(bus_update.dict(exclude_unset=True, exclude={'route_stops'}))
            
            # Handle route_stops update separately if provided
            if bus_update.route_stops is not None:
                route_id_to_update = updated_bus_data.get("route_id")
                if route_id_to_update:
                    route_found = False
                    for r_idx, route in enumerate(routes_db):
                        if route["id"] == route_id_to_update:
                            updated_route = route.copy()
                            updated_route["stops"] = [stop.dict() for stop in bus_update.route_stops] # Update stops with new lat/lng objects
                            routes_db[r_idx] = updated_route
                            request.app.state.save_data("routes", routes_db)
                            route_found = True
                            break
                    if not route_found:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Route with ID {route_id_to_update} not found for bus update")

            buses_db[idx] = updated_bus_data
            request.app.state.save_data("buses", buses_db)
            bus_found = True
            return updated_bus_data
    if not bus_found:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found")

@router.delete("/buses/{bus_id}", tags=["Admin"])
async def delete_bus(bus_id: int, request: Request, current_user: Any = Depends(get_admin_user)):
    buses_db = request.app.state.db.buses_db
    initial_len = len(buses_db)
    request.app.state.db.buses_db = [bus for bus in buses_db if bus["id"] != bus_id]
    if len(request.app.state.db.buses_db) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found")
    request.app.state.save_data("buses", request.app.state.db.buses_db) # Save after deletion
    return {"message": "Bus deleted successfully"}

# Manage Drivers
@router.get("/drivers", tags=["Admin"])
async def get_all_drivers(request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    # Exclude passwords for security, even for admin in a real app
    return [{k: v for k, v in driver.items() if k != "password"} for driver in drivers_db]

@router.post("/drivers/add", tags=["Admin"])
async def add_driver(driver: DriverCreate, request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    new_id = max([d["id"] for d in drivers_db]) + 1 if drivers_db else 1
    new_driver = driver.dict()
    new_driver["id"] = new_id
    drivers_db.append(new_driver)
    request.app.state.save_data("drivers", drivers_db)
    return {k: v for k, v in new_driver.items() if k != "password"}

@router.put("/drivers/{driver_id}", tags=["Admin"])
async def update_driver(driver_id: int, driver_update: DriverUpdate, request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    for idx, driver in enumerate(drivers_db):
        if driver["id"] == driver_id:
            updated_driver = driver.copy()
            updated_driver.update(driver_update.dict(exclude_unset=True))
            drivers_db[idx] = updated_driver
            request.app.state.save_data("drivers", drivers_db)
            return {k: v for k, v in updated_driver.items() if k != "password"}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

@router.delete("/drivers/{driver_id}", tags=["Admin"])
async def delete_driver(driver_id: int, request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    initial_len = len(drivers_db)
    request.app.state.db.drivers_db = [driver for driver in drivers_db if driver["id"] != driver_id]
    if len(request.app.state.db.drivers_db) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    request.app.state.save_data("drivers", request.app.state.db.drivers_db)
    return {"message": "Driver deleted successfully"}

# Manage Routes
@router.get("/routes", tags=["Admin"])
async def get_all_routes(request: Request, current_user: Any = Depends(get_admin_user)):
    return request.app.state.db.routes_db

@router.post("/routes/add", tags=["Admin"])
async def add_route(route: RouteCreate, request: Request, current_user: Any = Depends(get_admin_user)):
    routes_db = request.app.state.db.routes_db
    new_id = max([r["id"] for r in routes_db]) + 1 if routes_db else 1
    new_route = route.dict()
    new_route["id"] = new_id
    routes_db.append(new_route)
    request.app.state.save_data("routes", routes_db)
    return new_route

@router.put("/routes/{route_id}", tags=["Admin"])
async def update_route(route_id: int, route_update: RouteUpdate, request: Request, current_user: Any = Depends(get_admin_user)):
    routes_db = request.app.state.db.routes_db
    for idx, route in enumerate(routes_db):
        if route["id"] == route_id:
            updated_route = route.copy()
            updated_route.update(route_update.dict(exclude_unset=True))
            routes_db[idx] = updated_route
            request.app.state.save_data("routes", routes_db)
            return updated_route
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

@router.delete("/routes/{route_id}", tags=["Admin"])
async def delete_route(route_id: int, request: Request, current_user: Any = Depends(get_admin_user)):
    routes_db = request.app.state.db.routes_db
    initial_len = len(routes_db)
    request.app.state.db.routes_db = [route for route in routes_db if route["id"] != route_id]
    if len(request.app.state.db.routes_db) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    request.app.state.save_data("routes", request.app.state.db.routes_db)
    return {"message": "Route deleted successfully"}

