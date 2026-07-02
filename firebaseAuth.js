// firebaseAuth.js - Conexión directa a Firebase mediante CDN Estable (Sin NPM)

// CORRECCIÓN: Importamos las herramientas usando una versión existente y estable (10.12.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Configuración limpia de credenciales de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA8KVwA0gw6zkqdICryGAvME1jGhwus0LA",
    authDomain: "ecuasynthbyassayk.firebaseapp.com",
    projectId: "ecuasynthbyassayk",
    storageBucket: "ecuasynthbyassayk.firebasestorage.app",
    messagingSenderId: "47203970090",
    appId: "1:47203970090:web:30220f673302cf57572753",
    measurementId: "G-GXDSPBYY0V"
};

// Inicialización de servicios con el SDK corregido
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Funciones lógicas exportadas para el formulario (Se mantienen idénticas)
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
