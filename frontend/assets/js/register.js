// register.js
const API_BASE_URL = 'http://localhost:8001';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('student-register-form'); // Corrected ID
    const errorMessage = document.getElementById('error-message');
    const roleSelect = document.getElementById('role-select'); // Corrected ID

    // Student fields
    const studentIdInput = document.getElementById('student-id');
    const studentNameInput = document.getElementById('student-name');

    // Driver fields
    const driverUsernameInput = document.getElementById('driver-username');
    const driverNameInput = document.getElementById('driver-name');
    const driverPhoneInput = document.getElementById('driver-phone');

    // Admin fields
    const adminUsernameInput = document.getElementById('admin-username');

    // Common fields
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Reset error message
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';

            const selectedRole = roleSelect.value;
            const password = passwordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            // Basic password validation
            if (password !== confirmPassword) {
                errorMessage.textContent = 'Passwords do not match.';
                errorMessage.style.display = 'block';
                return;
            }

            if (password.length < 8) {
                errorMessage.textContent = 'Password must be at least 8 characters long.';
                errorMessage.style.display = 'block';
                return;
            }
            
            let requestData = { password };
            let endpoint = '';

            switch (selectedRole) {
                case 'student':
                    requestData.student_id = studentIdInput.value.trim();
                    requestData.name = studentNameInput.value.trim();
                    if (!requestData.student_id || !requestData.name) {
                        errorMessage.textContent = 'Student ID and Name are required.';
                        errorMessage.style.display = 'block';
                        return;
                    }
                    endpoint = '/auth/register/student';
                    break;
                case 'driver':
                    requestData.username = driverUsernameInput.value.trim();
                    requestData.name = driverNameInput.value.trim();
                    requestData.phone = driverPhoneInput.value.trim();
                    if (!requestData.username || !requestData.name || !requestData.phone) {
                        errorMessage.textContent = 'Username, Name, and Phone are required for drivers.';
                        errorMessage.style.display = 'block';
                        return;
                    }
                    endpoint = '/auth/register/driver';
                    break;
                case 'admin':
                    requestData.username = adminUsernameInput.value.trim();
                    if (!requestData.username) {
                        errorMessage.textContent = 'Admin Username is required.';
                        errorMessage.style.display = 'block';
                        return;
                    }
                    endpoint = '/auth/register/admin';
                    break;
                default:
                    errorMessage.textContent = 'Please select a role.';
                    errorMessage.style.display = 'block';
                    return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || 'Registration failed. Please try again.');
                }

                alert(`Registration successful! You can now log in as a ${selectedRole}.`);
                window.location.href = 'login.html';

            } catch (error) {
                console.error('Registration error:', error);
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            }
        });
    }
});
