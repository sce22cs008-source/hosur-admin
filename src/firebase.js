import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB02bhV2aGXFjosM6y1DwPCQc0qYSBGJFY",
  authDomain: "hosur-infratech-pagarbook.firebaseapp.com",
  projectId: "hosur-infratech-pagarbook",
  storageBucket: "hosur-infratech-pagarbook.firebasestorage.app",
  messagingSenderId: "295841998327",
  appId: "1:295841998327:web:84c13ed03187435536faf2",
  measurementId: "G-3GF93FQEWM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);
