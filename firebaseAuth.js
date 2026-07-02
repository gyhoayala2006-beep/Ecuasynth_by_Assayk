// firebaseAuth.js - Conexión directa a Firebase mediante CDN (Sin NPM)

// Importamos las herramientas de autenticación desde los servidores de Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// firebaseAuth.js - Configuración limpia de credenciales de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA8KVwA0gw6zkqdICryGAvME1jGhwus0LA",
    authDomain: "ecuasynthbyassayk.firebaseapp.com",
    projectId: "ecuasynthbyassayk",
    storageBucket: "ecuasynthbyassayk.firebasestorage.app",
    messagingSenderId: "47203970090",
    appId: "1:47203970090:web:30220f673302cf57572753",
    measurementId: "G-GXDSPBYY0V"
};

// Inicialización de servicios
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Funciones lógicas exportadas para el formulario
export function registrarUsuario(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

export function iniciarSesion(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function cerrarSesion() {
    return signOut(auth);
}

export function vigilarEstadoUsuario(callback) {
    onAuthStateChanged(auth, callback);
}