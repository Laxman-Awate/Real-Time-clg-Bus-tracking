// admin_buses.js
const API_BASE_URL = 'http://localhost:8001'; // Define API_BASE_URL globally

let busManagementList;
let busIdInput;
let busNameInput;
let routeAssignedInput;
let driverAssignedInput;
let busNumberInput;
let routeNameInput;
let startingPointInput;
let assignedDriverSelect;
let departureTimeInput;
let estimatedArrivalInput;
let routeStopsContainer;
let addStopBtn;
let closeBusFormBtn;
let busFormContainer; // Declare globally

// Function declarations (hoisted)
function editBus(id, bus_number, route_name, starting_point, assigned_driver_id, departure_time, estimated_arrival, route_stops) {
    busIdInput.value = id || '';
    busNumberInput.value = bus_number || '';
    routeNameInput.value = route_name || '';
    startingPointInput.value = starting_point || '';
    assignedDriverSelect.value = assigned_driver_id || '';
    departureTimeInput.value = departure_time || '';
    estimatedArrivalInput.value = estimated_arrival || '';

    // Clear existing route stops and add new ones
    routeStopsContainer.innerHTML = '';
    if (route_stops && route_stops.length > 0) {
        route_stops.forEach(stop => addStopField(stop));
    } else {
        addStopField(); // Add an empty one if no stops
    }
    
    busFormContainer.style.display = 'block';
    busFormContainer.scrollIntoView({ behavior: 'smooth' });
}

async function deleteBus(id) {
    if (!id || !confirm('Are you sure you want to delete this bus? This action cannot be undone.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/admin/buses/${id}`, { // Changed to admin/buses
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to delete bus');
        }

        fetchBuses();
        alert('Bus deleted successfully!');
    } catch (error) {
        console.error('Error deleting bus:', error);
        alert(error.message || 'An error occurred while deleting the bus');
    }
}

async function fetchBuses() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '../login.html'; // Corrected path
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/buses`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            console.error('HTTP Error during fetchBuses:', response.status, response.statusText);
            const errorData = await response.json().catch(() => ({}));
            console.error('Error data:', errorData);
            if (response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user_role');
                window.location.href = '../login.html'; // Corrected path
            }
            throw new Error(errorData.detail || `Failed to fetch buses (Status: ${response.status})`);
        }

        const buses = await response.json();
        formatBusData(buses);

    } catch (error) {
        console.error('Error fetching buses:', error);
        alert('Failed to load buses. Please try again.');
    }
}

async function fetchDrivers() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/admin/drivers`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch drivers');
        }
        const drivers = await response.json();
        assignedDriverSelect.innerHTML = '<option value="">Select Driver</option>';
        drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = driver.name;
            assignedDriverSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching drivers:', error);
        alert('Failed to load drivers.');
    }
}

function formatBusData(buses) {
    busManagementList.innerHTML = '';
    buses.forEach(bus => {
        const busCard = document.createElement('div');
        busCard.className = 'bus-fleet-item card';
        busCard.innerHTML = `
            <div class="bus-icon-details">
                <img src="../assets/images/bus_icon_small.png" alt="Bus Icon">
                <div>
                    <h3>${bus.bus_number || `Bus ${bus.id}`}</h3>
                    <p>Route: ${bus.route_name || 'N/A'}</p>
                    <p>Driver: ${bus.driver_name || 'Not assigned'}</p>
                </div>
            </div>
            <div class="bus-fleet-route-info">
                <p class="route-name">Start: ${bus.starting_point || 'N/A'}</p>
                <p class="route-stops-short">Dep: ${bus.departure_time || 'N/A'} - Arr: ${bus.estimated_arrival || 'N/A'}</p>
                <p class="route-stops-short">Stops: ${bus.route_stops ? bus.route_stops.join(', ') : 'N/A'}</p>
            </div>
            <div class="bus-fleet-actions">
                <button class="btn secondary-btn edit-bus-btn" data-bus='${JSON.stringify(bus)}'>
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteBus(${bus.id})" class="btn danger-btn">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        `;
        busManagementList.appendChild(busCard);

        const editButton = busCard.querySelector('.edit-bus-btn');
        editButton.addEventListener('click', (event) => {
            const busData = JSON.parse(event.currentTarget.dataset.bus);
            editBus(
                busData.id,
                busData.bus_number || '',
                busData.route_name || '',
                busData.starting_point || '',
                busData.assigned_driver_id || 0,
                busData.departure_time || '',
                busData.estimated_arrival || '',
                busData.route_stops || []
            );
        });
    });
}

function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

async function saveBus(event) {
    event.preventDefault();
    
    const id = busIdInput.value;
    const bus_number = busNumberInput.value.trim();
    const route_name = routeNameInput.value.trim();
    const starting_point = startingPointInput.value.trim();
    const assigned_driver_id = assignedDriverSelect.value ? parseInt(assignedDriverSelect.value) : null; // Can be null if no driver selected
    const departure_time = departureTimeInput.value.trim();
    const estimated_arrival = estimatedArrivalInput.value.trim();
    const route_stops_elements = routeStopsContainer.querySelectorAll('.route-stop-item');
    const route_stops = Array.from(route_stops_elements).map(stopGroup => {
        const nameInput = stopGroup.querySelector('.route-stop-name-input');
        const latInput = stopGroup.querySelector('.route-stop-lat-input');
        const lngInput = stopGroup.querySelector('.route-stop-lng-input');
        return {
            name: nameInput ? nameInput.value.trim() : '',
            lat: latInput && latInput.value ? parseFloat(latInput.value) : 0.0,
            lng: lngInput && lngInput.value ? parseFloat(lngInput.value) : 0.0,
        };
    }).filter(stop => stop.name !== ''); // Filter out empty stops

    if (!bus_number || !route_name || !starting_point || !departure_time || !estimated_arrival || route_stops.length === 0) {
        alert('Please fill in all required fields and add at least one route stop.');
        return;
    }

    const busData = { 
        bus_number, 
        route_name, 
        starting_point, 
        assigned_driver_id, 
        departure_time, 
        estimated_arrival, 
        route_stops 
    };
    
    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? 
            `${API_BASE_URL}/admin/buses/${id}` : 
            `${API_BASE_URL}/admin/buses`;

        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(busData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to save bus');
        }

        busFormContainer.style.display = 'none';
        await fetchBuses();
        alert(`Bus ${id ? 'updated' : 'added'} successfully!`);

    } catch (error) {
        console.error('Error saving bus:', error);
        alert(error.message || 'An error occurred while saving the bus');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    busManagementList = document.getElementById('bus-management-list');
    const addBusBtn = document.getElementById('add-bus-btn');
    busFormContainer = document.getElementById('bus-form-container'); // Assign to global
    const busForm = document.getElementById('bus-form');
    const cancelBusFormBtn = document.getElementById('cancel-bus-form');
    const logoutBtn = document.getElementById('logout-btn');

    // Assign DOM Elements to global variables
    busIdInput = document.getElementById('bus-id');
    busNameInput = document.getElementById('bus-name');
    routeAssignedInput = document.getElementById('route-assigned');
    driverAssignedInput = document.getElementById('driver-assigned');
    busNumberInput = document.getElementById('bus-number'); // New
    routeNameInput = document.getElementById('route-name'); // New
    startingPointInput = document.getElementById('starting-point'); // New
    assignedDriverSelect = document.getElementById('assigned-driver'); // New
    departureTimeInput = document.getElementById('departure-time'); // New
    estimatedArrivalInput = document.getElementById('estimated-arrival'); // New
    routeStopsContainer = document.getElementById('route-stops-container'); // New
    addStopBtn = document.getElementById('add-stop-btn'); // New
    closeBusFormBtn = document.getElementById('close-bus-form'); // New

    // Make functions available globally
    window.editBus = editBus;
    window.deleteBus = deleteBus;

    // Event Listeners
    addBusBtn.addEventListener('click', () => {
        busForm.reset();
        busIdInput.value = '';
        routeStopsContainer.innerHTML = ''; // Clear stops when adding new bus
        addStopField(); // Add an empty stop field for new bus
        busFormContainer.style.display = 'block';
    });

    cancelBusFormBtn.addEventListener('click', () => {
        busFormContainer.style.display = 'none';
    });

    busForm.addEventListener('submit', saveBus);
    closeBusFormBtn.addEventListener('click', () => {
        busFormContainer.style.display = 'none';
    });
    addStopBtn.addEventListener('click', () => addStopField({ name: '', lat: '', lng: '' })); // Pass empty object for new stop

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '../login/admin.html';
    });

    // Initialize
    fetchBuses();
    fetchDrivers();
    // No initial addStopField() call here, it's handled when adding/editing
});

// New function to add a route stop input field
function addStopField(stop = { name: '', lat: '', lng: '' }) {
    const stopInputGroup = document.createElement('div');
    stopInputGroup.className = 'input-group route-stop-item';
    stopInputGroup.innerHTML = `
        <input type="text" class="route-stop-name-input" placeholder="Stop Name" value="${stop.name}" required>
        <input type="number" class="route-stop-lat-input" placeholder="Latitude" value="${stop.lat}" step="any" required>
        <input type="number" class="route-stop-lng-input" placeholder="Longitude" value="${stop.lng}" step="any" required>
        <button type="button" class="remove-stop-btn text-btn">&times;</button>
    `;
    routeStopsContainer.appendChild(stopInputGroup);

    stopInputGroup.querySelector('.remove-stop-btn').addEventListener('click', (event) => {
        event.target.closest('.route-stop-item').remove();
    });
}