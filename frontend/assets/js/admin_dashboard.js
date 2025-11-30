import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, onSnapshot, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// admin_dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const totalBusesSpan = document.getElementById('total-buses');
    const totalDriversSpan = document.getElementById('total-drivers');
    const totalRoutesSpan = document.getElementById('total-routes');
    const busFleetListDiv = document.getElementById('bus-fleet-list');
    const addNewBusBtn = document.getElementById('add-new-bus-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Removed API_BASE_URL as we are using Firebase

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

    // Real-time listener for buses and dashboard stats
    const subscribeToDashboardData = () => {
        // Buses
        const busesQuery = query(collection(db, "buses"));
        onSnapshot(busesQuery, (snapshot) => {
            const buses = [];
            snapshot.forEach((doc) => {
                buses.push({ id: doc.id, ...doc.data() });
            });
            totalBusesSpan.textContent = buses.length;
            renderBusFleet(buses);
        }, (error) => {
            console.error("Error fetching buses for dashboard: ", error);
            showToast('Failed to load bus data.', 'error');
        });

        // Drivers (placeholder for now, assuming a 'drivers' collection in Firestore)
        const driversQuery = query(collection(db, "drivers"));
        onSnapshot(driversQuery, (snapshot) => {
            totalDriversSpan.textContent = snapshot.size;
        }, (error) => {
            console.error("Error fetching drivers for dashboard: ", error);
            showToast('Failed to load driver data.', 'error');
        });

        // Routes (placeholder for now, assuming a 'routes' collection in Firestore)
        const routesQuery = query(collection(db, "routes"));
        onSnapshot(routesQuery, (snapshot) => {
            totalRoutesSpan.textContent = snapshot.size;
        }, (error) => {
            console.error("Error fetching routes for dashboard: ", error);
            showToast('Failed to load route data.', 'error');
        });
    };

    const renderBusFleet = (buses) => {
        busFleetListDiv.innerHTML = ''; // Clear existing content
        if (buses.length === 0) {
            busFleetListDiv.innerHTML = '<p>No buses currently available.</p>';
            return;
        }

        buses.forEach(bus => {
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
                    <p>Stops: ${bus.route_stops && bus.route_stops.length > 0 ? bus.route_stops.map(stop => stop.name).join(', ') : 'N/A'}</p>
                    </div>
                `;
                busFleetListDiv.appendChild(busFleetRow);
            });
    };

    // Handle click on "Add New Bus" button
    if (addNewBusBtn) {
        addNewBusBtn.addEventListener('click', () => {
            window.location.href = 'buses.html'; 
        });
    }

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('firebase_uid');
        window.location.href = '../login.html';
        } catch (error) {
            console.error('Error during logout:', error);
            showToast('Failed to logout.', 'error');
        }
    });

    // Firebase Auth State Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, check their role
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (!userData.isAdmin) { // Only admin users should access this dashboard
                    showToast('Access Denied: You do not have administrative privileges.', 'error');
                    // Redirect to a non-admin dashboard or login page
                    window.location.href = '../login.html'; 
                    return;
                }
                subscribeToDashboardData(); // Start real-time listeners for dashboard data
            } else {
                console.warn("User document not found for UID:", user.uid);
                showToast('User profile not found. Please contact support.', 'error');
                await signOut(auth);
                window.location.href = '../login.html';
            }
        } else {
            // User is signed out, redirect to login page
            window.location.href = '../login.html';
        }
    });
});

