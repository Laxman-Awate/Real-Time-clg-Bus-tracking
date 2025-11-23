
import json
import os
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production to your frontend's actual origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to load data from JSON files
def load_data(filename: str):
    backend_dir = Path(__file__).parent
    file_path = backend_dir / "data" / f"{filename}.json"
    file_path.parent.mkdir(exist_ok=True)
    if not file_path.exists():
        with open(file_path, 'w') as f:
            json.dump([], f)
    with open(file_path, 'r') as f:
        return json.load(f)

# Helper function to save data to JSON files
def save_data(filename: str, data):
    backend_dir = Path(__file__).parent
    file_path = backend_dir / "data" / f"{filename}.json"
    file_path.parent.mkdir(exist_ok=True)
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

class AppState:
    def __init__(self):
        self.students_db = load_data("students")
        self.drivers_db = load_data("drivers")
        self.buses_db = load_data("buses")
        self.routes_db = load_data("routes")
        self.admin_db_raw = load_data("users")
        self.admin_db = {user["username"]: user for user in self.admin_db_raw if user["role"] == "admin"}
        self.active_trips: Dict[int, Dict[str, Any]] = {}
        self.dummy_all_bus_locations: Dict[int, Dict[str, Any]] = {
            1: {"lat": 18.5204, "lng": 73.8567, "speed": 20, "driver_name": "Driver A", "estimated_arrival": "10:30 AM", "bus_name": "Bus 1"},
            2: {"lat": 18.6000, "lng": 73.9000, "speed": 25, "driver_name": "Driver B", "estimated_arrival": "10:45 AM", "bus_name": "Bus 2"},
            3: {"lat": 18.7000, "lng": 73.7000, "speed": 15, "driver_name": "Driver C", "estimated_arrival": "11:00 AM", "bus_name": "Bus 3"}
        }

def get_db(request: Request) -> AppState:
    return request.app.state.db

app.state.db = AppState() # Initialize the AppState and store it in app.state.db
app.state.load_data = load_data # Attach load_data utility to app.state
app.state.save_data = save_data # Attach save_data utility to app.state

def ensure_admin_user():
    users = app.state.db.admin_db_raw
    
    if not any(user for user in users if user.get("username") == "admin" and user.get("role") == "admin"):
        admin_user = {
            "username": "admin",
            "password": "adminpass",
            "role": "admin"
        }
        users.append(admin_user)
        app.state.save_data("users", users)
        app.state.db.admin_db["admin"] = admin_user

ensure_admin_user()

# --- Start of Tracking Router (integrated) ---

# In-memory dictionary to store connected WebSocket clients
connected_clients: List[WebSocket] = []

# Function to simulate bus movement
async def simulate_bus_movement(app_state: Any):
    while True:
        for bus_id in app_state.dummy_all_bus_locations:
            if bus_id not in app_state.active_trips:
                app_state.dummy_all_bus_locations[bus_id]["lat"] += 0.0001
                app_state.dummy_all_bus_locations[bus_id]["lng"] += 0.0001
        
        message = json.dumps({"bus_locations": list(app_state.dummy_all_bus_locations.values())})
        clients_to_remove = []
        for client in connected_clients:
            try:
                await client.send_text(message)
            except WebSocketDisconnect:
                clients_to_remove.append(client)
            except RuntimeError:
                clients_to_remove.append(client)
        for client in clients_to_remove:
            if client in connected_clients:
                connected_clients.remove(client)

        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulate_bus_movement(app.state.db))

# OAuth2PasswordBearer for token extraction (from auth.py)
SECRET_KEY = "super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class UserInDB(BaseModel):
    username: str
    hashed_password: str
    role: str

class StudentLogin(BaseModel):
    student_id: str
    password: str

class StudentRegister(BaseModel):
    student_id: str
    password: str
    name: str

class DriverLogin(BaseModel):
    username: str
    password: str

class DriverRegister(BaseModel):
    username: str
    password: str
    name: str
    phone: str

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminRegister(BaseModel):
    username: str
    password: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Dependency to get the current user based on the token
async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception
    
    user = None
    if token_data.role == "student":
        students_db = request.app.state.db.students_db
        user_data = next((s for s in students_db if s["student_id"] == token_data.username), None)
        if user_data:
            user = {"id": user_data["id"], "student_id": user_data["student_id"], "name": user_data["name"], "role": token_data.role}
    elif token_data.role == "driver":
        drivers_db = request.app.state.db.drivers_db
        user_data = next((d for d in drivers_db if d["username"] == token_data.username), None)
        if user_data:
            user = {"id": user_data["id"], "username": user_data["username"], "name": user_data["name"], "phone": user_data["phone"], "role": token_data.role}
    elif token_data.role == "admin":
        admin_db = request.app.state.db.admin_db
        user_data = admin_db.get(token_data.username)
        if user_data:
            user = {"username": user_data["username"], "role": token_data.role}

    if user is None:
        raise credentials_exception
    return user


# --- Start of Auth Router (integrated) ---
@app.post("/auth/login/student", response_model=Token, tags=["Authentication"])
async def login_student(form_data: StudentLogin, request: Request):
    students_db = request.app.state.db.students_db
    student = next((s for s in students_db if s["student_id"] == form_data.student_id), None)
    if not student or student["password"] != form_data.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect student ID or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": student["student_id"], "role": "student"},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer", "user_name": student["name"], "student_id": student["student_id"]}

@app.post("/auth/register/student", tags=["Authentication"])
async def register_student(new_student: StudentRegister, request: Request):
    students_db = request.app.state.db.students_db
    if any(s["student_id"] == new_student.student_id for s in students_db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student ID already registered")
    
    new_id = max([s["id"] for s in students_db]) + 1 if students_db else 1
    
    student_data = new_student.dict()
    student_data["id"] = new_id
    
    students_db.append(student_data)
    request.app.state.save_data("students", students_db)
    
    return {"message": "Student registered successfully", "student_id": student_data["student_id"], "name": student_data["name"], "id": student_data["id"]}

@app.post("/auth/register/driver", tags=["Authentication"])
async def register_driver(new_driver: DriverRegister, request: Request):
    drivers_db = request.app.state.db.drivers_db
    if any(d["username"] == new_driver.username for d in drivers_db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered as a driver")
    
    new_id = max([d["id"] for d in drivers_db]) + 1 if drivers_db else 1
    
    driver_data = new_driver.dict()
    driver_data["id"] = new_id
    driver_data["role"] = "driver"
    
    drivers_db.append(driver_data)
    request.app.state.save_data("drivers", drivers_db)
    
    return {"message": "Driver registered successfully", "username": driver_data["username"], "name": driver_data["name"], "id": driver_data["id"]}

@app.post("/auth/register/admin", tags=["Authentication"])
async def register_admin(new_admin: AdminRegister, request: Request):
    admin_db_raw = request.app.state.db.admin_db_raw
    admin_db = request.app.state.db.admin_db
    if any(u["username"] == new_admin.username and u["role"] == "admin" for u in admin_db_raw):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered as an admin")
    
    admin_data = new_admin.dict()
    admin_data["role"] = "admin"
    
    admin_db_raw.append(admin_data)
    request.app.state.save_data("users", admin_db_raw)
    
    admin_db[admin_data["username"]] = admin_data
    
    return {"message": "Admin registered successfully", "username": admin_data["username"], "role": admin_data["role"]}

@app.post("/auth/login/driver", response_model=dict, tags=["Authentication"])
async def login_driver(form_data: DriverLogin, request: Request):
    drivers_db = request.app.state.db.drivers_db
    driver = next((d for d in drivers_db if d["username"] == form_data.username), None)
    if not driver or driver["password"] != form_data.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": driver["username"], "id": driver.get("id"), "role": "driver", "name": driver.get("name")},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "driver_id": driver.get("id"),
        "name": driver.get("name", "Driver"),
        "username": driver.get("username")
    }

@app.post("/auth/login/admin", response_model=Token, tags=["Authentication"])
async def login_admin(form_data: AdminLogin, request: Request):
    admin_db = request.app.state.db.admin_db
    admin = admin_db.get(form_data.username)
    if not admin or admin["password"] != form_data.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin["username"], "role": "admin"},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


# --- Start of Student Router (integrated) ---
@app.get("/students/buses", tags=["Students"])
async def get_all_buses(request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db
    drivers_db = request.app.state.db.drivers_db
    
    buses_info = []
    for bus in buses_db:
        route_id = bus.get("route_id") # Safely get route_id
        route = next((r for r in routes_db if r["id"] == route_id), None)
        driver_id = bus.get("assigned_driver_id") # Corrected to assigned_driver_id
        driver = next((d for d in drivers_db if d["id"] == driver_id), None)
        
        bus_data = {
            "id": bus["id"],
            "name": bus["bus_number"],
            "route_name": route.get("name") if route else "N/A", # Safely access route name
            "start_time": bus.get("departure_time", "9:00 AM"),
            "stops": route.get("stops") if route else [], # Safely access stops
            "driver_name": driver.get("name") if driver else "N/A", # Safely access driver name
            "bus_number": bus.get("bus_number", f"GIT-{str(bus["id"]).zfill(3)}"), # Ensure bus_number is always present
            "capacity": bus.get("capacity", 40) # Ensure capacity is always present
        }
        buses_info.append(bus_data)
    return buses_info

@app.get("/students/{student_id}", tags=["Students"])
async def get_student_details(student_id: str, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student" and current_user["student_id"] != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    students_db = request.app.state.db.students_db
    student = next((s for s in students_db if s["student_id"] == student_id), None)

    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    
    # In a real app, you might get assigned_bus_id from a separate assignment table
    # For now, let's assume the first bus from buses_db is assigned for simplicity.
    # Or, if student object itself has an 'assigned_bus_id', use that.
    assigned_bus_id = student.get("assigned_bus_id", None)
    if assigned_bus_id is None and request.app.state.db.buses_db:
        assigned_bus_id = request.app.state.db.buses_db[0]["id"] # Default to first bus if not explicitly assigned

    return {"student_id": student["student_id"], "name": student["name"], "assigned_bus_id": assigned_bus_id}

@app.get("/students/bus/{bus_id}", tags=["Students"])
async def get_bus_details(bus_id: int, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db
    drivers_db = request.app.state.db.drivers_db

    bus = next((b for b in buses_db if b["id"] == bus_id), None)
    if not bus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found")
    
    route_id = bus.get("route_id")
    route = next((r for r in routes_db if r["id"] == route_id), None)
    driver_id = bus.get("assigned_driver_id")
    driver = next((d for d in drivers_db if d["id"] == driver_id), None)

    bus_data = {
        "id": bus["id"],
        "name": bus.get("bus_number", f"GIT-{str(bus["id"]).zfill(3)}"), # Use bus_number and default
        "route_name": route.get("name") if route else "N/A", # Safely access route name
        "start_time": bus.get("departure_time", "9:00 AM"), # Safely access departure time
        "stops": route.get("stops") if route else [], # Safely access stops
        "driver_name": driver.get("name") if driver else "N/A", # Safely access driver name
        "bus_number": bus.get("bus_number", f"KA{bus_id}ABC"), # Default if not present
        "capacity": bus.get("capacity", 40) # Default capacity
    }
    return bus_data

@app.get("/students/track/{bus_id}", tags=["Students"])
async def track_bus(bus_id: int, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")

    dummy_all_bus_locations = request.app.state.db.dummy_all_bus_locations
    if bus_id not in dummy_all_bus_locations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found or not currently tracking")
    
    return dummy_all_bus_locations[bus_id]


# --- Start of Driver Router (integrated) ---
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
    bus_details: BusDetailsResponse

@app.get("/driver/my_bus", response_model=BusDetailsResponse, tags=["Driver"])
async def get_my_bus(request: Request, current_user: Any = Depends(get_current_user)):
    print(f"Accessing /driver/my_bus endpoint. Current User: {current_user}")
    if current_user["role"] != "driver":
        print(f"Forbidden access to /driver/my_bus for role: {current_user["role"]}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user.get("id")
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

    first_stop_lat = route["stops"][0]["lat"] if route["stops"] else None
    first_stop_lng = route["stops"][0]["lng"] if route["stops"] else None

    if first_stop_lat is None or first_stop_lng is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route stops with coordinates not found.")

    return {
        "id": assigned_bus.get("id"),
        "bus_number": assigned_bus.get("bus_number"),
        "route_name": route.get("name"),
        "starting_point": assigned_bus.get("starting_point"),
        "departure_time": assigned_bus.get("departure_time"),
        "estimated_arrival": assigned_bus.get("estimated_arrival"),
        "route_stops": route.get("stops"),
        "latitude": first_stop_lat,
        "longitude": first_stop_lng,
        "capacity": assigned_bus.get("capacity", 0)
    }

@app.post("/driver/trip/start", tags=["Driver"])
async def start_trip(request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user["id"]
    active_trips = request.app.state.db.active_trips
    if driver_id in active_trips:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip already active for this driver")

    assigned_bus_data = await get_my_bus(request, current_user)
    start_lat = assigned_bus_data["latitude"]
    start_lng = assigned_bus_data["longitude"]
    bus_id = assigned_bus_data["id"]
    
    active_trips[driver_id] = {"latitude": start_lat, "longitude": start_lng, "bus_id": bus_id}
    return {"message": "Trip started successfully", "initial_location": {"latitude": start_lat, "longitude": start_lng}}

@app.post("/driver/trip/update", tags=["Driver"])
async def update_trip_location(location: UpdateLocation, request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user["id"]
    active_trips = request.app.state.db.active_trips
    if driver_id not in active_trips:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active trip for this driver. Start a trip first.")
    
    active_trips[driver_id]["latitude"] = location.latitude
    active_trips[driver_id]["longitude"] = location.longitude
    return {"message": "Location updated successfully", "current_location": location.dict()}

@app.post("/driver/trip/end", tags=["Driver"])
async def end_trip(request: Request, current_user: Any = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this resource")
    
    driver_id = current_user["id"]
    active_trips = request.app.state.db.active_trips
    if driver_id not in active_trips:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active trip to end for this driver")
    
    del active_trips[driver_id]
    return {"message": "Trip ended successfully"}


# --- Start of Admin Router (integrated) ---
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
    route_stops: Optional[List[RouteStop]] = None
    route_id: Optional[int] = None
    name: Optional[str] = None
    driver_id: Optional[int] = None

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

@app.get("/admin/stats", tags=["Admin"])
async def get_admin_stats(request: Request, current_user: Any = Depends(get_admin_user)):
    return {
        "total_buses": len(request.app.state.db.buses_db),
        "total_drivers": len(request.app.state.db.drivers_db),
        "total_routes": len(request.app.state.db.routes_db),
        "total_students": len(request.app.state.db.students_db),
    }

@app.get("/admin/buses", tags=["Admin"])
async def get_all_buses_admin(request: Request, current_user: Any = Depends(get_admin_user)):
    buses_with_details = []
    for bus in request.app.state.db.buses_db:
        driver = next((d for d in request.app.state.db.drivers_db if d.get("id") == bus.get("assigned_driver_id")), None)
        route = next((r for r in request.app.state.db.routes_db if r.get("id") == bus.get("route_id")), None)
        bus_details = {
            **bus,
            "driver_name": driver["name"] if driver else "N/A",
            "route_name": route["name"] if route else "N/A",
        }
        buses_with_details.append(bus_details)
    return buses_with_details

@app.post("/admin/buses", tags=["Admin"])
async def add_bus(bus: BusCreate, request: Request, current_user: Any = Depends(get_admin_user)):
    buses_db = request.app.state.db.buses_db
    new_id = max([b["id"] for b in buses_db]) + 1 if buses_db else 1
    new_bus = bus.dict()
    new_bus["id"] = new_id
    buses_db.append(new_bus)
    request.app.state.save_data("buses", buses_db)
    return new_bus

@app.put("/admin/buses/{bus_id}", tags=["Admin"])
async def update_bus(bus_id: int, bus_update: BusUpdate, request: Request, current_user: Any = Depends(get_admin_user)):
    buses_db = request.app.state.db.buses_db
    routes_db = request.app.state.db.routes_db
    bus_found = False
    for idx, bus in enumerate(buses_db):
        if bus["id"] == bus_id:
            updated_bus_data = bus.copy()
            updated_bus_data.update(bus_update.dict(exclude_unset=True, exclude={'route_stops'}))
            
            if bus_update.route_stops is not None:
                route_id_to_update = updated_bus_data.get("route_id")
                if route_id_to_update:
                    route_found = False
                    for r_idx, route in enumerate(routes_db):
                        if route["id"] == route_id_to_update:
                            updated_route = route.copy()
                            updated_route["stops"] = [stop.dict() for stop in bus_update.route_stops]
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

@app.delete("/admin/buses/{bus_id}", tags=["Admin"])
async def delete_bus(bus_id: int, request: Request, current_user: Any = Depends(get_admin_user)):
    buses_db = request.app.state.db.buses_db
    initial_len = len(buses_db)
    request.app.state.db.buses_db = [bus for bus in buses_db if bus["id"] != bus_id]
    if len(request.app.state.db.buses_db) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found")
    request.app.state.save_data("buses", request.app.state.db.buses_db)
    return {"message": "Bus deleted successfully"}

@app.get("/admin/drivers", tags=["Admin"])
async def get_all_drivers(request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    return [{k: v for k, v in driver.items() if k != "password"} for driver in drivers_db]

@app.post("/admin/drivers/add", tags=["Admin"])
async def add_driver(driver: DriverCreate, request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    new_id = max([d["id"] for d in drivers_db]) + 1 if drivers_db else 1
    new_driver = driver.dict()
    new_driver["id"] = new_id
    drivers_db.append(new_driver)
    request.app.state.save_data("drivers", drivers_db)
    return {k: v for k, v in new_driver.items() if k != "password"}

@app.put("/admin/drivers/{driver_id}", tags=["Admin"])
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

@app.delete("/admin/drivers/{driver_id}", tags=["Admin"])
async def delete_driver(driver_id: int, request: Request, current_user: Any = Depends(get_admin_user)):
    drivers_db = request.app.state.db.drivers_db
    initial_len = len(drivers_db)
    request.app.state.db.drivers_db = [driver for driver in drivers_db if driver["id"] != driver_id]
    if len(request.app.state.db.drivers_db) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    request.app.state.save_data("drivers", request.app.state.db.drivers_db)
    return {"message": "Driver deleted successfully"}

@app.get("/admin/routes", tags=["Admin"])
async def get_all_routes(request: Request, current_user: Any = Depends(get_admin_user)):
    return request.app.state.db.routes_db

@app.post("/admin/routes/add", tags=["Admin"])
async def add_route(route: RouteCreate, request: Request, current_user: Any = Depends(get_admin_user)):
    routes_db = request.app.state.db.routes_db
    new_id = max([r["id"] for r in routes_db]) + 1 if routes_db else 1
    new_route = route.dict()
    new_route["id"] = new_id
    routes_db.append(new_route)
    request.app.state.save_data("routes", routes_db)
    return new_route

@app.put("/admin/routes/{route_id}", tags=["Admin"])
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

@app.delete("/admin/routes/{route_id}", tags=["Admin"])
async def delete_route(route_id: int, request: Request, current_user: Any = Depends(get_admin_user)):
    routes_db = request.app.state.db.routes_db
    initial_len = len(routes_db)
    request.app.state.db.routes_db = [route for route in routes_db if route["id"] != route_id]
    if len(request.app.state.db.routes_db) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    request.app.state.save_data("routes", request.app.state.db.routes_db)
    return {"message": "Route deleted successfully"}


# --- Root endpoint ---
@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the College Bus Tracking API"}

# --- Tracking Endpoints (integrated) ---
@app.get("/tracking/bus/{bus_id}", tags=["Tracking"])
async def get_bus_current_location(bus_id: int, request: Request, current_user: Any = Depends(get_current_user)):
    active_trips = request.app.state.db.active_trips
    dummy_all_bus_locations = request.app.state.db.dummy_all_bus_locations
    drivers_db = request.app.state.db.drivers_db

    if bus_id in active_trips and active_trips[bus_id].get("bus_id") == bus_id:
        location_data = {
            "bus_id": bus_id,
            "lat": active_trips[bus_id]["latitude"],
            "lng": active_trips[bus_id]["longitude"],
            "speed": 30,
            "driver_name": next((d["name"] for d in drivers_db if d["id"] == active_trips[bus_id].get("driver_id")), "N/A"),
            "estimated_arrival": "Realtime Update"
        }
        return location_data
    
    if bus_id in dummy_all_bus_locations:
        return dummy_all_bus_locations[bus_id]

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bus not found or not currently tracking")

@app.get("/tracking/all", tags=["Tracking"])
async def get_all_buses_current_location(request: Request, current_user: Any = Depends(get_current_user)):
    active_trips = request.app.state.db.active_trips
    dummy_all_bus_locations = request.app.state.db.dummy_all_bus_locations
    buses_db = request.app.state.db.buses_db
    drivers_db = request.app.state.db.drivers_db

    all_locations = []
    for bus in buses_db:
        bus_id = bus["id"]
        if bus_id in active_trips and active_trips[bus_id].get("bus_id") == bus_id:
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
            location_data = {"bus_id": bus_id, "lat": 0.0, "lng": 0.0, "speed": 0, "driver_name": "N/A", "estimated_arrival": "N/A", "bus_name": bus["name"]}
        all_locations.append(location_data)

    return all_locations

@app.websocket("/tracking/ws/bus_locations")
async def websocket_bus_locations(websocket: WebSocket, request: Request):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
    except RuntimeError:
        connected_clients.remove(websocket)
