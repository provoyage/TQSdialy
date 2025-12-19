// Firebase Configuration & Initialization
// This file is loaded BEFORE script.js

// Ensure window objects exist
window.firebaseConfig = {
    apiKey: "AIzaSyB9niJY05o052OIdFl8ynkAaU7Tkmoaets",
    authDomain: "tqsdiary-c640a.firebaseapp.com",
    projectId: "tqsdiary-c640a",
    storageBucket: "tqsdiary-c640a.firebasestorage.app",
    messagingSenderId: "108616601222",
    appId: "1:108616601222:web:05846c67cdfc861df98b07",
    measurementId: "G-9M5CRKPD5V"
};

// Explicitly initialize variables on window to guarantee global access
window.app = null;
window.auth = null;
window.db = null;
window.googleProvider = null;

if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        window.app = firebase.initializeApp(window.firebaseConfig);
        console.log('[Firebase Config] Initialized new app instance.');
    } else {
        window.app = firebase.app();
        console.log('[Firebase Config] Using existing app instance.');
    }

    // Assign services to window
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();

    console.log('[Firebase Config] Globals ready on window: app, auth, db');
} else {
    console.error('[Firebase Config] Firebase SDK (compat) not found!');
}
