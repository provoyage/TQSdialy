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

// Global Variables for App Logic
// These are declared here so script.js can use them without redeclaring.
let auth = null;
let db = null;
let googleProvider = null;

// Initialize Firebase (Compat)
// This file must be loaded AFTER firebase-app-compat.js
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('[FireBase Config] Initialized successfully.');
    } else {
        console.log('[FireBase Config] Already initialized.');
    }

    // Assign instances to global variables
    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    console.log('[FireBase Config] Services exposed globally.');

} else {
    console.error('[FireBase Config] Firebase SDK (compat) not found. Check script loading order.');
}
