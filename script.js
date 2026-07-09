import { registrarUsuario, iniciarSesion, cerrarSesion, vigilarEstadoUsuario } from './firebaseAuth.js';

let audioCtx = null;
const notasActivas = {};
let mapaTecladoFrecuencias = {};

// Mapeo físico estándar de piano (Disposición de teclas)
const ASIGNACION_TECLAS_FISICAS = [
    { key: 'a', notaRelativa: 0 },   // C
    { key: 'w', notaRelativa: 1 },   // C#
    { key: 's', notaRelativa: 2 },   // D
    { key: 'e', notaRelativa: 3 },   // D#
    { key: 'd', notaRelativa: 4 },   // E
    { key: 'f', notaRelativa: 5 },   // F
    { key: 't', notaRelativa: 6 },   // F#
    { key: 'g', notaRelativa: 7 },   // G
    { key: 'y', notaRelativa: 8 },   // G#
    { key: 'h', notaRelativa: 9 },   // A
    { key: 'u', notaRelativa: 10 },  // A#
    { key: 'j', notaRelativa: 11 },  // B
    { key: 'k', notaRelativa: 12 },  // C (Siguiente Octava)
    { key: 'o', notaRelativa: 13 },  // C#
    { key: 'l', notaRelativa: 14 },  // D
    { key: 'p', notaRelativa: 15 },  // D#
    { key: 'ñ', notaRelativa: 16 }   // E
];

let mapaTeclasFisicasANotas = {};
const teclasFisicasPresionadas = new Set();

const ESTRUCTURA_OCTAVA = [
    { nota: 'C', tipo: 'white' }, { nota: 'C#', tipo: 'black' },
    { nota: 'D', tipo: 'white' }, { nota: 'D#', tipo: 'black' },
    { nota: 'E', tipo: 'white' }, { nota: 'F', tipo: 'white' },
    { nota: 'F#', tipo: 'black' }, { nota: 'G', tipo: 'white' },
    { nota: 'G#', tipo: 'black' }, { nota: 'A', tipo: 'white' },
    { nota: 'A#', tipo: 'black' }, { nota: 'B', tipo: 'white' }
];

const matrizFiltros = { A: 'lowpass', B: 'lowpass', C: 'lowpass' };
const matrizFiltrosActivos = { A: true, B: true, C: true };

const valoresDistorsion = {
    A: { drive: 0, gain: 0 },
    B: { drive: 0, gain: 0 },
    C: { drive: 0, gain: 0 }
};

function asegurarAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function calcularCurvaDistorsion(cantidad) {
    const k = typeof cantidad === 'number' ? cantidad : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

function crearBufferRuido(tipo) {
    const tamañoBuffer = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, tamañoBuffer, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    if (tipo === 'white') {
        for (let i = 0; i < tamañoBuffer; i++) data[i] = Math.random() * 2 - 1;
    } else if (tipo === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < tamañoBuffer; i++) {
            let white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520; b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362; b6 = white * 0.115926;
            data[i] = pink * 0.11;
        }
    }
    return buffer;
}

function calcularFrecuencia(nombreNota, numeroOctava) {
    const nombres = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return 440 * Math.pow(2, (((numeroOctava * 12) + nombres.indexOf(nombreNota)) - 57) / 12);
}

function generarTeclado() {
    const cantidadOctavas = parseInt(document.getElementById('octaveSlider').value);
    document.getElementById('octaveDisplay').textContent = `${cantidadOctavas} Oct`;
    const contenedor = document.getElementById('pianoContainer');
    contenedor.innerHTML = '';
    mapaTecladoFrecuencias = {};
    mapaTeclasFisicasANotas = {};
    
    let octavaInicial = 3;
    let listaNotasOrdenadas = [];

    for (let o = 0; o < cantidadOctavas; o++) {
        const octavaActual = octavaInicial + o;
        ESTRUCTURA_OCTAVA.forEach(item => {
            const idNota = `${item.nota}${octavaActual}`;
            mapaTecladoFrecuencias[idNota] = calcularFrecuencia(item.nota, octavaActual);
            listaNotasOrdenadas.push(idNota);

            const li = document.createElement('li');
            li.className = `key ${item.tipo}`;
            li.setAttribute('data-note', idNota);
            
            const span = document.createElement('span');
            span.innerHTML = `${idNota}`; // Limpio, sin guías de texto
            li.appendChild(span);
            
            li.addEventListener('mousedown', () => playNota(idNota));
            li.addEventListener('mouseup', () => stopNota(idNota));
            li.addEventListener('mouseleave', () => stopNota(idNota));
            contenedor.appendChild(li);
        });
    }

    // Vincular mecánicamente las teclas físicas con las notas de la interfaz actual
    ASIGNACION_TECLAS_FISICAS.forEach(mapeo => {
        if (mapeo.notaRelativa < listaNotasOrdenadas.length) {
            mapaTeclasFisicasANotas[mapeo.key] = listaNotasOrdenadas[mapeo.notaRelativa];
        }
    });
}

function inicializarEscuchadoresTecladoFisico() {
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
        
        const letra = e.key.toLowerCase();
        if (mapaTeclasFisicasANotas[letra] && !teclasFisicasPresionadas.has(letra)) {
            teclasFisicasPresionadas.add(letra);
            playNota(mapaTeclasFisicasANotas[letra]);
        }
    });

    window.addEventListener('keyup', (e) => {
        const letra = e.key.toLowerCase();
        if (teclasFisicasPresionadas.has(letra)) {
            teclasFisicasPresionadas.delete(letra);
            stopNota(mapaTeclasFisicasANotas[letra]);
        }
    });
}

function playNota(idNota) {
    asegurarAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (notasActivas[idNota]) return;

    const frecuencia = mapaTecladoFrecuencias[idNota];
    if (!frecuencia) return;

    const actA = document.getElementById('btnToggleA').checked;
    const actB = document.getElementById('btnToggleB').checked;
    const actC = document.getElementById('btnToggleC').checked;
    const actNoise = document.getElementById('btnToggleNoise').checked;

    if (!actA && !actB && !actC && !actNoise) return;

    const estructura = { oscs: [], noiseNode: null, gainNode: audioCtx.createGain() };
    const attack = parseFloat(document.getElementById('adsrAttack').value);
    const decay = parseFloat(document.getElementById('adsrDecay').value);
    const sustain = parseFloat(document.getElementById('adsrSustain').value);

    const valStereo = parseFloat(document.getElementById('stereoSlider').value); 
    let factorEstereo = 1; 
    let microDetuneEstereo = 0;

    if (valStereo < 0.5) {
        factorEstereo = valStereo * 2; 
    } else if (valStereo > 0.5) {
        microDetuneEstereo = (valStereo - 0.5) * 30; 
    }

    const añadirOscilador = (oscId, tipo, detuneVal, filterType) => {
        const cantidadArmonicos = parseInt(document.getElementById(`harmSlider${oscId}`).value);
        
        for (let h = 1; h <= cantidadArmonicos; h++) {
            const canales = (valStereo > 0.5) ? ['L', 'R'] : ['C'];

            canales.forEach(canal => {
                const osc = audioCtx.createOscillator();
                osc.type = tipo;
                osc.frequency.setValueAtTime(frecuencia * h, audioCtx.currentTime);
                
                let detuneFinal = detuneVal;
                if (canal === 'L') detuneFinal -= microDetuneEstereo;
                if (canal === 'R') detuneFinal += microDetuneEstereo;
                
                osc.detune.setValueAtTime(detuneFinal, audioCtx.currentTime);

                const waveShaper = audioCtx.createWaveShaper();
                const distGain = audioCtx.createGain();
                
                const drive = valoresDistorsion[oscId].drive * 200;
                waveShaper.curve = calcularCurvaDistorsion(drive);
                waveShaper.oversample = '4x';
                distGain.gain.setValueAtTime(valoresDistorsion[oscId].gain, audioCtx.currentTime);

                osc.connect(waveShaper);
                waveShaper.connect(distGain);

                let nodoSalidaOsc = distGain;

                if (matrizFiltrosActivos[oscId]) {
                    const filter = audioCtx.createBiquadFilter();
                    filter.type = filterType;
                    filter.frequency.setValueAtTime(filterType === 'lowpass' ? 1200 : filterType === 'highpass' ? 400 : 800, audioCtx.currentTime);
                    nodoSalidaOsc.connect(filter);
                    nodoSalidaOsc = filter;
                }

                const pannerNode = audioCtx.createStereoPanner();
                if (canal === 'L') {
                    pannerNode.pan.setValueAtTime(-1 * factorEstereo, audioCtx.currentTime);
                } else if (canal === 'R') {
                    pannerNode.pan.setValueAtTime(1 * factorEstereo, audioCtx.currentTime);
                } else {
                    pannerNode.pan.setValueAtTime(0, audioCtx.currentTime);
                }

                nodoSalidaOsc.connect(pannerNode);
                pannerNode.connect(estructura.gainNode);

                osc.start();
                estructura.oscs.push(osc);
            });
        }
    };

    if (actA) añadirOscilador('A', document.getElementById('waveTypeA').value, parseFloat(document.getElementById('detuneSliderA').value), matrizFiltros.A);
    if (actB) añadirOscilador('B', document.getElementById('waveTypeB').value, parseFloat(document.getElementById('detuneSliderB').value), matrizFiltros.B);
    if (actC) añadirOscilador('C', document.getElementById('waveTypeC').value, parseFloat(document.getElementById('detuneSliderC').value), matrizFiltros.C);

    if (actNoise) {
        const noiseSource = audioCtx.createBufferSource();
        const noiseGain = audioCtx.createGain();
        noiseSource.buffer = crearBufferRuido(document.getElementById('noiseType').value);
        noiseSource.loop = true;
        noiseGain.gain.setValueAtTime(parseFloat(document.getElementById('noiseVolume').value) * 0.15, audioCtx.currentTime);
        noiseSource.connect(noiseGain);
        
        const noisePanner = audioCtx.createStereoPanner();
        noisePanner.pan.setValueAtTime((valStereo > 0.5) ? 0.15 : 0, audioCtx.currentTime);
        noiseGain.connect(noisePanner);
        noisePanner.connect(estructura.gainNode);
        
        noiseSource.start();
        estructura.noiseNode = noiseSource;
    }

    const t = audioCtx.currentTime;
    estructura.gainNode.gain.setValueAtTime(0, t);
    estructura.gainNode.gain.linearRampToValueAtTime(0.25, t + attack);
    estructura.gainNode.gain.linearRampToValueAtTime(0.25 * sustain, t + attack + decay);
    
    estructura.gainNode.connect(audioCtx.destination);
    
    notasActivas[idNota] = estructura;
    const teclaDOM = document.querySelector(`[data-note="${idNota}"]`);
    if (teclaDOM) teclaDOM.classList.add('active');
}

function stopNota(idNota) {
    const estructura = notasActivas[idNota];
    if (estructura) {
        const release = parseFloat(document.getElementById('adsrRelease').value);
        const t = audioCtx.currentTime;
        estructura.gainNode.gain.cancelScheduledValues(t);
        estructura.gainNode.gain.setValueAtTime(estructura.gainNode.gain.value, t);
        estructura.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + release);
        
        setTimeout(() => {
            estructura.oscs.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch(e){} });
            if (estructura.noiseNode) { try { estructura.noiseNode.stop(); estructura.noiseNode.disconnect(); } catch(e){} }
            estructura.gainNode.disconnect();
        }, (release * 1000) + 50);
        delete notasActivas[idNota];
    }
    const teclaDOM = document.querySelector(`[data-note="${idNota}"]`);
    if (teclaDOM) teclaDOM.classList.remove('active');
}

function dibujarGraficoADSR() {
    const canvas = document.getElementById('adsrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const att = parseFloat(document.getElementById('adsrAttack').value);
    const dec = parseFloat(document.getElementById('adsrDecay').value);
    const sus = parseFloat(document.getElementById('adsrSustain').value);
    const rel = parseFloat(document.getElementById('adsrRelease').value);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(60, 30, 112, 0.2)';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }
    const w = canvas.width - 40, h = canvas.height - 20;
    const x0 = 20, y0 = canvas.height - 10;
    const x1 = x0 + (att / 2) * (w * 0.3), y1 = y0 - h;
    const x2 = x1 + (dec / 2) * (w * 0.3), y2 = y0 - (sus * h);
    const x3 = x2 + (w * 0.2), y3 = y2;
    const x4 = x3 + (rel / 3) * (w * 0.2), y4 = y0;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.strokeStyle = '#9d4edd'; ctx.lineWidth = 3; ctx.stroke();
}

function vincularFiltros(oscId, lpId, hpId, bpId, pwrId) {
    const cambiarFiltro = (tipo, btnId) => {
        matrizFiltros[oscId] = tipo;
        [lpId, hpId, bpId].forEach(id => document.getElementById(id).classList.remove('active'));
        document.getElementById(btnId).classList.add('active');
    };
    document.getElementById(lpId).addEventListener('click', () => cambiarFiltro('lowpass', lpId));
    document.getElementById(hpId).addEventListener('click', () => cambiarFiltro('highpass', hpId));
    document.getElementById(bpId).addEventListener('click', () => cambiarFiltro('bandpass', bpId));
    const bPwr = document.getElementById(pwrId);
    if(bPwr) {
        bPwr.addEventListener('click', () => {
            matrizFiltrosActivos[oscId] = !matrizFiltrosActivos[oscId];
            bPwr.classList.toggle('active', matrizFiltrosActivos[oscId]);
            bPwr.textContent = matrizFiltrosActivos[oscId] ? "ON" : "BYPASS";
        });
    }
}

function inicializarPadsXY() {
    ['A', 'B', 'C'].forEach(id => {
        const pad = document.getElementById(`xyPad${id}`);
        const pointer = document.getElementById(`pointer${id}`);

        const procesarMovimiento = (e) => {
            const rect = pad.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            if (x < 0) x = 0; if (x > rect.width) x = rect.width;
            if (y < 0) y = 0; if (y > rect.height) y = rect.height;

            pointer.style.left = `${x}px`;
            pointer.style.top = `${y}px`;

            valoresDistorsion[id].drive = x / rect.width;
            valoresDistorsion[id].gain = 1 - (y / rect.height);
        };

        pad.addEventListener('mousedown', (e) => {
            procesarMovimiento(e);
            const moverMouse = (moveEvent) => procesarMovimiento(moveEvent);
            window.addEventListener('mousemove', moverMouse);
            window.addEventListener('mouseup', () => {
                window.removeEventListener('mousemove', moverMouse);
            }, { once: true });
        });
    });
}

function actualizarInterfaz() {
    ['A', 'B', 'C'].forEach(id => {
        const val = document.getElementById(`detuneSlider${id}`).value;
        document.getElementById(`detuneDisplay${id}`).textContent = `${val > 0 ? '+' : ''}${val}c`;
        document.getElementById(`section-${id}`).classList.toggle('active', document.getElementById(`btnToggle${id}`).checked);
        document.getElementById(`harmDisplay${id}`).textContent = `${document.getElementById(`harmSlider${id}`).value}x`;
    });
    
    const noiseVol = Math.round(parseFloat(document.getElementById('noiseVolume').value) * 100);
    document.getElementById('noiseVolDisplay').textContent = `${noiseVol}%`;
    document.getElementById('section-Noise').classList.toggle('active', document.getElementById('btnToggleNoise').checked);

    document.getElementById('displayAttack').textContent = `${parseFloat(document.getElementById('adsrAttack').value).toFixed(2)}s`;
    document.getElementById('displayDecay').textContent = `${parseFloat(document.getElementById('adsrDecay').value).toFixed(2)}s`;
    document.getElementById('displaySustain').textContent = `${Math.round(parseFloat(document.getElementById('adsrSustain').value) * 100)}%`;
    document.getElementById('displayRelease').textContent = `${parseFloat(document.getElementById('adsrRelease').value).toFixed(2)}s`;

    const stVal = parseFloat(document.getElementById('stereoSlider').value);
    if (stVal === 0.5) {
        document.getElementById('stereoDisplay').textContent = "Señal Normal";
    } else if (stVal < 0.5) {
        const porcMono = Math.round((1 - (stVal * 2)) * 100);
        document.getElementById('stereoDisplay').textContent = `Modo Mono (${porcMono}%)`;
    } else {
        const porcEstereo = Math.round(((stVal - 0.5) * 2) * 100);
        document.getElementById('stereoDisplay').textContent = `Estéreo Expandido (+${porcEstereo}%)`;
    }

    dibujarGraficoADSR();
}

function controlarInterfazAutentificacion() {
    let modoRegistro = false;
    
    const authModal = document.getElementById('authModal');
    const form = document.getElementById('authForm');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const btnPrimary = document.getElementById('btnPrimaryAuth');
    const btnToggle = document.getElementById('btnToggleAuthMode');
    const authTitle = document.getElementById('authTitle');
    const userStatus = document.getElementById('userStatus');
    const currentEmail = document.getElementById('currentEmail');
    const btnSignOut = document.getElementById('btnSignOut');
    const btnContinue = document.getElementById('btnContinue');

    btnToggle.addEventListener('click', () => {
        modoRegistro = !modoRegistro;
        if (modoRegistro) {
            authTitle.textContent = "REGISTRAR CUENTA";
            btnPrimary.textContent = "CREAR CUENTA";
            btnToggle.textContent = "¿Ya tienes cuenta? Ingresa aquí";
        } else {
            authTitle.textContent = "ACCESO AL SISTEMA";
            btnPrimary.textContent = "INGRESAR";
            btnToggle.textContent = "¿No tienes cuenta? Regístrate aquí";
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;

        if (modoRegistro) {
            registrarUsuario(email, password)
                .then(() => alert("¡Cuenta creada con éxito!"))
                .catch(error => alert("Error al registrar: " + error.message));
        } else {
            iniciarSesion(email, password)
                .then(() => {
                    authModal.classList.add('d-none');
                })
                .catch(error => alert("Error de credenciales: " + error.message));
        }
        form.reset();
    });

    btnSignOut.addEventListener('click', () => {
        cerrarSesion().catch(error => alert(error.message));
    });

    btnContinue.addEventListener('click', () => {
        authModal.classList.add('d-none');
    });

    vigilarEstadoUsuario((user) => {
        if (user) {
            form.classList.add('d-none');
            userStatus.classList.remove('d-none');
            currentEmail.textContent = user.email;
            authModal.classList.add('d-none');
        } else {
            form.classList.remove('d-none');
            userStatus.classList.add('d-none');
            currentEmail.textContent = "";
            authModal.classList.remove('d-none');
        }
    });
}

// --- ÚNICO INICIALIZADOR GENERAL DEL DOM ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('octaveSlider').addEventListener('input', generarTeclado);
    document.getElementById('stereoSlider').addEventListener('input', actualizarInterfaz);
    
    ['adsrAttack', 'adsrDecay', 'adsrSustain', 'adsrRelease'].forEach(id => document.getElementById(id).addEventListener('input', actualizarInterfaz));
    ['detuneSliderA', 'detuneSliderB', 'detuneSliderC', 'noiseVolume', 'btnToggleA', 'btnToggleB', 'btnToggleC', 'btnToggleNoise', 'noiseType', 'harmSliderA', 'harmSliderB', 'harmSliderC'].forEach(id => document.getElementById(id).addEventListener('input', actualizarInterfaz));

    vincularFiltros('A', 'fltA-lp', 'fltA-hp', 'fltA-bp', 'pwrFiltroA');
    vincularFiltros('B', 'fltB-lp', 'fltB-hp', 'fltB-bp', 'pwrFiltroB');
    vincularFiltros('C', 'fltC-lp', 'fltC-hp', 'fltC-bp', 'pwrFiltroC');

    inicializarPadsXY();
    generarTeclado();
    actualizarInterfaz();
    inicializarEscuchadoresTecladoFisico();
    controlarInterfazAutentificacion();
});