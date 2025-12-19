// Firebase Configuration & Initialization (Compat)
const firebaseConfig = {
    apiKey: "AIzaSyB9niJY05o052OIdFl8ynkAaU7Tkmoaets",
    authDomain: "tqsdiary-c640a.firebaseapp.com",
    projectId: "tqsdiary-c640a",
    storageBucket: "tqsdiary-c640a.firebasestorage.app",
    messagingSenderId: "108616601222",
    appId: "1:108616601222:web:05846c67cdfc861df98b07",
    measurementId: "G-9M5CRKPD5V"
};

// Initialize Firebase (Compat)
// This file must be loaded AFTER firebase-app-compat.js
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('[FireBase Config] Initialized successfully.');
    } else {
        console.log('[FireBase Config] Already initialized.');
    }
} else {
    console.error('[FireBase Config] Firebase SDK (compat) not found. Check script loading order.');
}
