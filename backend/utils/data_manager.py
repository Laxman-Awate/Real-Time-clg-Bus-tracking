import json
import os
from pathlib import Path

# Helper function to load data from JSON files
def load_data(filename: str):
    # Get the directory of the main.py file (which is the backend root)
    backend_dir = Path(__file__).parent.parent
    # Create the full path to the data file
    file_path = backend_dir / "data" / f"{filename}.json"
    
    # Create the data directory if it doesn't exist
    file_path.parent.mkdir(exist_ok=True)
    
    # If the file doesn't exist, create it with an empty list
    if not file_path.exists():
        with open(file_path, 'w') as f:
            json.dump([], f)
    
    # Now load and return the data
    with open(file_path, 'r') as f:
        return json.load(f)

# Helper function to save data to JSON files
def save_data(filename: str, data):
    # Get the directory of the main.py file (which is the backend root)
    backend_dir = Path(__file__).parent.parent
    # Create the full path to the data file
    file_path = backend_dir / "data" / f"{filename}.json"
    
    # Create the data directory if it doesn't exist
    file_path.parent.mkdir(exist_ok=True)
    
    # Save the data
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

