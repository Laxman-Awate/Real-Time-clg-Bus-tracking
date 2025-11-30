import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, onSnapshot, getDoc, doc, addDoc, updateDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// admin_buses.js
// Removed API_BASE_URL as we are now using Firebase

let busManagementList;
let busIdInput;
let busNumberInput;
let routeNameInput;
let startingPointInput;
let assignedDriverSelect;
let departureTimeInput;
let estimatedArrivalInput;
let routeStopsContainer;
let addStopBtn;
let closeBusFormBtn;
let busFormContainer; 
let addBusBtn; // Declare addBusBtn globally

let isAdmin = false;

// Function to show toast messages
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container') || (() => {
        const div = document.createElement('div');
        div.id = 'toast-container';
        document.body.appendChild(div);
        return div;
    })();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Function declarations (hoisted)
function editBus(id, bus_number, route_name, starting_point, assigned_driver_id, departure_time, estimated_arrival, route_stops) {
    if (!isAdmin) {
        showToast('You do not have permission to edit buses.', 'error');
        return;
    }
    document.getElementById('bus-form-container').querySelector('h3').textContent = 'Edit Bus';
    busIdInput.value = id || '';
    busNumberInput.value = bus_number || '';
    routeNameInput.value = route_name || '';
    startingPointInput.value = starting_point || '';
    // Ensure assignedDriverSelect has the correct option before setting value
    if (assignedDriverSelect.querySelector(`option[value="${assigned_driver_id}"]`)) {
        assignedDriverSelect.value = assigned_driver_id;
    } else {
        assignedDriverSelect.value = ''; // Reset if driver not found
    }
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
    if (!isAdmin) {
        showToast('You do not have permission to delete buses.', 'error');
        return;
    }
    if (!id || !confirm('Are you sure you want to delete this bus? This action cannot be undone.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "buses", id));
        showToast('Bus deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting bus:', error);
        showToast('An error occurred while deleting the bus.', 'error');
    }
}

// Real-time listener for buses
function subscribeToBuses() {
    const q = query(collection(db, "buses"), orderBy("bus_number"));
    onSnapshot(q, (snapshot) => {
        const buses = [];
        snapshot.forEach((doc) => {
            buses.push({ id: doc.id, ...doc.data() });
        });
        formatBusData(buses);
    }, (error) => {
        console.error("Error fetching buses: ", error);
        showToast('Failed to load buses.', 'error');
    });
}

async function fetchDrivers() {
    // In a real Firebase app, drivers would likely be stored in Firestore as well.
    // For this exercise, we'll simulate fetching them or load from a predefined list.
    // For now, return a dummy driver.
    return [{ id: "driver1", name: "John Doe" }]; 
    /*
    const driversCol = collection(db, "drivers");
    const driverSnapshot = await getDocs(driversCol);
    const drivers = driverSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return drivers;
    */
}

async function populateDriversDropdown() {
    const drivers = await fetchDrivers();
        assignedDriverSelect.innerHTML = '<option value="">Select Driver</option>';
        drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = driver.name;
            assignedDriverSelect.appendChild(option);
        });
}

function formatBusData(buses) {
    busManagementList.innerHTML = '';
    if (buses.length === 0) {
        busManagementList.innerHTML = '<p>No buses found.</p>';
        return;
    }
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
                <p class="route-stops-short">Stops: ${bus.route_stops ? bus.route_stops.map(stop => stop.name).join(', ') : 'N/A'}</p>
            </div>
            <div class="bus-fleet-actions">
                <button class="btn secondary-btn edit-bus-btn" data-bus-id="${bus.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn danger-btn delete-bus-btn" data-bus-id="${bus.id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        `;
        busManagementList.appendChild(busCard);

        busCard.querySelector('.edit-bus-btn').addEventListener('click', (event) => {
            const busId = event.currentTarget.dataset.busId;
            const selectedBus = buses.find(b => b.id === busId);
            if (selectedBus) {
            editBus(
                    selectedBus.id,
                    selectedBus.bus_number || '',
                    selectedBus.route_name || '',
                    selectedBus.starting_point || '',
                    selectedBus.assigned_driver_id || '',
                    selectedBus.departure_time || '',
                    selectedBus.estimated_arrival || '',
                    // When editing, pass only the names of the stops, not lat/lng if we are not using them anymore in the UI
                    selectedBus.route_stops ? selectedBus.route_stops.map(stop => ({ name: stop.name })) : []
            );
            }
        });
        busCard.querySelector('.delete-bus-btn').addEventListener('click', (event) => {
            const busId = event.currentTarget.dataset.busId;
            deleteBus(busId);
        });
    });
    // Enable/disable add bus button based on admin status
    if (addBusBtn) {
        addBusBtn.style.display = isAdmin ? 'block' : 'none';
    }
}

async function saveBus(event) {
    event.preventDefault();
    
    if (!isAdmin) {
        showToast('You do not have permission to add/edit buses.', 'error');
        return;
    }
    
    const id = busIdInput.value;
    const bus_number = busNumberInput.value.trim();
    const route_name = routeNameInput.value.trim();
    const starting_point = startingPointInput.value.trim();
    const assigned_driver_id = assignedDriverSelect.value || null; 
    const departure_time = departureTimeInput.value.trim();
    const estimated_arrival = estimatedArrivalInput.value.trim();
    const route_stops_elements = routeStopsContainer.querySelectorAll('.route-stop-item');
    const route_stops = Array.from(route_stops_elements).map(stopGroup => {
        const nameInput = stopGroup.querySelector('.route-stop-name-input');
        return {
            name: nameInput ? nameInput.value.trim() : '',
            // Removed lat and lng as they are no longer asked in the UI
        };
    }).filter(stop => stop.name !== ''); 

    if (!bus_number || !route_name || !starting_point || !departure_time || !estimated_arrival || route_stops.length === 0) {
        showToast('Please fill in all required fields and add at least one route stop.', 'error');
        return;
    }

    const busData = { 
        bus_number, 
        route_name, 
        starting_point, 
        assigned_driver_id, 
        departure_time, 
        estimated_arrival, 
        route_stops,
        createdAt: id ? busData.createdAt : new Date().toISOString(), 
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (id) {
            await updateDoc(doc(db, "buses", id), busData);
            showToast('Bus updated successfully!', 'success');
        } else {
            await addDoc(collection(db, "buses"), busData);
            showToast('Bus added successfully!', 'success');
        }

        busFormContainer.style.display = 'none';

    } catch (error) {
        console.error('Error saving bus:', error);
        showToast('An error occurred while saving the bus.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    busManagementList = document.getElementById('bus-management-list');
    addBusBtn = document.getElementById('add-bus-btn'); // Assign to global
    busFormContainer = document.getElementById('bus-form-container'); 
    const busForm = document.getElementById('bus-form');
    const cancelBusFormBtn = document.getElementById('cancel-bus-form');
    const logoutBtn = document.getElementById('logout-btn');

    // Assign DOM Elements to global variables
    busIdInput = document.getElementById('bus-id');
    busNumberInput = document.getElementById('bus-number');
    routeNameInput = document.getElementById('route-name');
    startingPointInput = document.getElementById('starting-point');
    assignedDriverSelect = document.getElementById('assigned-driver');
    departureTimeInput = document.getElementById('departure-time');
    estimatedArrivalInput = document.getElementById('estimated-arrival');
    routeStopsContainer = document.getElementById('route-stops-container');
    addStopBtn = document.getElementById('add-stop-btn');
    closeBusFormBtn = document.getElementById('close-bus-form');

    // Add toast container to body if it doesn't exist
    if (!document.getElementById('toast-container')) {
        const toastDiv = document.createElement('div');
        toastDiv.id = 'toast-container';
        document.body.appendChild(toastDiv);
    }

    // Event Listeners
    if (addBusBtn) {
    addBusBtn.addEventListener('click', () => {
            if (!isAdmin) {
                showToast('You do not have permission to add buses.', 'error');
                return;
            }
            document.getElementById('bus-form-container').querySelector('h3').textContent = 'Add New Bus';
        busForm.reset();
        busIdInput.value = '';
            routeStopsContainer.innerHTML = ''; 
            addStopField(); 
        busFormContainer.style.display = 'block';
    });
    }

    cancelBusFormBtn.addEventListener('click', () => {
        busFormContainer.style.display = 'none';
    });

    busForm.addEventListener('submit', saveBus);
    closeBusFormBtn.addEventListener('click', () => {
        busFormContainer.style.display = 'none';
    });
    addStopBtn.addEventListener('click', () => addStopField({ name: '' }));

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('firebase_uid');
            window.location.href = '../login.html';
        } catch (error) {
            console.error('Error during logout:', error);
            showToast('Failed to logout.', 'error');
        }
    });

    // Firebase Auth State Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, check their role
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                isAdmin = userData.isAdmin || false;
                if (!isAdmin) {
                    showToast('You do not have administrative privileges.', 'error');
                    // Optionally redirect non-admin users or hide admin features
                    // window.location.href = '../student/dashboard.html'; 
                }
            } else {
                console.warn("User document not found for UID:", user.uid);
                isAdmin = false;
            }
            populateDriversDropdown();
            subscribeToBuses(); // Start real-time listener for buses
        } else {
            // User is signed out, redirect to login page
            window.location.href = '../login.html';
        }
    });

});

// New function to add a route stop input field
function addStopField(stop = { name: '' }) { // Changed default stop object
    const stopInputGroup = document.createElement('div');
    stopInputGroup.className = 'input-group route-stop-item';
    stopInputGroup.innerHTML = `
        <input type="text" class="route-stop-name-input" placeholder="Stop Name" value="${stop.name}" required>
        <button type="button" class="remove-stop-btn text-btn">&times;</button>
    `;
    routeStopsContainer.appendChild(stopInputGroup);

    stopInputGroup.querySelector('.remove-stop-btn').addEventListener('click', (event) => {
        event.target.closest('.route-stop-item').remove();
    });
}