// track_bus.js
document.addEventListener('DOMContentLoaded', () => {
    const mapDiv = document.getElementById('map');
    const busNameSpan = document.getElementById('bus-name');
    const routeNameSpan = document.getElementById('route-name');
    const driverNameSpan = document.getElementById('driver-name');
    const busSpeedSpan = document.getElementById('bus-speed');
    const etaSpan = document.getElementById('eta');
    const logoutBtn = document.getElementById('logout-btn');

    let map;
    let busMarker;
    let polyline;

    const urlParams = new URLSearchParams(window.location.search);
    const busId = urlParams.get('bus_id');

    if (!busId) {
        alert('Bus ID not specified.');
        window.location.href = 'dashboard.html';
        return;
    }

    // Dummy initMap function for Google Maps API
    window.initMap = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login/student.html';
            return;
        }

        try {
            const busDetailsResponse = await fetch(`http://localhost:8000/students/bus/${busId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!busDetailsResponse.ok) {
                throw new Error('Failed to fetch bus details');
            }
            const busDetails = await busDetailsResponse.json();

            busNameSpan.textContent = busDetails.name;
            routeNameSpan.textContent = busDetails.route_name;
            driverNameSpan.textContent = busDetails.driver_name;

            const initialLat = busDetails.stops[0].lat;
            const initialLng = busDetails.stops[0].lng;

            map = new google.maps.Map(mapDiv, {
                center: { lat: initialLat, lng: initialLng },
                zoom: 13,
            });

            busMarker = new google.maps.Marker({
                position: { lat: initialLat, lng: initialLng },
                map: map,
                icon: {
                    url: '../assets/images/bus_icon.png', // Dummy bus icon
                    scaledSize: new google.maps.Size(40, 40)
                },
                title: busDetails.name,
            });

            // Draw route polyline
            polyline = new google.maps.Polyline({
                path: busDetails.stops,
                geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2,
                map: map,
            });

            // Start fetching real-time location updates
            setInterval(fetchBusLocation, 10000); // Every 10 seconds

        } catch (error) {
            console.error('Error initializing map or fetching bus details:', error);
            alert('Could not load bus tracking.');
            window.location.href = 'dashboard.html';
        }
    };

    const fetchBusLocation = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login/student.html';
            return;
        }
        try {
            const response = await fetch(`http://localhost:8000/tracking/bus/${busId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch bus location');
            }
            const data = await response.json();
            
            busMarker.setPosition({ lat: data.lat, lng: data.lng });
            map.setCenter({ lat: data.lat, lng: data.lng });
            busSpeedSpan.textContent = data.speed;
            etaSpan.textContent = data.estimated_arrival;

        } catch (error) {
            console.error('Error fetching bus location:', error);
        }
    };

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '../login/student.html';
    });
});

