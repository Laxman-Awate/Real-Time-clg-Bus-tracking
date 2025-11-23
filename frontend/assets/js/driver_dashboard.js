// driver_dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the main map
    initMainMap();
    
    // Load driver data and update UI
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

    const API_BASE_URL = 'http://localhost:8001';
    let map;
    let busMarker;
    let polyline;
    let locationUpdateInterval;
    let currentDriverId; // To be fetched from the authenticated user
    let assignedBusId;
    let assignedRouteStops = [];

    // Initialize the main map with Leaflet
    function initMainMap() {
        try {
            const mapContainer = document.getElementById('driver-dashboard-map');
            if (!mapContainer) {
                console.error('Map container not found');
                return;
            }

            // Default coordinates (KLS GIT)
            const defaultLat = 15.4589;
            const defaultLng = 74.5084;

            // Initialize the map and store it in window for global access
            window.map = L.map('driver-dashboard-map').setView([defaultLat, defaultLng], 14);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(window.map);

            // Add a default marker (will be updated with real data)
            window.busMarker = L.marker([defaultLat, defaultLng], {
                icon: L.icon({
                    iconUrl: '../assets/images/bus_icon.png',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                })
            }).addTo(window.map);
            
            window.busMarker.bindPopup('Your Bus').openPopup();
            
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
    
    // Update the map with a new location
    function updateMapLocation(lat, lng, routePath = []) {
        if (!map) return;
        
        // Update bus marker position
        if (busMarker) {
            busMarker.setLatLng([lat, lng]);
        }
        
        // Update route polyline if path is provided
        if (routePath && routePath.length > 1) {
            // Convert Google Maps path format to Leaflet's LatLng format if needed
            const latLngs = routePath.map(point => 
                Array.isArray(point) ? point : [point.lat, point.lng]
            );
            
            // Remove existing polyline if any
            if (polyline) {
                map.removeLayer(polyline);
            }
            
            // Create new polyline
            polyline = L.polyline(latLngs, {
                color: '#4285F4',
                weight: 4,
                opacity: 1.0,
                lineJoin: 'round'
            }).addTo(map);
            
            // Fit map to the route bounds
            map.fitBounds(polyline.getBounds());
        } else {
            // Just center the map on the current location
            map.setView([lat, lng], map.getZoom());
        }
    }

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login.html';
            throw new Error('No access token found.');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    };

    const fetchDriverDashboardData = async () => {
        console.log("Fetching driver dashboard data...");
        try {
            // Get dashboard data
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/driver/dashboard`, { headers });
            console.log(`Response from /driver/dashboard: ${response.status} ${response.statusText}`);
            const data = await response.json();
            console.log('Data from /driver/dashboard:', data);
            
            if (!response.ok) {
                throw new Error(data.detail || 'Failed to fetch dashboard data');
            }

            // Update UI with the received data
            if (data.assigned_bus) {
                const driverBusCode = document.getElementById('driver-bus-code');
                if (driverBusCode) {
                    driverBusCode.textContent = data.assigned_bus;
                }
            }

            if (data.assigned_route) {
                const routeName = document.getElementById('driver-bus-route-name');
                if (routeName) {
                    routeName.textContent = data.assigned_route;
                }
            }

            // Create a default route since we don't have a real one
            const defaultRoute = [
                [15.4589, 74.5084],  // KLS GIT
                [15.4689, 74.5184],  // Some other point
                [15.4789, 74.5284]   // Another point
            ];
            
            // Update the map with the default route
            updateMapLocation(defaultRoute[0][0], defaultRoute[0][1], defaultRoute);
        } catch (error) {
            console.error('Error fetching driver dashboard data:', error);
            // Show error message to the user
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-error';
            errorDiv.textContent = 'Failed to load dashboard data. Please try again.';
            const container = document.querySelector('.dashboard-container, main');
            if (container) {
                container.prepend(errorDiv);
            }
            return; // Exit the function to prevent further execution in case of error
        }
    };

    const startTrip = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/driver/trip/start`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to start trip');
            }

            driverBusStatusSpan.textContent = 'Active';
            driverBusStatusSpan.classList.remove('status-inactive');
            driverBusStatusSpan.classList.add('status-active');
            startTripBtn.disabled = true;
            endTripBtn.disabled = false;

            if (!assignedRouteStops || assignedRouteStops.length === 0) {
                throw new Error('No route stops available');
            }

            let currentLat = assignedRouteStops[0].lat;
            let currentLng = assignedRouteStops[0].lng;
            let stopIndex = 0;

            // Clear any existing interval
            if (locationUpdateInterval) {
                clearInterval(locationUpdateInterval);
            }

            locationUpdateInterval = setInterval(async () => {
                try {
                    // Simulate movement along the route stops
                    if (stopIndex < assignedRouteStops.length - 1) {
                        const nextStop = assignedRouteStops[stopIndex + 1];
                        const latDiff = (nextStop.lat - currentLat) / 10; // 10 steps to next stop
                        const lngDiff = (nextStop.lng - currentLng) / 10;

                        currentLat += latDiff;
                        currentLng += lngDiff;

                        // Check if close to next stop
                        if (Math.abs(nextStop.lat - currentLat) < 0.0001 && 
                            Math.abs(nextStop.lng - currentLng) < 0.0001) {
                            stopIndex++;
                        }
                    } else {
                        // Loop back to start
                        stopIndex = 0;
                        currentLat = assignedRouteStops[0].lat;
                        currentLng = assignedRouteStops[0].lng;
                    }

                    // Update backend with new location
                    await updateLocation(currentLat, currentLng);
                    
                    // Update marker position using Leaflet
                    if (busMarker) {
                        busMarker.setLatLng([currentLat, currentLng]);
                    }
                    
                    // Center the map on the current position
                    if (map) {
                        map.setView([currentLat, currentLng]);
                    }

                } catch (error) {
                    console.error('Error updating location:', error);
                    clearInterval(locationUpdateInterval);
                }
            }, 1000); // Update every second

        } catch (error) {
            console.error('Error starting trip:', error);
            // Show error to user
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-error';
            errorDiv.textContent = error.message || 'Failed to start trip. Please try again.';
            const container = document.querySelector('.dashboard-container, main');
            if (container) {
                container.prepend(errorDiv);
            }
        }
    };

    const endTrip = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/driver/trip/end`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to end trip');
            }

            clearInterval(locationUpdateInterval);
            driverBusStatusSpan.textContent = 'Inactive';
            driverBusStatusSpan.classList.remove('status-active');
            driverBusStatusSpan.classList.add('status-inactive');
            startTripBtn.disabled = false;
            endTripBtn.disabled = true;
            
            // Reset to start using Leaflet methods
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
            // Show error to user
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-error';
            errorDiv.textContent = 'Failed to end trip. Please try again.';
            const container = document.querySelector('.dashboard-container, main');
            if (container) {
                container.prepend(errorDiv);
            }
        }
    };
    startTripBtn.addEventListener('click', startTrip);
    endTripBtn.addEventListener('click', endTrip);

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '../login.html';
    });

    fetchDriverDashboardData();
});

