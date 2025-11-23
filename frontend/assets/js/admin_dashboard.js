// admin_dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const totalBusesSpan = document.getElementById('total-buses');
    const totalDriversSpan = document.getElementById('total-drivers');
    const totalRoutesSpan = document.getElementById('total-routes');
    // const totalStudentsSpan = document.getElementById('total-students'); // Not used in new design
    // const liveBusMapDiv = document.getElementById('live-bus-map'); // Not used in new design
    const busFleetListDiv = document.getElementById('bus-fleet-list');
    const addNewBusBtn = document.getElementById('add-new-bus-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const API_BASE_URL = 'http://localhost:8001';

    // let map; // Not used in new design
    // let busMarkers = {}; // Not used in new design

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login.html';
            throw new Error('No access token found.');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    };

    const fetchAdminDashboardData = async () => {
        try {
            const headers = getAuthHeaders();

            // Fetch Admin Stats
            const statsResponse = await fetch(`${API_BASE_URL}/admin/stats`, { headers });
            if (!statsResponse.ok) {
                if (statsResponse.status === 401 || statsResponse.status === 403) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    window.location.href = '../login.html';
                }
                throw new Error('Failed to fetch admin stats');
            }
            const statsData = await statsResponse.json();
            totalBusesSpan.textContent = statsData.total_buses;
            totalDriversSpan.textContent = statsData.total_drivers;
            totalRoutesSpan.textContent = statsData.total_routes;
            // totalStudentsSpan.textContent = statsData.total_students; // Not used in new design

            // Fetch Bus Fleet Data
            const busesResponse = await fetch(`${API_BASE_URL}/admin/buses`, { headers });
            if (!busesResponse.ok) {
                throw new Error('Failed to fetch bus fleet data');
            }
            const busesData = await busesResponse.json();
            busFleetListDiv.innerHTML = ''; // Clear existing dummy content

            const routesResponse = await fetch(`${API_BASE_URL}/admin/routes`, { headers });
            const routesData = routesResponse.ok ? await routesResponse.json() : [];

            busesData.forEach(bus => {
                const route = routesData.find(r => r.id === bus.route_id);
                const routeName = route ? route.name : "N/A";
                const routeStops = route ? route.stops.map((s, index) => {
                    if (index === 0) return "Starting Point"; // Dummy for display
                    if (index === route.stops.length - 1) return "Destination"; // Dummy for display
                    return `Stop ${index + 1}`;
                }).join(' &rarr; ') : "N/A";

                const busFleetRow = document.createElement('div');
                busFleetRow.className = 'bus-fleet-row';
                busFleetRow.innerHTML = `
                    <div class="bus-fleet-item bus-details">
                        <img src="../assets/images/bus_icon_small.png" alt="Bus Icon">
                        <div>
                            <h4>${bus.bus_number || 'N/A'}</h4>
                            <p>Driver: ${bus.driver_name || 'Not assigned'}</p>
                        </div>
                    </div>
                    <div class="bus-fleet-item bus-route">
                        <p>Route: ${bus.route_name || 'N/A'}</p>
                        <p>Stops: ${bus.route_stops && bus.route_stops.length > 0 ? bus.route_stops.join(', ') : 'N/A'}</p>
                    </div>
                `;
                busFleetListDiv.appendChild(busFleetRow);
            });

        } catch (error) {
            console.error('Error fetching admin dashboard data:', error);
        }
    };

    // Handle click on "Add New Bus" button
    if (addNewBusBtn) {
        addNewBusBtn.addEventListener('click', () => {
            // Redirect to the manage buses page or show a modal
            window.location.href = 'buses.html'; 
        });
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '../login.html';
    });

    fetchAdminDashboardData();
});

