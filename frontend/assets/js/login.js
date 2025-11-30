import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('unified-login-form');
    const errorMessage = document.getElementById('error-message');
    const emailInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.querySelector('.show-password');

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

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            errorMessage.textContent = '';
            errorMessage.style.display = 'none';

            if (!email || !password) {
                errorMessage.textContent = 'Please enter both email and password.';
                errorMessage.style.display = 'block';
                return;
            }

                try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Get user role from Firestore
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    const role = userData.role; 

                    localStorage.setItem('firebase_uid', user.uid);
                    localStorage.setItem('user_role', role); // Store the user role in localStorage

                    let redirectPath = '../login.html'; // Default to login if role not found or invalid
                    switch (role) {
                        case 'student':
                        redirectPath = 'student/dashboard.html';
                            break;
                        case 'driver':
                            redirectPath = 'driver/dashboard.html';
                            break;
                        case 'admin':
                            redirectPath = 'admin/dashboard.html';
                            break;
                        default:
                            showToast('Unknown user role. Redirecting to login.', 'error');
                            break;
                    }
                    window.location.href = redirectPath;
                } else {
                    // User document not found, which means registration was incomplete or corrupted
                    showToast('User profile not found. Please contact support or re-register.', 'error');
                    console.error("User document not found for UID:", user.uid);
                    // Optionally, sign out the user if their profile is incomplete
                    // await signOut(auth);
                }

            } catch (error) {
                console.error('Firebase Login error:', error);
                let message = 'Login failed. Please check your credentials.';
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    message = 'Invalid email or password.';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'Invalid email format.';
                } else if (error.code === 'auth/too-many-requests') {
                    message = 'Too many login attempts. Please try again later.';
                }
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
                showToast(message, 'error');
            }
        });
    }
});

