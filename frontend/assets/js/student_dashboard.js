import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, onSnapshot, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// student_dashboard.js

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

    let map; 
    let busMarker; 
    let polyline;
    let assignedBusId = null; // Will store the bus ID assigned to the student

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

        // Clear any existing map instance
        if (map) {
            map.remove();
            map = null;
        }

        // Set container styles (ensure it has dimensions before initializing map)
        mapElement.style.height = '400px';
        mapElement.style.width = '100%';
        mapElement.style.borderRadius = '8px';
        mapElement.style.minHeight = '300px';

        // Initialize the map with a slight delay to ensure container is rendered
        setTimeout(() => {
            const busIcon = L.divIcon({
                className: 'bus-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15]
            });

            map = L.map('dashboard-map', {
                center: [initialLat, initialLng],
                zoom: 15,
                zoomControl: true,
                scrollWheelZoom: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                detectRetina: true
            }).addTo(map);

            busMarker = L.marker([initialLat, initialLng], {
                icon: busIcon,
                title: 'Your Bus',
                zIndexOffset: 1000
            }).addTo(map);

            busMarker.bindPopup('Your Bus').openPopup();

            setTimeout(() => {
                if (map) {
                    map.invalidateSize({ pan: false });
                }
            }, 100);
        }, 100);
    }

    async function updateLeafletMapLocation(lat, lng, routePath = []) {
        const mapElement = document.getElementById('dashboard-map');
        if (mapElement) {
            mapElement.style.height = '400px';
            mapElement.style.width = '100%';
        }

        if (!map) {
            console.warn('Map not initialized when updateLeafletMapLocation called. Initializing now...');
            initLeafletMap(lat, lng);
            setTimeout(async () => {
                await updateMapWithLocation(lat, lng, routePath);
            }, 200);
            return;
        }

        await updateMapWithLocation(lat, lng, routePath);
    }

    async function getRoadRoute(stops) {
        console.log('Getting road route for stops:', stops);
        if (!stops || stops.length < 2) {
            console.warn('Not enough stops to calculate route');
            return [];
        }
        
        try {
            const coordinates = stops.map(stop => `${stop.lng},${stop.lat}`).join(';');
            const profile = 'driving';
            const url = `https://router.project-osrm.org/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson`;
            
            console.log('Fetching route from OSRM:', url);
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OSRM API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('OSRM response:', data);
            
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                throw new Error('No valid route found in OSRM response');
            }
            
            const routeCoordinates = data.routes[0].geometry.coordinates.map(coord => [
                parseFloat(coord[1].toFixed(6)), 
                parseFloat(coord[0].toFixed(6))  
            ]);
            
            console.log('Generated route with', routeCoordinates.length, 'points');
            return routeCoordinates;
            
        } catch (error) {
            console.error('Error getting road route, falling back to straight line:', error);
            return stops.map(stop => [
                parseFloat(stop.lat.toFixed(6)),
                parseFloat(stop.lng.toFixed(6))
            ]);
        }
    }

    async function updateMapWithLocation(lat, lng, routePath = []) {
        if (!map) {
            console.error('Map object is null in updateMapWithLocation.');
            return; 
        }

        if (busMarker) {
            busMarker.setLatLng([lat, lng]);
        } else {
            const busIcon = L.icon({
                iconUrl: '../assets/images/bus_marker.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });
            busMarker = L.marker([lat, lng], {
                icon: busIcon,
                title: 'Your Bus',
                zIndexOffset: 1000
            }).addTo(map);
            busMarker.bindPopup('Your Bus').openPopup();
        }

        if (routePath && routePath.length > 0) {
            console.log('Updating polyline with path:', routePath);
            if (polyline) {
                map.removeLayer(polyline);
            }

            try {
                const validPath = routePath.filter(coord => 
                    !isNaN(coord[0]) && !isNaN(coord[1]) && 
                    coord[0] >= -90 && coord[0] <= 90 && 
                    coord[1] >= -180 && coord[1] <= 180
                );

                if (validPath.length < 2) {
                    throw new Error('Not enough valid coordinates for polyline');
                }

                polyline = L.polyline(validPath, {
                    color: '#1E88E5',
                    weight: 6,
                    opacity: 0.8,
                    lineJoin: 'round',
                    lineCap: 'round',
                    dashArray: '5, 5',
                    dashOffset: '10'
                }).addTo(map);
                
                console.log('Polyline created successfully');
            } catch (error) {
                console.error('Error creating polyline:', error);
                if (routePath.length >= 2) {
                    polyline = L.polyline([routePath[0], routePath[routePath.length - 1]], {
                        color: '#FF5252',
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '10, 10'
                    }).addTo(map);
                }
            }

            try {
                const bounds = polyline.getBounds();
                if (bounds.isValid()) {
                    const padding = L.point(50, 50);
                    const sw = map.project(bounds.getSouthWest());
                    const ne = map.project(bounds.getNorthEast());

                    sw._subtract(padding);
                    ne._add(padding);

                    map.fitBounds(
                        L.latLngBounds(
                            map.unproject(sw),
                            map.unproject(ne)
                        ),
                        { animate: false } 
                    );
                } else {
                    console.warn('Polyline bounds are invalid, cannot fit map to bounds.');
                    map.setView([lat, lng], map.getZoom());
                }
            } catch (e) {
                console.error('Error fitting map to bounds:', e);
                map.fitBounds(polyline.getBounds(), {
                    padding: [50, 50],
                    animate: false
                });
            }
        } else {
            map.setView([lat, lng], map.getZoom());
        }

        setTimeout(() => {
            if (map) {
                map.invalidateSize({ pan: false });
            }
        }, 100); 
    }

    let unsubscribeFromBusLocation = null; // To store the unsubscribe function for bus location
    let unsubscribeFromAssignedBus = null; // To store the unsubscribe function for assigned bus

    const subscribeToStudentDashboardData = async (uid) => {
        // Fetch student details
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            studentNameSpan.textContent = userData.name || 'Student';
            studentEmailSpan.textContent = userData.email || 'N/A';
            studentPhoneSpan.textContent = userData.phone || 'N/A';
            assignedBusId = userData.assigned_bus_id || null; // Assuming a field 'assigned_bus_id' in user doc

            if (assignedBusId) {
                // Subscribe to assigned bus details
                unsubscribeFromAssignedBus = onSnapshot(doc(db, "buses", assignedBusId), async (busDoc) => {
                    if (busDoc.exists()) {
                        const busDetails = { id: busDoc.id, ...busDoc.data() };
                        renderBusDetails(busDetails);
                        // Start live bus location tracking
                        if (unsubscribeFromBusLocation) {
                            unsubscribeFromBusLocation(); // Unsubscribe from previous bus location if any
                        }
                        subscribeToBusLocation(busDetails.id, busDetails.route_stops);
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
                console.warn("No bus assigned to this student.");
                showToast('No bus assigned to you.', 'info');
                renderNoBusDetails();
            }
        } else {
            console.warn("User document not found for UID:", uid);
            showToast('User profile not found. Please contact support.', 'error');
            // Optionally, sign out if user doc is missing
            signOut(auth);
            window.location.href = '../login.html';
        }
    };

    const renderBusDetails = async (busDetails) => {
        busCodeDisplay.textContent = busDetails.bus_number || `GIT-${busDetails.id}`;
        busRouteNameDisplay.textContent = `Route: ${busDetails.route_name || 'N/A'}`;
        busDepartureTimeDisplay.textContent = busDetails.departure_time || 'N/A';
        driverNameDisplay.textContent = busDetails.driver_name || "Driver N/A"; // Assuming driver_name in bus doc
        busCapacityDisplay.textContent = `${busDetails.capacity || 0} passengers`;

        // Update route stops
        routeStopsList.innerHTML = '';
        if (busDetails.route_stops && busDetails.route_stops.length > 0) {
            busDetails.route_stops.forEach((stop, index) => {
                const li = document.createElement('li');
                let iconSrc = "../assets/images/map_pin_blue.png";
                let label = "";

                if (index === 0) {
                    iconSrc = "../assets/images/map_pin_green.png";
                    label = "Starting Point";
                    li.classList.add('start-point');
                } else if (index === busDetails.route_stops.length - 1) {
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

        // Initialize map if not already
        if (!map && busDetails.route_stops && busDetails.route_stops.length > 0) {
            initLeafletMap(busDetails.route_stops[0].lat, busDetails.route_stops[0].lng);
        } else if (!map) {
            initLeafletMap(15.85, 74.55); // Default KLS GIT coordinates
        }
    };

    const renderNoBusDetails = () => {
        busCodeDisplay.textContent = "N/A";
        busRouteNameDisplay.textContent = "Route: N/A";
        busDepartureTimeDisplay.textContent = "N/A";
        driverNameDisplay.textContent = "Driver N/A";
        busCapacityDisplay.textContent = "N/A";
        routeStopsList.innerHTML = '<li>No route information available.</li>';
        busActiveMessageDisplay.textContent = "No bus assigned or data unavailable.";
        busStatusSpan.textContent = "Inactive";
        busStatusSpan.classList.remove('status-active');
        busStatusSpan.classList.add('status-inactive');
        // Set a default location for the map if no bus is found
        if (!map) {
            initLeafletMap(15.85, 74.55); // Default KLS GIT coordinates
        } else {
            updateLeafletMapLocation(15.85, 74.55, []); // Center map on default location
        }
    };

    const subscribeToBusLocation = (busId, routeStops) => {
        const busLocationDocRef = doc(db, "bus_locations", busId.toString()); // Assuming busId is string or needs conversion
        unsubscribeFromBusLocation = onSnapshot(busLocationDocRef, async (locationDoc) => {
            if (locationDoc.exists()) {
                const locationData = locationDoc.data();
                const currentLat = locationData.latitude;
                const currentLng = locationData.longitude;
                const estimatedArrival = locationData.estimated_arrival; // Assuming this field exists

                if (currentLat && currentLng) {
                    let routePath = [];
                    if (routeStops && routeStops.length > 1) {
                        routePath = await getRoadRoute(routeStops); // Get road route for display
                    }
                    updateLeafletMapLocation(currentLat, currentLng, routePath);
                    if (estimatedArrival) {
                        busEtaCollegeDisplay.textContent = estimatedArrival;
                    }
                    busStatusSpan.textContent = "Active";
                    busStatusSpan.classList.remove('status-inactive');
                    busStatusSpan.classList.add('status-active');
                    busActiveMessageDisplay.textContent = "Bus is on the way";
                }
            } else {
                console.warn("Bus location document not found for bus ID:", busId);
                showToast('Live tracking data unavailable for your bus.', 'info');
                busStatusSpan.textContent = "Inactive";
                busStatusSpan.classList.remove('status-active');
                busStatusSpan.classList.add('status-inactive');
                busActiveMessageDisplay.textContent = "Bus tracking data unavailable.";
            }
        }, (error) => {
            console.error("Error subscribing to bus location:", error);
            showToast('Failed to get live bus location.', 'error');
        });
    };

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (unsubscribeFromBusLocation) unsubscribeFromBusLocation();
                if (unsubscribeFromAssignedBus) unsubscribeFromAssignedBus();
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
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000); // Update every minute

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, fetch dashboard data
            subscribeToStudentDashboardData(user.uid);
        } else {
            // User is signed out, redirect to login page
            showToast('You are not logged in. Redirecting to login.', 'info');
            window.location.href = '../login.html';
        }
    });
});

