// student_dashboard.js
// import busSchedule from '../data/busSchedule.js'; // This import needs to be handled differently if it's still required

document.addEventListener('DOMContentLoaded', () => {
    const studentNameSpan = document.getElementById('student-name');
    const studentEmailSpan = document.getElementById('student-email');
    const studentPhoneSpan = document.getElementById('student-phone');
    const currentTimeDisplay = document.getElementById('current-time');

    const busCodeDisplay = document.getElementById('bus-code');
    const busStatusSpan = document.getElementById('bus-status');
    const busRouteNameDisplay = document.getElementById('bus-route-name');
    const busDepartureTimeDisplay = document.getElementById('bus-departure-time');
    const busEtaCollegeDisplay = document.getElementById('bus-eta-college');
    const busCurrentTimeDisplay = document.getElementById('bus-current-time');
    const busActiveMessageDisplay = document.getElementById('bus-active-message');

    const driverNameDisplay = document.getElementById('driver-name');
    const busCapacityDisplay = document.getElementById('bus-capacity');

    const routeStopsList = document.getElementById('route-stops-list');
    const dashboardMapDiv = document.getElementById('dashboard-map');

    const API_BASE_URL = 'http://localhost:8001';
    let map; // Declared here for local scope
    let busMarker; // Declared here for local scope
    let polyline;
    let currentBusId = 1; // Assuming a student is assigned to bus ID 1 for now

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

    const updateCurrentTime = () => {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', hour12: true };
        currentTimeDisplay.textContent = now.toLocaleTimeString('en-US', options);
        busCurrentTimeDisplay.textContent = now.toLocaleTimeString('en-US', options);
    };

    // Initialize the main map with Leaflet
    function initLeafletMap(initialLat, initialLng) {
        // Ensure the map container is visible and has dimensions
        const mapElement = document.getElementById('dashboard-map');
        if (!mapElement) {
            console.error('Map container not found');
            return;
        }

        // Clear any existing map instance only if it's already initialized on the global window object
        if (window.map) {
            window.map.remove();
            window.map = null;
        }

        // Set container styles (ensure it has dimensions before initializing map)
        mapElement.style.height = '400px';
        mapElement.style.width = '100%';
        mapElement.style.borderRadius = '8px';
        mapElement.style.minHeight = '300px';

        // Initialize the map with a slight delay to ensure container is rendered
        // This timeout is crucial for Leaflet to correctly calculate map container dimensions
        setTimeout(() => {
            // Create a simple div icon for the bus marker
            const busIcon = L.divIcon({
                className: 'bus-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15]
            });

            // Initialize the map
            window.map = L.map('dashboard-map', {
                center: [initialLat, initialLng],
                zoom: 15,
                zoomControl: true,
                scrollWheelZoom: true
            });

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                detectRetina: true
            }).addTo(window.map);

            // Add the bus marker
            window.busMarker = L.marker([initialLat, initialLng], {
                icon: busIcon,
                title: 'Your Bus',
                zIndexOffset: 1000
            }).addTo(window.map);

            // Add popup to the marker
            window.busMarker.bindPopup('Your Bus').openPopup();

            // Force a resize to ensure proper rendering
            setTimeout(() => {
                if (window.map) {
                    window.map.invalidateSize({ pan: false });
                }
            }, 100);
        }, 100); // Initial map creation delay
    }

    // Update the map with a new location (assumes map is already initialized)
    function updateLeafletMapLocation(lat, lng, routePath = []) {
        // Ensure the map container has the right dimensions (in case it was hidden or resized)
        const mapElement = document.getElementById('dashboard-map');
        if (mapElement) {
            mapElement.style.height = '400px';
            mapElement.style.width = '100%';
        }

        // If map is not initialized, try to initialize it (should ideally happen once in fetchDashboardData)
        if (!window.map) {
            console.warn('Map not initialized when updateLeafletMapLocation called. Initializing now...');
            initLeafletMap(lat, lng);
            // After initialization, wait a bit for the map to render before updating elements
            setTimeout(() => {
                updateMapWithLocation(lat, lng, routePath);
            }, 200);
            return;
        }

        updateMapWithLocation(lat, lng, routePath);
    }

    // Helper function to update map with location and route
    function updateMapWithLocation(lat, lng, routePath = []) {
        if (!window.map) {
            console.error('Map object is null in updateMapWithLocation.');
            return; // Cannot update if map is not initialized
        }

        // Update bus marker position
        if (window.busMarker) {
            window.busMarker.setLatLng([lat, lng]);
        } else {
            // If marker somehow doesn't exist, create it (should not happen if init is correct)
            const busIcon = L.icon({
                iconUrl: '../assets/images/bus_marker.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });
            window.busMarker = L.marker([lat, lng], {
                icon: busIcon,
                title: 'Your Bus',
                zIndexOffset: 1000
            }).addTo(window.map);
            window.busMarker.bindPopup('Your Bus').openPopup();
        }

        // Update the route polyline if path is provided
        if (routePath && routePath.length > 0) {
            // Remove existing polyline if any
            if (window.polyline) {
                window.map.removeLayer(window.polyline);
            }

            // Create new polyline
            window.polyline = L.polyline(routePath, {
                color: '#3498db',
                weight: 5,
                opacity: 0.7,
                lineJoin: 'round'
            }).addTo(window.map);

            // Fit the map to show the entire route with padding
            try {
                const bounds = window.polyline.getBounds();
                if (bounds.isValid()) {
                    // Add padding to the bounds
                    const padding = L.point(50, 50);
                    const sw = window.map.project(bounds.getSouthWest());
                    const ne = window.map.project(bounds.getNorthEast());

                    sw._subtract(padding);
                    ne._add(padding);

                    window.map.fitBounds(
                        L.latLngBounds(
                            window.map.unproject(sw),
                            window.map.unproject(ne)
                        ),
                        { animate: false } // Set animate to false
                    );
                } else {
                    console.warn('Polyline bounds are invalid, cannot fit map to bounds.');
                    // Fallback to centering on bus if bounds are invalid
                    window.map.setView([lat, lng], window.map.getZoom());
                }
            } catch (e) {
                console.error('Error fitting map to bounds:', e);
                // Fallback to simple fitBounds if there's an error
                window.map.fitBounds(window.polyline.getBounds(), {
                    padding: [50, 50],
                    animate: false
                });
            }
        } else {
            // If no route path, just center on the bus
            window.map.setView([lat, lng], window.map.getZoom());
        }

        // Force a resize event to ensure proper rendering
        setTimeout(() => {
            if (window.map) {
                window.map.invalidateSize({ pan: false });
            }
        }, 100); // Map invalidation delay
    }

    const fetchDashboardData = async () => {
        try {
            // Set student info from localStorage or use defaults
            const studentName = localStorage.getItem('user_name') || 'Student';
            const studentEmail = localStorage.getItem('user_email') || 'student@git.edu';
            const studentPhone = localStorage.getItem('user_phone') || '9876543210';

            studentNameSpan.textContent = studentName;
            studentEmailSpan.textContent = studentEmail;
            studentPhoneSpan.textContent = studentPhone;

            // Fetch bus schedule from API
            const headers = getAuthHeaders();
            const busScheduleResponse = await fetch(`${API_BASE_URL}/students/buses`, { headers });
            const busScheduleData = await busScheduleResponse.json();

            if (!busScheduleResponse.ok) {
                throw new Error(busScheduleData.detail || 'Failed to fetch bus schedule');
            }

            const studentId = localStorage.getItem('student_id'); // Assuming student_id is stored in localStorage
            // Find the bus details for the current student's assigned bus, or the first bus if not assigned
            let busDetails = null;
            if (studentId) {
                const student = await fetch(`${API_BASE_URL}/students/${studentId}`, { headers }); // Assuming an endpoint to get student details
                if (student.ok) {
                    const studentData = await student.json();
                    const assignedBusId = studentData.assigned_bus_id; // Assuming student data has assigned_bus_id
                    if (assignedBusId) {
                        busDetails = busScheduleData.find(bus => bus.id === assignedBusId);
                    }
                }
            }

            // Fallback to the first bus if no specific bus is assigned or found
            if (!busDetails && busScheduleData.length > 0) {
                busDetails = busScheduleData[0];
            }

            if (!busDetails) {
                // Handle case where no bus details are found at all
                console.warn('No bus details found for the student, or no buses available.');
                // Optionally, display a message to the user or redirect
                busCodeDisplay.textContent = "N/A";
                busRouteNameDisplay.textContent = "Route: N/A";
                busDepartureTimeDisplay.textContent = "N/A";
                driverNameDisplay.textContent = "Driver N/A";
                busCapacityDisplay.textContent = "N/A";
                routeStopsList.innerHTML = '<li>No route information available.</li>';
                busActiveMessageDisplay.textContent = "No bus assigned or data unavailable.";
                // Set a default location for the map if no bus is found
                if (!window.map) {
                    initLeafletMap(15.85, 74.55); // Default KLS GIT coordinates
                }
                return; // Exit the function as no bus data to process
            }

            // Update currentBusId for live tracking
            currentBusId = busDetails.id;

            // Update bus information
            busCodeDisplay.textContent = `GIT-${String(busDetails.id).padStart(3, '0')}`;
            busRouteNameDisplay.textContent = `Route: ${busDetails.route_name}`;
            busDepartureTimeDisplay.textContent = busDetails.start_time;

            // Set driver information from fetched data
            driverNameDisplay.textContent = busDetails.driver_name || "Driver N/A";
            // Assuming driver phone is not directly in this /student/buses response, add if available
            // driverNameDisplay.setAttribute('data-phone', busDetails.driver_phone || 'N/A');

            // Set bus capacity from fetched data
            busCapacityDisplay.textContent = `${busDetails.capacity || 40} passengers`;

            // Update route stops
            routeStopsList.innerHTML = '';
            if (busDetails.stops && busDetails.stops.length > 0) {
                busDetails.stops.forEach((stop, index) => {
                    const li = document.createElement('li');
                    let iconSrc = "../assets/images/map_pin_blue.png";
                    let label = "";

                    if (index === 0) {
                        iconSrc = "../assets/images/map_pin_green.png";
                        label = "Starting Point";
                        li.classList.add('start-point');
                    } else if (index === busDetails.stops.length - 1) {
                        iconSrc = "../assets/images/map_pin_red.png";
                        label = "Destination";
                        li.classList.add('destination-point');
                    }

                    li.innerHTML = `<img src="${iconSrc}" alt="Map Pin"> ${stop.name}${label ? ` <span class="label">${label}</span>` : ''}`;
                    routeStopsList.appendChild(li);
                });
            } else {
                routeStopsList.innerHTML = '<li>No route stops available.</li>';
            }

            // For demo purposes, set a random ETA between 5-30 minutes
            // This will be overridden by live tracking ETA if available
            const randomEta = Math.floor(Math.random() * 25) + 5;
            const now = new Date();
            now.setMinutes(now.getMinutes() + randomEta);
            busEtaCollegeDisplay.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

            // Initialize Leaflet Map (called only once here)
            if (!window.map && busDetails.stops && busDetails.stops.length > 0) {
                initLeafletMap(busDetails.stops[0].lat, busDetails.stops[0].lng);
            } else if (!window.map) {
                // Default coordinates if no bus stops are available and map not initialized
                const defaultLat = 15.85;
                const defaultLng = 74.55;
                initLeafletMap(defaultLat, defaultLng);
            }
            
            // Always update map location after initialization or data fetch
            if (busDetails.stops && busDetails.stops.length > 0) {
                const leafletRoutePath = busDetails.stops.map(stop => [stop.lat, stop.lng]);
                updateLeafletMapLocation(busDetails.stops[0].lat, busDetails.stops[0].lng, leafletRoutePath);
            } else {
                const defaultLat = 15.85;
                const defaultLng = 74.55;
                updateLeafletMapLocation(defaultLat, defaultLng);
            }

            // Start fetching live bus location for map
            // The setInterval for fetchBusLocationForMap is handled within fetchBusLocationForMap itself.
            fetchBusLocationForMap();

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Handle errors, e.g., redirect to login if token is invalid
            if (error.message.includes('401') || error.message.includes('access token')) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user_role');
                window.location.href = '../login.html';
            }
        }
    };

    const fetchBusLocationForMap = async () => {
        try {
            // For demo purposes, we'll use a default location if the API fails
            const defaultLocation = {
                latitude: 15.85,  // Default to KLS GIT coordinates
                longitude: 74.55
            };

            let locationData = null;

            // Try to get real bus location
            try {
                const response = await fetch(`${API_BASE_URL}/tracking/bus/${currentBusId}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });

                if (response.ok) {
                    locationData = await response.json();
                    if (locationData.latitude && locationData.longitude) {
                        // If we have a valid location, use it
                        updateLeafletMapLocation(locationData.latitude, locationData.longitude);

                        // Update ETA if available
                        if (locationData.estimated_arrival) {
                            busEtaCollegeDisplay.textContent = locationData.estimated_arrival;
                        }

                        // Mark bus as active
                        busStatusSpan.textContent = "Active";
                        busStatusSpan.classList.remove('status-inactive');
                        busStatusSpan.classList.add('status-active');
                        busActiveMessageDisplay.textContent = "Bus is on the way";

                        // Schedule next update
                        setTimeout(fetchBusLocationForMap, 5000); // Call itself after a delay
                        return;
                    }
                }
            } catch (error) {
                console.error('Error fetching bus location:', error);
            }

            // If we get here, use default location and mark as inactive
            updateLeafletMapLocation(defaultLocation.latitude, defaultLocation.longitude);

            // Mark bus as inactive if we couldn't get a valid location
            busStatusSpan.textContent = "Inactive";
            busStatusSpan.classList.remove('status-active');
            busStatusSpan.classList.add('status-inactive');
            busActiveMessageDisplay.textContent = "Bus tracking data unavailable.";

            // Schedule next update even if we're using default location or failed
            setTimeout(fetchBusLocationForMap, 10000); // Call itself after a delay

        } catch (error) {
            console.error('Error in fetchBusLocationForMap:', error);
            // Schedule next update even if there was an error
            setTimeout(fetchBusLocationForMap, 10000);
        }
    };

    // Logout functionality (assuming a logout button or link is added in the HTML)
    const logoutBtn = document.getElementById('logout-btn'); // Ensure this ID exists in your header
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            window.location.href = '../login.html';
        });
    }

    // Initial calls
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000); // Update every minute
    fetchDashboardData();
});

