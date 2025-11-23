// admin_drivers.js
document.addEventListener('DOMContentLoaded', () => {
    const driverManagementList = document.getElementById('driver-management-list');
    const addDriverBtn = document.getElementById('add-driver-btn');
    const driverFormContainer = document.getElementById('driver-form-container');
    const driverForm = document.getElementById('driver-form');
    const cancelDriverFormBtn = document.getElementById('cancel-driver-form');
    const logoutBtn = document.getElementById('logout-btn');

    const driverIdInput = document.getElementById('driver-id');
    const driverUsernameInput = document.getElementById('driver-username');
    const driverPasswordInput = document.getElementById('driver-password');
    const driverNameInput = document.getElementById('driver-name');
    const driverPhoneInput = document.getElementById('driver-phone');

    const API_BASE_URL = 'http://localhost:8001';

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    };

    const fetchDrivers = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login/admin.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/drivers`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user_role');
                window.location.href = '../login/admin.html';
                return;
            }

            const drivers = await response.json();
            driverManagementList.innerHTML = '';
            drivers.forEach(driver => {
                const driverCard = document.createElement('div');
                driverCard.className = 'driver-card';
                driverCard.innerHTML = `
                    <div class="driver-details">
                        <i class="fas fa-user-circle"></i>
                        <div class="driver-details-info">
                            <h3>${driver.name}</h3>
                            <p>ID: ${driver.id}</p>
                        </div>
                    </div>
                    <div class="driver-contact-info">
                        <p><i class="fas fa-user"></i> Username: <strong>${driver.username}</strong></p>
                        <p><i class="fas fa-phone"></i> Phone: <strong>${driver.phone}</strong></p>
                    </div>
                    <div class="driver-actions">
                        <button class="btn primary-btn" onclick="editDriver(${driver.id}, '${driver.username}', '${driver.name}', '${driver.phone}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn danger-btn" onclick="deleteDriver(${driver.id})">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </div>
                `;
                driverManagementList.appendChild(driverCard);
            });

        } catch (error) {
            console.error('Error fetching drivers:', error);
        }
    };

    addDriverBtn.addEventListener('click', () => {
        driverForm.reset();
        driverIdInput.value = '';
        driverFormContainer.style.display = 'block';
    });

    cancelDriverFormBtn.addEventListener('click', () => {
        driverFormContainer.style.display = 'none';
    });

    driverForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = driverIdInput.value;
        const username = driverUsernameInput.value;
        const password = driverPasswordInput.value; // Password might be empty on update if not changed
        const name = driverNameInput.value;
        const phone = driverPhoneInput.value;

        const driverData = { username, name, phone };
        if (password) {
            driverData.password = password;
        }
        
        try {
            let response;
            if (id) {
                response = await fetch(`${API_BASE_URL}/admin/drivers/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(driverData),
                });
            } else {
                response = await fetch(`${API_BASE_URL}/admin/drivers/add`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(driverData),
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save driver');
            }

            driverFormContainer.style.display = 'none';
            fetchDrivers();

        } catch (error) {
            console.error('Error saving driver:', error);
            alert(error.message);
        }
    });

    window.editDriver = (id, username, name, phone) => {
        driverIdInput.value = id;
        driverUsernameInput.value = username;
        driverNameInput.value = name;
        driverPhoneInput.value = phone;
        driverPasswordInput.value = ''; // Clear password field for security
        driverFormContainer.style.display = 'block';
    };

    window.deleteDriver = async (id) => {
        if (!confirm('Are you sure you want to delete this driver?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/admin/drivers/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete driver');
            }

            fetchDrivers();
        } catch (error) {
            console.error('Error deleting driver:', error);
            alert(error.message);
        }
    };

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '../login/admin.html';
    });

    fetchDrivers();
});

