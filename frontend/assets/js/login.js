// login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('unified-login-form');
    const errorMessage = document.getElementById('error-message');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.querySelector('.show-password');

    // Update API base URL to match your backend
    const API_BASE_URL = 'http://127.0.0.1:8001';

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = usernameInput.value;
            const password = passwordInput.value;

            let role = '';
            let redirectPath = '';

            try {
                let loginSuccess = false;
                let loginData = null;

                // Attempt student login
                try {
                    const studentResponse = await fetch(`${API_BASE_URL}/auth/login/student`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ student_id: username, password: password }),
                    });
                    if (studentResponse.ok) {
                        loginData = await studentResponse.json();
                        role = 'student';
                        redirectPath = 'student/dashboard.html';
                        loginSuccess = true;
                    }
                } catch (e) { /* ignore, try next role */ }

                // Attempt driver login if student login failed
                if (!loginSuccess) {
                    try {
                        const driverResponse = await fetch(`${API_BASE_URL}/auth/login/driver`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: username, password: password }),
                        });
                        if (driverResponse.ok) {
                            loginData = await driverResponse.json();
                            role = 'driver';
                            redirectPath = 'driver/dashboard.html';
                            loginSuccess = true;
                        }
                    } catch (e) { /* ignore, try next role */ }
                }

                // Attempt admin login if previous logins failed
                if (!loginSuccess) {
            try {
                        const adminResponse = await fetch(`${API_BASE_URL}/auth/login/admin`, {
                    method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: username, password: password }),
                });
                        if (adminResponse.ok) {
                            loginData = await adminResponse.json();
                            role = 'admin';
                            redirectPath = 'admin/dashboard.html';
                            loginSuccess = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                if (!loginSuccess || !loginData) {
                    throw new Error('Login failed. Please check your credentials.');
                }

                // Store authentication data
                localStorage.setItem('access_token', loginData.access_token);
                localStorage.setItem('user_role', role);
                
                // Store additional user data based on role
                if (role === 'driver') {
                    localStorage.setItem('driver_id', loginData.driver_id || '');
                    localStorage.setItem('user_name', loginData.name || 'Driver');
                    localStorage.setItem('username', loginData.username || '');
                } else if (role === 'admin') {
                    localStorage.setItem('user_name', 'Admin'); // Admin name not returned by backend yet
                } else if (role === 'student') {
                    localStorage.setItem('student_id', loginData.student_id);
                    localStorage.setItem('user_name', loginData.user_name || 'Student');
                    // If you add email and phone to students.json and backend response, store them here:
                    // localStorage.setItem('user_email', loginData.user_email || '');
                    // localStorage.setItem('user_phone', loginData.user_phone || '');
                }
                
                window.location.href = redirectPath;
            } catch (error) {
                console.error('Login error:', error);
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            }
        });
    }
});

