// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyD2vj_2RY1y8JNfWwn_v1rSGYqGHfi88vg",
    authDomain: "bus-tracking-app-114f6.firebaseapp.com",
    projectId: "bus-tracking-app-114f6",
    storageBucket: "bus-tracking-app-114f6.firebasestorage.app",
    messagingSenderId: "1058167740878",
    appId: "1:1058167740878:web:7b78efc484740d5efc339f",
    measurementId: "G-JLEE4Z5DFF"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
