// Firebase Configuration & Initialization
// This file is loaded BEFORE script.js

const firebaseConfig = {
    apiKey: "AIzaSyB9niJY05o052OIdFl8ynkAaU7Tkmoaets",
    authDomain: "tqsdiary-c640a.firebaseapp.com",
    projectId: "tqsdiary-c640a",
    storageBucket: "tqsdiary-c640a.firebasestorage.app",
    messagingSenderId: "108616601222",
    appId: "1:108616601222:web:05846c67cdfc861df98b07",
    measurementId: "G-9M5CRKPD5V"
};

// Global Variables
// Defined with 'var' or implicitly to be safe, but User requested 'const'.
// We assume this file is loaded exactly once.

let app;
let auth;
let db;
let googleProvider;

if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        // Initialize and assign to global 'app'
        app = firebase.initializeApp(firebaseConfig);
        console.log('[Firebase Config] Initialized new app instance.');
    } else {
        app = firebase.app();
        console.log('[Firebase Config] Using existing app instance.');
    }

    // Assign services
    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();

    console.log('[Firebase Config] Globals ready: app, auth, db');
} else {
    console.error('[Firebase Config] Firebase SDK (compat) not found!');
}
