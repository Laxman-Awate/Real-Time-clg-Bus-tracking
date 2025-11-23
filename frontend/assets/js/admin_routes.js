// admin_routes.js
document.addEventListener('DOMContentLoaded', () => {
    const routeManagementList = document.getElementById('route-management-list');
    const addRouteBtn = document.getElementById('add-route-btn');
    const routeFormContainer = document.getElementById('route-form-container');
    const routeForm = document.getElementById('route-form');
    const cancelRouteFormBtn = document.getElementById('cancel-route-form');
    const logoutBtn = document.getElementById('logout-btn');

    const routeIdInput = document.getElementById('route-id');
    const routeNameInput = document.getElementById('route-name');
    const routeStopsInput = document.getElementById('route-stops');

    const API_BASE_URL = 'http://localhost:8000';

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    };

    const fetchRoutes = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login/admin.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/routes`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user_role');
                window.location.href = '../login/admin.html';
                return;
            }

            const routes = await response.json();
            routeManagementList.innerHTML = '';
            routes.forEach(route => {
                const routeCard = document.createElement('div');
                routeCard.className = 'route-card';
                const stopsText = route.stops.map(stop => `(${stop.lat}, ${stop.lng})`).join('; ');
                routeCard.innerHTML = `
                    <h3>Route ID: ${route.id} - ${route.name}</h3>
                    <p>Stops: ${stopsText}</p>
                    <button onclick="editRoute(${route.id}, '${route.name}', '${JSON.stringify(route.stops).replace(/'/g, "\\'")}')">Edit</button>
                    <button onclick="deleteRoute(${route.id})">Delete</button>
                `;
                routeManagementList.appendChild(routeCard);
            });

        } catch (error) {
            console.error('Error fetching routes:', error);
        }
    };

    addRouteBtn.addEventListener('click', () => {
        routeForm.reset();
        routeIdInput.value = '';
        routeFormContainer.style.display = 'block';
    });

    cancelRouteFormBtn.addEventListener('click', () => {
        routeFormContainer.style.display = 'none';
    });

    routeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = routeIdInput.value;
        const name = routeNameInput.value;
        const stopsString = routeStopsInput.value;
        const stops = stopsString.split(';').map(s => {
            const parts = s.trim().split(',');
            return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
        });

        const routeData = { name, stops };
        
        try {
            let response;
            if (id) {
                response = await fetch(`${API_BASE_URL}/admin/routes/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(routeData),
                });
            } else {
                response = await fetch(`${API_BASE_URL}/admin/routes/add`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(routeData),
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save route');
            }

            routeFormContainer.style.display = 'none';
            fetchRoutes();

        } catch (error) {
            console.error('Error saving route:', error);
            alert(error.message);
        }
    });

    window.editRoute = (id, name, stopsJson) => {
        const stops = JSON.parse(stopsJson);
        routeIdInput.value = id;
        routeNameInput.value = name;
        routeStopsInput.value = stops.map(stop => `${stop.lat},${stop.lng}`).join('; ');
        routeFormContainer.style.display = 'block';
    };

    window.deleteRoute = async (id) => {
        if (!confirm('Are you sure you want to delete this route?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/admin/routes/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete route');
            }

            fetchRoutes();
        } catch (error) {
            console.error('Error deleting route:', error);
            alert(error.message);
        }
    };

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '../login/admin.html';
    });

    fetchRoutes();
});

