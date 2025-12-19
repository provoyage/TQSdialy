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

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('[Firebase Config] Initialized.');
    } else {
        console.log('[Firebase Config] Already initialized.');
    }
} else {
    console.error('[Firebase Config] Firebase SDK (compat) not found!');
}

// Define Global Variables for script.js to use
// Using 'var' or 'window.x' is safer for globals to avoid "Identifier already declared" if script is re-run, 
// but User asked for "const auth = ...". 
// However, since this file is loaded once, 'const' at top level is fine in a non-module script.
// BUT, if script.js ALSO has 'let auth', that's the conflict. 
// script.js will have NO declaration.

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

console.log('[Firebase Config] Global variables (auth, db) ready.');
