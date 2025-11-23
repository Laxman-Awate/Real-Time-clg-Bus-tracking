
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel


router = APIRouter()

# Secret key to sign JWT tokens (replace with a strong, securely stored key in production)
SECRET_KEY = "super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2PasswordBearer for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# Pydantic models for data validation
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
    # You can add more fields here like email, phone, etc., if needed

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


# Authentication endpoints
@router.post("/login/student", response_model=Token, tags=["Authentication"])
async def login_student(form_data: StudentLogin, request: Request):
    students_db = request.app.state.db.students_db # Access from db object
    student = next((s for s in students_db if s["student_id"] == form_data.student_id), None)
    if not student or student["password"] != form_data.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect student ID or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": student["student_id"], "role": "student"},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer", "user_name": student["name"], "student_id": student["student_id"]}

@router.post("/register/student", tags=["Authentication"])
async def register_student(new_student: StudentRegister, request: Request):
    students_db = request.app.state.db.students_db # Access from db object
    # Check if student_id already exists
    if any(s["student_id"] == new_student.student_id for s in students_db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student ID already registered")
    
    # Assign a new ID
    new_id = max([s["id"] for s in students_db]) + 1 if students_db else 1
    
    student_data = new_student.dict()
    student_data["id"] = new_id
    
    students_db.append(student_data)
    request.app.state.save_data("students", students_db) # Persist the updated data using app.state.save_data
    
    # Return basic info, excluding password
    return {"message": "Student registered successfully", "student_id": student_data["student_id"], "name": student_data["name"], "id": student_data["id"]}

@router.post("/register/driver", tags=["Authentication"])
async def register_driver(new_driver: DriverRegister, request: Request):
    drivers_db = request.app.state.db.drivers_db # Access from db object
    # Check if username already exists
    if any(d["username"] == new_driver.username for d in drivers_db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered as a driver")
    
    # Assign a new ID
    new_id = max([d["id"] for d in drivers_db]) + 1 if drivers_db else 1
    
    driver_data = new_driver.dict()
    driver_data["id"] = new_id
    driver_data["role"] = "driver" # Explicitly set role
    
    drivers_db.append(driver_data)
    request.app.state.save_data("drivers", drivers_db) # Persist the updated data using app.state.save_data
    
    # Return basic info, excluding password
    return {"message": "Driver registered successfully", "username": driver_data["username"], "name": driver_data["name"], "id": driver_data["id"]}

@router.post("/register/admin", tags=["Authentication"])
async def register_admin(new_admin: AdminRegister, request: Request):
    admin_db_raw = request.app.state.db.admin_db_raw # Access from db object
    admin_db = request.app.state.db.admin_db # Access from db object
    # Check if username already exists
    if any(u["username"] == new_admin.username and u["role"] == "admin" for u in admin_db_raw):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered as an admin")
    
    admin_data = new_admin.dict()
    admin_data["role"] = "admin" # Explicitly set role
    
    admin_db_raw.append(admin_data) # Add to raw users list
    request.app.state.save_data("users", admin_db_raw) # Persist the updated data using app.state.save_data
    
    # Update the in-memory admin_db as well
    admin_db[admin_data["username"]] = admin_data
    
    # Return basic info, excluding password
    return {"message": "Admin registered successfully", "username": admin_data["username"], "role": admin_data["role"]}

@router.post("/login/driver", response_model=dict, tags=["Authentication"])
async def login_driver(form_data: DriverLogin, request: Request):
    drivers_db = request.app.state.db.drivers_db # Access from db object
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

@router.post("/login/admin", response_model=Token, tags=["Authentication"])
async def login_admin(form_data: AdminLogin, request: Request):
    admin_db = request.app.state.db.admin_db # Access from db object
    admin = admin_db.get(form_data.username)
    if not admin or admin["password"] != form_data.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin["username"], "role": "admin"},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}

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
    
    # In a real application, you would fetch the user from a database
    user = None
    if token_data.role == "student":
        students_db = request.app.state.db.students_db # Access from db object
        user_data = next((s for s in students_db if s["student_id"] == token_data.username), None)
        if user_data:
            user = {"id": user_data["id"], "student_id": user_data["student_id"], "name": user_data["name"], "role": token_data.role}
    elif token_data.role == "driver":
        drivers_db = request.app.state.db.drivers_db # Access from db object
        user_data = next((d for d in drivers_db if d["username"] == token_data.username), None)
        if user_data:
            user = {"id": user_data["id"], "username": user_data["username"], "name": user_data["name"], "phone": user_data["phone"], "role": token_data.role}
    elif token_data.role == "admin":
        admin_db = request.app.state.db.admin_db # Access from db object
        user_data = admin_db.get(token_data.username)
        if user_data:
            user = {"username": user_data["username"], "role": token_data.role}

    if user is None:
        raise credentials_exception
    return user

