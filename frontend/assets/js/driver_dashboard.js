import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// driver_dashboard.js

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

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const welcomeMessage = document.getElementById('welcome-message');
    const driverBusCodeDisplay = document.getElementById('driver-bus-code');
    const driverBusStatusSpan = document.getElementById('driver-bus-status');
    const driverBusRouteNameDisplay = document.getElementById('driver-bus-route-name');
    const driverBusDepartureTimeDisplay = document.getElementById('driver-bus-departure-time');
    const driverBusCapacityDisplay = document.getElementById('driver-bus-capacity');
    const startTripBtn = document.getElementById('start-trip-btn');
    const endTripBtn = document.getElementById('end-trip-btn');
    const routeStartPointDisplay = document.getElementById('route-start-point');
    const routeDestinationDisplay = document.getElementById('route-destination');
    const driverRouteStopsList = document.getElementById('driver-route-stops-list');
    const driverDashboardMapDiv = document.getElementById('driver-dashboard-map');
    const logoutBtn = document.getElementById('logout-btn');

    let map;
    let busMarker;
    let polyline;
    let locationUpdateInterval;
    let currentDriverUid; 
    let assignedBusId = null;
    let assignedRouteStops = [];

    // Initialize the main map with Leaflet
    function initMainMap(initialLat = 15.4589, initialLng = 74.5084) { // Default to KLS GIT coordinates
        try {
            const mapContainer = document.getElementById('driver-dashboard-map');
            if (!mapContainer) {
                console.error('Map container not found');
                return;
            }
            
            if (map) {
                map.remove();
                map = null;
            }

            map = L.map('driver-dashboard-map').setView([initialLat, initialLng], 14);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            busMarker = L.marker([initialLat, initialLng], {
                icon: L.icon({
                    iconUrl: '../assets/images/bus_icon.png',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                })
            }).addTo(map);
            
            busMarker.bindPopup('Your Bus').openPopup();
            
            return true;
        } catch (error) {
            console.error('Error initializing map:', error);
            const mapContainer = document.getElementById('driver-dashboard-map');
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div style="padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 10px;">
                        <h3>Map Initialization Error</h3>
                        <p>Failed to initialize the map. Please try refreshing the page.</p>
                        <p>Error: ${error.message}</p>
                    </div>
                `;
            }
            return false;
        }
    }
    
    function updateMapLocation(lat, lng, routePath = []) {
        if (!map) {
            initMainMap(lat, lng);
            return;
        }
        
        if (busMarker) {
            busMarker.setLatLng([lat, lng]);
        }
        
        if (routePath && routePath.length > 1) {
            const latLngs = routePath.map(point => 
                Array.isArray(point) ? point : [point.lat, point.lng]
            );
            
            if (polyline) {
                map.removeLayer(polyline);
            }
            
            polyline = L.polyline(latLngs, {
                color: '#4285F4',
                weight: 4,
                opacity: 1.0,
                lineJoin: 'round'
            }).addTo(map);
            
            map.fitBounds(polyline.getBounds());
        } else {
            map.setView([lat, lng], map.getZoom());
        }
    }

    let unsubscribeFromBusDetails = null; // To store the unsubscribe function for bus details

    const subscribeToDriverDashboardData = async (uid) => {
        currentDriverUid = uid; // Store the current driver's UID
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            welcomeMessage.textContent = `Welcome back, ${userData.name || 'Driver'}`;
            assignedBusId = userData.assigned_bus_id || null;

            if (assignedBusId) {
                unsubscribeFromBusDetails = onSnapshot(doc(db, "buses", assignedBusId), (busDoc) => {
                    if (busDoc.exists()) {
                        const busData = { id: busDoc.id, ...busDoc.data() };
                        renderBusAndRouteDetails(busData);
                        // Initialize map with bus's first stop location if not already
                        if (!map && busData.route_stops && busData.route_stops.length > 0) {
                            initMainMap(busData.route_stops[0].lat, busData.route_stops[0].lng);
                        }
                    } else {
                        console.warn("Assigned bus not found in Firestore:", assignedBusId);
                        showToast('Assigned bus not found.', 'error');
                        renderNoBusDetails();
                    }
                }, (error) => {
                    console.error("Error fetching assigned bus details:", error);
                    showToast('Failed to load bus details.', 'error');
                    renderNoBusDetails();
                });
            } else {
                console.warn("No bus assigned to this driver.");
                showToast('No bus assigned to you.', 'info');
                renderNoBusDetails();
                initMainMap(); // Initialize map with default location even if no bus assigned
            }
        } else {
            console.warn("Driver document not found for UID:", uid);
            showToast('Driver profile not found. Please contact support.', 'error');
            signOut(auth);
            window.location.href = '../login.html';
        }
    };

    const renderBusAndRouteDetails = (busDetails) => {
        driverBusCodeDisplay.textContent = busDetails.bus_number || `GIT-${busDetails.id}`;
        driverBusRouteNameDisplay.textContent = busDetails.route_name || 'N/A';
        driverBusDepartureTimeDisplay.textContent = busDetails.departure_time || 'N/A';
        driverBusCapacityDisplay.textContent = busDetails.capacity ? `${busDetails.capacity} passengers` : 'N/A';
        
        routeStartPointDisplay.textContent = busDetails.starting_point || 'N/A';
        // Assuming destination is the last stop in route_stops array
        routeDestinationDisplay.textContent = busDetails.route_stops && busDetails.route_stops.length > 0 
            ? busDetails.route_stops[busDetails.route_stops.length - 1].name : 'N/A';

        driverRouteStopsList.innerHTML = '';
        assignedRouteStops = []; // Clear and repopulate
        if (busDetails.route_stops && busDetails.route_stops.length > 0) {
            busDetails.route_stops.forEach((stop, index) => {
                assignedRouteStops.push({ lat: stop.lat, lng: stop.lng, name: stop.name });
                const li = document.createElement('li');
                let iconSrc = "../assets/images/map_pin_blue.png";
                if (index === 0) iconSrc = "../assets/images/map_pin_green.png";
                if (index === busDetails.route_stops.length - 1) iconSrc = "../assets/images/map_pin_red.png";
                li.className = index === 0 ? 'start-point' : (index === busDetails.route_stops.length - 1 ? 'destination-point' : '');
                li.innerHTML = `<img src="${iconSrc}" alt="Map Pin"> ${stop.name}`;
                driverRouteStopsList.appendChild(li);
            });
            // Initial map update with the full route
            updateMapLocation(assignedRouteStops[0].lat, assignedRouteStops[0].lng, assignedRouteStops);
        } else {
            driverRouteStopsList.innerHTML = '<li>No route stops available.</li>';
        }

        // Enable/disable trip buttons based on whether a bus is assigned
        startTripBtn.disabled = !assignedBusId;
        endTripBtn.disabled = !assignedBusId;
    };

    const renderNoBusDetails = () => {
        driverBusCodeDisplay.textContent = "N/A";
        driverBusStatusSpan.textContent = 'Inactive';
        driverBusStatusSpan.classList.remove('status-active');
        driverBusStatusSpan.classList.add('status-inactive');
        driverBusRouteNameDisplay.textContent = 'N/A';
        driverBusDepartureTimeDisplay.textContent = 'N/A';
        driverBusCapacityDisplay.textContent = 'N/A';
        routeStartPointDisplay.textContent = 'N/A';
        routeDestinationDisplay.textContent = 'N/A';
        driverRouteStopsList.innerHTML = '<li>No route information available.</li>';
        startTripBtn.disabled = true;
        endTripBtn.disabled = true;
    };

    const startTrip = async () => {
        if (!assignedBusId) {
            showToast('No bus assigned to start a trip.', 'error');
            return;
        }
        if (assignedRouteStops.length === 0) {
            showToast('No route defined for the assigned bus.', 'error');
            return;
        }

        try {
            driverBusStatusSpan.textContent = 'Active';
            driverBusStatusSpan.classList.remove('status-inactive');
            driverBusStatusSpan.classList.add('status-active');
            startTripBtn.disabled = true;
            endTripBtn.disabled = false;

            let currentLat = assignedRouteStops[0].lat;
            let currentLng = assignedRouteStops[0].lng;
            let stopIndex = 0;
            let segmentProgress = 0; // 0 to 1 for progress along current segment
            const animationSteps = 50; // Number of steps for smooth animation between stops

            // Clear any existing interval
            if (locationUpdateInterval) {
                clearInterval(locationUpdateInterval);
            }

            locationUpdateInterval = setInterval(async () => {
                if (stopIndex < assignedRouteStops.length - 1) {
                    const startPoint = assignedRouteStops[stopIndex];
                    const endPoint = assignedRouteStops[stopIndex + 1];

                    currentLat = startPoint.lat + (endPoint.lat - startPoint.lat) * (segmentProgress / animationSteps);
                    currentLng = startPoint.lng + (endPoint.lng - startPoint.lng) * (segmentProgress / animationSteps);

                    segmentProgress++;

                    if (segmentProgress > animationSteps) {
                        segmentProgress = 0;
                        stopIndex++;
                        if (stopIndex >= assignedRouteStops.length -1) {
                           // Reached destination, optionally end trip or loop
                           console.log("Reached destination!");
                           // For continuous demo, loop back to start
                           stopIndex = 0;
                           showToast('Trip completed, restarting route for demo.','info');
                        }
                    }
                } else { // At the last stop, or no stops beyond current
                    // For demo purposes, if at last stop, reset to start or keep at last stop
                    // Here, we'll loop back to start after a delay
                    stopIndex = 0;
                    segmentProgress = 0;
                    currentLat = assignedRouteStops[0].lat;
                    currentLng = assignedRouteStops[0].lng;
                    showToast('Trip completed, restarting route for demo.','info');
                }

                try {
                    // Update Firestore with new location and timestamp
                    await updateDoc(doc(db, "bus_locations", assignedBusId.toString()), {
                        latitude: currentLat,
                        longitude: currentLng,
                        timestamp: new Date().toISOString(),
                        bus_id: assignedBusId, // Store bus_id for easier querying
                        driver_uid: currentDriverUid // Store driver_uid
                    }, { merge: true });
                    
                    updateMapLocation(currentLat, currentLng, assignedRouteStops);

                } catch (error) {
                    console.error('Error updating bus location in Firestore:', error);
                    showToast('Failed to update location.', 'error');
                    clearInterval(locationUpdateInterval);
                }
            }, 1000); // Update every second

        } catch (error) {
            console.error('Error starting trip:', error);
            showToast(error.message || 'Failed to start trip. Please try again.', 'error');
        }
    };

    const endTrip = async () => {
        if (!assignedBusId) {
            showToast('No bus assigned to end a trip.', 'error');
            return;
        }

        try {
            clearInterval(locationUpdateInterval);
            locationUpdateInterval = null;

            // Update Firestore to mark bus as inactive or remove location
            await updateDoc(doc(db, "bus_locations", assignedBusId.toString()), {
                latitude: null,
                longitude: null,
                timestamp: new Date().toISOString(),
                is_active: false
            }, { merge: true });

            driverBusStatusSpan.textContent = 'Inactive';
            driverBusStatusSpan.classList.remove('status-active');
            driverBusStatusSpan.classList.add('status-inactive');
            startTripBtn.disabled = false;
            endTripBtn.disabled = true;
            showToast('Trip ended successfully!', 'success');
            
            if (busMarker && assignedRouteStops && assignedRouteStops.length > 0) {
                const startPoint = assignedRouteStops[0];
                if (startPoint.lat && startPoint.lng) {
                    busMarker.setLatLng([startPoint.lat, startPoint.lng]);
                    if (map) {
                        map.setView([startPoint.lat, startPoint.lng], map.getZoom());
                    }
                }
            }

        } catch (error) {
            console.error('Error ending trip:', error);
            showToast(error.message || 'Failed to end trip. Please try again.', 'error');
        }
    };

    // Event Listeners
    if (startTripBtn) startTripBtn.addEventListener('click', startTrip);
    if (endTripBtn) endTripBtn.addEventListener('click', endTrip);

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (locationUpdateInterval) clearInterval(locationUpdateInterval);
                if (unsubscribeFromBusDetails) unsubscribeFromBusDetails();
                await signOut(auth);
                localStorage.removeItem('firebase_uid');
                localStorage.removeItem('user_role');
                window.location.href = '../login.html';
            } catch (error) {
                console.error('Error during logout:', error);
                showToast('Failed to logout.', 'error');
            }
        });
    }

    // Initial calls and Firebase Auth State Listener
    // Initialize map immediately with default location
    initMainMap();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000); // Update every minute

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (userData.role === 'driver') {
                    subscribeToDriverDashboardData(user.uid);
                } else {
                    showToast('Access Denied: You are not authorized to view the driver dashboard.', 'error');
                    await signOut(auth);
                    window.location.href = '../login.html';
                }
            } else {
                console.warn("Driver document not found for UID:", user.uid);
                showToast('Driver profile not found. Please contact support.', 'error');
                await signOut(auth);
                window.location.href = '../login.html';
            }
        } else {
            showToast('You are not logged in. Redirecting to login.', 'info');
            window.location.href = '../login.html';
        }
    });
});

