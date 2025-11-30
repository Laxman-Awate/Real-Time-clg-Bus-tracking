import { auth, db } from "./firebase-init.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// register.js
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('student-register-form');
    const errorMessage = document.getElementById('error-message');
    const roleSelect = document.getElementById('role-select');

    // Student fields
    const studentIdInput = document.getElementById('student-id');
    const studentNameInput = document.getElementById('student-name');
    // Add student email input field
    const studentEmailInput = document.createElement('input');
    studentEmailInput.type = 'email';
    studentEmailInput.id = 'student-email';
    studentEmailInput.placeholder = 'Student Email';
    studentEmailInput.required = true;
    studentEmailInput.className = 'input-group__input'; // Add a class for styling if needed

    // Driver fields
    const driverUsernameInput = document.getElementById('driver-username'); // This will be the email
    const driverNameInput = document.getElementById('driver-name');
    const driverPhoneInput = document.getElementById('driver-phone');

    // Admin fields
    const adminUsernameInput = document.getElementById('admin-username'); // This will be the email

    // Common fields
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // Append student email field to student-fields div
    const studentFieldsDiv = document.getElementById('student-fields');
    const studentEmailGroup = document.createElement('div');
    studentEmailGroup.className = 'input-group';
    studentEmailGroup.innerHTML = '<i class="fas fa-envelope"></i>';
    studentEmailGroup.appendChild(studentEmailInput);
    studentFieldsDiv.appendChild(studentEmailGroup);

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            errorMessage.style.display = 'none';
            errorMessage.textContent = '';

            const selectedRole = roleSelect.value;
            const password = passwordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();
            let email = '';
            let userData = {};

            if (password !== confirmPassword) {
                errorMessage.textContent = 'Passwords do not match.';
                errorMessage.style.display = 'block';
                return;
            }

            if (password.length < 6) { // Firebase requires at least 6 characters for password
                errorMessage.textContent = 'Password must be at least 6 characters long.';
                errorMessage.style.display = 'block';
                return;
            }

            switch (selectedRole) {
                case 'student':
                    email = studentEmailInput.value.trim();
                    userData = {
                        student_id: studentIdInput.value.trim(),
                        name: studentNameInput.value.trim(),
                        role: 'student',
                        isAdmin: false
                    };
                    if (!email || !userData.student_id || !userData.name) {
                        errorMessage.textContent = 'Email, Student ID, and Name are required.';
                        errorMessage.style.display = 'block';
                        return;
                    }
                    break;
                case 'driver':
                    email = driverUsernameInput.value.trim();
                    userData = {
                        username: email,
                        name: driverNameInput.value.trim(),
                        phone: driverPhoneInput.value.trim(),
                        role: 'driver',
                        isAdmin: false
                    };
                    if (!email || !userData.name || !userData.phone) {
                        errorMessage.textContent = 'Email, Name, and Phone are required for drivers.';
                        errorMessage.style.display = 'block';
                        return;
                    }
                    break;
                case 'admin':
                    email = adminUsernameInput.value.trim();
                    userData = {
                        username: email,
                        role: 'admin',
                        isAdmin: true
                    };
                    if (!email) {
                        errorMessage.textContent = 'Admin Email is required.';
                        errorMessage.style.display = 'block';
                        return;
                    }
                    break;
                default:
                    errorMessage.textContent = 'Please select a role.';
                    errorMessage.style.display = 'block';
                    return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Store user details in Firestore
                await setDoc(doc(db, "users", user.uid), userData);

                alert(`Registration successful! You can now log in as a ${selectedRole}.`);
                window.location.href = 'login.html';

            } catch (error) {
                console.error('Firebase Registration error:', error);
                let message = 'Registration failed. Please try again.';
                if (error.code === 'auth/email-already-in-use') {
                    message = 'The email address is already in use by another account.';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'The email address is not valid.';
                } else if (error.code === 'auth/weak-password') {
                    message = 'The password is too weak. Please use at least 6 characters.';
                }
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
            }
        });
    }
});
