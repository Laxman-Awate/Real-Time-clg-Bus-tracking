
import json
import asyncio
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request

from .auth import get_current_user

router = APIRouter()

# Initial dummy locations for all buses (if not in active_trips)
dummy_all_bus_locations = {
    1: {"lat": 18.5204, "lng": 73.8567, "speed": 20, "driver_name": "Driver A", "estimated_arrival": "10:30 AM", "bus_name": "Bus 1"},
    2: {"lat": 18.6000, "lng": 73.9000, "speed": 25, "driver_name": "Driver B", "estimated_arrival": "10:45 AM", "bus_name": "Bus 2"},
    3: {"lat": 18.7000, "lng": 73.7000, "speed": 15, "driver_name": "Driver C", "estimated_arrival": "11:00 AM", "bus_name": "Bus 3"}
}

# In-memory dictionary to store connected WebSocket clients
connected_clients: List[WebSocket] = []

# Function to simulate bus movement
async def simulate_bus_movement(app_state: Any): # Changed AppState to Any because AppState is now in main.py
    while True:
        # Access from app_state parameter
        for bus_id in app_state.dummy_all_bus_locations:
            if bus_id not in app_state.active_trips:  # Only simulate if not actively updated by a driver
                # Simple movement simulation: increment lat/lng slightly
                app_state.dummy_all_bus_locations[bus_id]["lat"] += 0.0001
                app_state.dummy_all_bus_locations[bus_id]["lng"] += 0.0001
        
        # Send updated locations to all connected WebSocket clients
        message = json.dumps({"bus_locations": list(app_state.dummy_all_bus_locations.values())})
        # Create a copy of connected_clients to safely iterate and remove during iteration
        clients_to_remove = []
        for client in connected_clients:
            try:
                await client.send_text(message)
            except WebSocketDisconnect:
                clients_to_remove.append(client)
            except RuntimeError: # Handle WebSocket is not connected error
                clients_to_remove.append(client)
        for client in clients_to_remove:
            if client in connected_clients:
                connected_clients.remove(client)

        await asyncio.sleep(10)  # Update every 10 seconds

@router.on_event("startup")
async def startup_event():
    pass # The actual task creation is now in main.py


@router.get("/bus/{bus_id}", tags=["Tracking"])
async def get_bus_current_location(bus_id: int, request: Request, current_user: Any = Depends(get_current_user)):
    active_trips = request.app.state.db.active_trips
    dummy_all_bus_locations = request.app.state.db.dummy_all_bus_locations
    drivers_db = request.app.state.db.drivers_db # Get drivers_db from app.state.db

    # Prioritize driver-reported locations
    if bus_id in active_trips and active_trips[bus_id].get("bus_id") == bus_id:
        location_data = {
            "bus_id": bus_id,
            "lat": active_trips[bus_id]["latitude"],
            "lng": active_trips[bus_id]["longitude"],
            "speed": 30, # Dummy speed for active driver
            "driver_name": next((d["name"] for d in drivers_db if d["id"] == active_trips[bus_id].get("driver_id")), "N/A"),
            "estimated_arrival": "Realtime Update"
        }
        return location_data
    
    # Fallback to dummy_all_bus_locations if no active driver update
    if bus_id in dummy_all_bus_locations:
        return dummy_all_bus_locations[bus_id]

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found or not currently tracking")

@router.get("/all", tags=["Tracking"])
async def get_all_buses_current_location(request: Request, current_user: Any = Depends(get_current_user)):
    active_trips = request.app.state.db.active_trips
    dummy_all_bus_locations = request.app.state.db.dummy_all_bus_locations
    buses_db = request.app.state.db.buses_db
    drivers_db = request.app.state.db.drivers_db # Get drivers_db from app.state.db

    all_locations = []
    for bus in buses_db:
        bus_id = bus["id"]
        if bus_id in active_trips and active_trips[bus_id].get("bus_id") == bus_id: # Check if bus_id exists in active_trips
            location_data = {
                "bus_id": bus_id,
                "lat": active_trips[bus_id]["latitude"],
                "lng": active_trips[bus_id]["longitude"],
                "speed": 30,
                "driver_name": next((d["name"] for d in drivers_db if d["id"] == active_trips[bus_id].get("driver_id")), "N/A"),
                "estimated_arrival": "Realtime Update",
                "bus_name": bus["name"]
            }
        elif bus_id in dummy_all_bus_locations:
            location_data = dummy_all_bus_locations[bus_id]
        else:
            # If a bus is neither in active_trips nor dummy_all_bus_locations, provide a default/placeholder
            location_data = {"bus_id": bus_id, "lat": 0.0, "lng": 0.0, "speed": 0, "driver_name": "N/A", "estimated_arrival": "N/A", "bus_name": bus["name"]}
        all_locations.append(location_data)

    return all_locations

@router.websocket("/ws/bus_locations")
async def websocket_bus_locations(websocket: WebSocket, request: Request):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            # Keep the connection alive, client can send messages if needed
            await websocket.receive_text() 
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
    except RuntimeError: # Handle WebSocket is not connected error
        connected_clients.remove(websocket)

