// Firebase Configuration
// Initialize Firebase with your project credentials

const firebaseConfig = {
    apiKey: "AIzaSyAqF-tgVazUBhAADP-fUPPLDVSrrnJSNBo",
    authDomain: "myproject-43cda.firebaseapp.com",
    databaseURL: "https://myproject-43cda-default-rtdb.firebaseio.com",
    projectId: "myproject-43cda",
    storageBucket: "myproject-43cda.firebasestorage.app",
    messagingSenderId: "79083593750",
    appId: "1:79083593750:web:7bd75ed0ceb4787e765537"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get reference to Firebase services
const auth = firebase.auth();
const database = firebase.database();

