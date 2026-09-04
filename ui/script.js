// =================================================================
// MÓDULO 1: ESTADO GLOBAL Y VARIABLES
// =================================================================

// Almacena las traducciones enviadas desde Lua (config.lua)
let globalTranslations = {};

// [IMPORTANTE] Lista MAESTRA con todos los datos. Nunca se filtra, sirve de respaldo.
let originalFullList = [];

// Lista de TRABAJO. Es la que se ordena, filtra y recorta para la paginación.
let currentWorkingList = [];

// Configuración de visualización
let currentPage = 1;            // Página actual
let itemsPerPage = 7;           // Elementos por página (se actualiza desde Lua)
let sortColumn = 'date_added';  // Columna activa de ordenación
let sortDirection = 'desc';     // 'asc' o 'desc'
let currentFilter = '';         // Texto del buscador
let isPlateViewActive = false;  // Controla si la cámara está enfocando la matrícula
let isShowroomOpen = false;     // Controla si el catálogo de clientes está abierto
let isBossMenuOpen = false;     // Controla si el Boss Menu está abierto
let currentBossDealerName = ""; // Guarda el nombre de la empresa para los títulos
let activeJobGrades = [];       // Guardará los rangos del trabajo del jugador para mostrar/ocultar categorías en el Boss Menu
let currentPreviewColor = 0;    // 0 = Negro (Default de GTA)
let currentPreviewVehicle = null;
let currentActiveExtras = null; // Guardará la lista de extras activos
let myPendingReservations = []; // Guarda los modelos que este jugador ya ha reservado
let currentCustomPlate = ""; // Guarda la matrícula personalizada escrita por el usuario
let dragStartCategoryIndex = -1; // Obligatoria para que el renderBossCatsTable sepa qué arrastras
let companyBalanceChart = null; // Instancia global de la gráfica de la empresa

// Variables del Showroom (Carrusel)
let currentShowroomCategory = 'all';
let currentShowroomSearch = '';
let filteredShowroomStock = [];
let showroomLoadedCount = 0;
const SHOWROOM_BATCH_SIZE = 65;

// Filtros avanzados — valores por defecto (se actualizan al cargar stock)
let filterPrice = { min: 0, max: 10000000 };
let filterSpeed = { min: 0, max: 250 };
let filterSeats = { min: 1, max: 16 };

// Variables del Boss Menu (Stock Global y Lazy Load)
let globalStock = []; // Aquí se guardarán los coches que mande el Lua
let currentFilteredStock = []; // Lo que estamos viendo actualmente en la búsqueda
let currentLoadedCount = 0; // Cuántos hemos dibujado hasta ahora
const VEHICLE_BATCH_SIZE = 65; // De cuántos en cuántos van a ir cargando
let dealerLoadCache = {}; // Caché para guardar el scroll de cada concesionario por separado

// Variables de Categorías
let activeCategories = []; // Ahora arranca vacío, esperando la información de la Base de Datos (Lua)

// Variables del Boss Menu - Ventas
let originalSalesList = []; // Guardará la lista original intacta para el buscador
let salesWorkingList = [];  // Lista que se recorta y pagina
let salesCurrentPage = 1;
const salesItemsPerPage = 18; // Ajustado para que quepan 8 ventas en la misma vista

// Variables del Boss Menu - Transacciones
// Ahora arranca vacío, esperando la información de SQL
let transWorkingList = [];
let originalTransList = [];
let transCurrentPage = 1;
const transItemsPerPage = 19;

// Variables del Boss Menu - Tablas Secundarias (Sancionados)
let dummySanc = [
    { name: 'Paco Fiestas', sanctions: 2, date: '08-04-2026' },
    { name: 'Juan Nieve', sanctions: 1, date: '07-04-2026' },
];
let sancWorkingList = [...dummySanc];
let sancCurrentPage = 1;
const sancItemsPerPage = 15;

// Variables del Boss Menu - Tablas Secundarias (Empleados)
let dummyEmp = [
    { name: 'Alex Casacas', rank: 'Jefe', salary: '2000' },
    { name: 'Paca Sancada', rank: 'Vendedor', salary: '500' },
];
let empWorkingList = [...dummyEmp];
let empCurrentPage = 1;
const empItemsPerPage = 10;

// Variables del Boss Menu - Tablas Secundarias (Descuentos)
let discWorkingList = [];
let originalDiscList = [];
let discCurrentPage = 1;
const discItemsPerPage = 15;
let discVehLoadedCount = 0;
const DISC_VEH_BATCH_SIZE = 100; // De 100 en 100
let discVehWorkingList = []; // Aquí guardaremos los 3000 coches en la recámara

// Variables de Control para el Modal de Descuentos
let discountSelectedVehicles = []; // Guardará 'ALL', o un array de categorías y modelos
let isDiscountRandom = true; // Controla el botón Izq/Der de Código
let isDiscountGlobal = true; // Controla el botón Izq/Der de Límite de Usos

// Controla si estamos comparando vehículos
let isCompareModeActive = false;
let currentCompareVehicle = null;
let currentPreviewVehicleData = null;

// Variables del Admin Menu - Configuración de Concesionarios
let isAdminMenuOpen = false;
let originalAdminDealersList = [];
let adminDealersWorkingList = [];
let adminDealersCurrentPage = 1;
const adminDealersItemsPerPage = 12; // Cantidad de concesionarios por página
let currentMapZoomPercent = 250; // Variable global para mantener el nivel de escala activo

const originalConsoleError = console.error;

// Mapa global de blip ID → slug (para mostrar imagen del blip en la tabla)
const BLIP_SLUG_MAP = {
    1: 'level', 4: 'wanted_radius', 5: 'area_blip', 6: 'centre', 7: 'north', 8: 'waypoint', 9: 'radius_blip',
    10: 'radius_outline_blip', 16: 'police_plane_move', 27: 'mp_crew', 28: 'mp_friendlies', 36: 'cable_car',
    37: 'activities', 38: 'raceflag', 40: 'safehouse', 43: 'police_heli', 47: 'snitch', 50: 'crim_carsteal',
    51: 'crim_drugs', 52: 'crim_holdups', 56: 'cop_patrol', 57: 'cop_player', 58: 'crim_wanted', 59: 'heist',
    60: 'police_station', 61: 'hospital', 64: 'helicopter', 66: 'random_character', 67: 'security_van',
    68: 'tow_truck', 71: 'barber', 72: 'car_mod_shop', 73: 'clothes_store', 75: 'tattoo', 76: 'armenian_family',
    77: 'lester_family', 78: 'michael_family', 79: 'trevor_family', 80: 'jewelry_heist', 84: 'rampage',
    85: 'vinewood_tours', 88: 'franklin_family', 89: 'chinese_strand', 90: 'flight_school', 93: 'bar',
    94: 'base_jump', 100: 'car_wash', 102: 'comedy_club', 103: 'darts', 106: 'fbi_officers_strand',
    108: 'financier_strand', 110: 'garage', 112: 'golf', 114: 'gun_shop', 115: 'gun_store_simeon',
    116: 'marina', 118: 'movie_theater', 121: 'music_venue', 123: 'offramp', 126: 'pay_n_spray',
    128: 'port', 130: 'property_for_sale', 131: 'quarry', 132: 'race_circ', 133: 'race_dirt',
    134: 'race_open_wheel', 135: 'race_sea', 136: 'race_standard', 137: 'race_street',
    138: 'restaurant', 139: 'rob_armored_truck', 141: 'shooting_range', 142: 'skydiving',
    143: 'strip_club', 144: 'swimming', 145: 'tennis', 146: 'waypoint', 147: 'weapon_asset',
    148: 'weapon_pistol', 149: 'weapon_smg', 150: 'weapon_shotgun', 151: 'weapon_assault_rifle',
    152: 'weapon_sniper', 153: 'weapon_heavy', 154: 'weapon_thrown', 155: 'sport_car',
    156: 'hair_salon', 157: 'clothes_store_simeon', 158: 'taxi', 161: 'simeon_family',
    162: 'link', 163: 'mini_sub', 166: 'freight_train', 167: 'drug_cash', 168: 'package_collected',
    170: 'yacht', 173: 'race_air', 175: 'construction_heist', 176: 'police_station2',
    177: 'police_station3', 178: 'race_bike', 179: 'race_bicycle', 180: 'property_for_sale2',
    181: 'property_for_sale3', 182: 'property_for_sale4', 183: 'property_for_sale5',
    184: 'property_for_sale6', 185: 'property_for_sale7', 186: 'property_for_sale8',
    187: 'property_for_sale9', 188: 'property_for_sale10', 189: 'property_for_sale11',
    195: 'mp_property_for_sale', 197: 'mp_garage_for_sale', 198: 'mp_appartment_for_sale',
    199: 'mp_gangattack', 200: 'base_jump_heli', 205: 'steal_vehicle', 206: 'steal_boat',
    207: 'steal_heli', 208: 'steal_plane', 209: 'steal_bike', 210: 'steal_dirt_bike',
    211: 'steal_bicycle', 212: 'steal_jetski', 213: 'steal_submarine', 225: 'crim_carsteal2',
    226: 'race_standard2', 227: 'race_dirt2', 228: 'race_air2', 229: 'race_sea2',
    230: 'race_bike2', 231: 'race_bicycle2', 232: 'race_open_wheel2', 233: 'adversary_mode',
    237: 'adversary_mode2', 245: 'triathlon', 272: 'freemode_armour', 273: 'freemode_cash',
    274: 'freemode_kill', 275: 'freemode_money', 276: 'freemode_robbery', 277: 'freemode_shoot',
    280: 'bounty', 281: 'package', 282: 'package_collected2', 283: 'jewels', 285: 'car_export',
    286: 'cop_car', 303: 'casino', 308: 'penthouse', 309: 'nightclub', 310: 'agency', 311: 'arcade',
    312: 'submarine', 313: 'kosatka', 314: 'terrorbyte', 315: 'facility', 316: 'hangar',
    317: 'office', 318: 'biker_clubhouse', 319: 'warehouse', 320: 'vehicle_warehouse',
    321: 'yacht2', 322: 'bunker', 323: 'moc', 326: 'shooting_range2', 327: 'scuba',
    328: 'snitch2', 329: 'detonator', 330: 'golf2', 331: 'tennis2', 332: 'cinema',
    333: 'strip_club2', 334: 'fight_club', 335: 'darts2', 336: 'arm_wrestling',
    337: 'base_jump2', 338: 'rally', 339: 'stunt_race', 340: 'open_wheel_race'
};

// Mapa global de color ID → hex (para mostrar el color del blip en la tabla)
const BLIP_COLOR_MAP = {
    0: '#FFFFFF', 1: '#E03232', 2: '#71CB71', 3: '#5DB6E5', 4: '#FFFFFF', 5: '#F0C850',
    6: '#C25050', 7: '#9C669F', 8: '#F28A8A', 9: '#F5A66E', 10: '#B48B69', 11: '#8CBF8C',
    12: '#6EA3C2', 13: '#B0B0DA', 14: '#775A96', 15: '#5ECCC9', 16: '#D4C98A', 17: '#EB8E2D',
    19: '#CF618C', 20: '#B2A066', 21: '#C47A5A', 22: '#A6A6A6', 23: '#E09BA5', 24: '#B6D46A',
    25: '#3F7547', 26: '#66A3D4', 27: '#A352CC', 29: '#3B4D87', 30: '#3E8282', 36: '#EBE0B0',
    39: '#B5B5B5', 40: '#4D4D4D', 41: '#EB7A8A', 46: '#EBEB46', 48: '#F55A9C', 50: '#8A6EBA',
    51: '#EBA896', 52: '#426E42', 53: '#A0C8DE', 54: '#375F7A', 55: '#A3A3A3', 56: '#6B4E38',
    58: '#474D70', 60: '#EBA347', 61: '#BD527A', 62: '#A8A8A8', 63: '#2E668F', 65: '#8C7873',
    76: '#8F1F1F', 83: '#8C24A3'
};

// Paleta de Colores de GTA V (Solo Metálicos) - Ordenada por flujo cromático
const GTA_COLORS = [
    // 1. MONOCROMÁTICOS (De Negro a Blanco)
    { id: 0, hex: '#050505', name: 'Negro Metálico' },
    { id: 1, hex: '#1c1d21', name: 'Grafito' },
    { id: 11, hex: '#1d2129', name: 'Negro Antracita' },
    { id: 3, hex: '#343a40', name: 'Plata Oscuro' },
    { id: 4, hex: '#979a9f', name: 'Plata' },
    { id: 5, hex: '#c2c4c6', name: 'Plata Azulado' },
    { id: 111, hex: '#fcfcfc', name: 'Blanco Hielo' },
    { id: 112, hex: '#ffffff', name: 'Blanco Escarcha' },

    // 2. ROJOS (Fuego y Lava)
    { id: 150, hex: '#bc1917', name: 'Rojo Lava' },
    { id: 30, hex: '#a51e23', name: 'Rojo Fuego' },
    { id: 27, hex: '#c00e1a', name: 'Rojo' },
    { id: 28, hex: '#da1918', name: 'Rojo Torino' },
    { id: 29, hex: '#b6111b', name: 'Rojo Fórmula' },

    // 3. ROSAS (Transición de rojo a púrpura)
    { id: 35, hex: '#b01259', name: 'Rojo Caramelo' },
    { id: 135, hex: '#f21f99', name: 'Rosa Fuerte' },
    { id: 137, hex: '#df5891', name: 'Rosa Pfister' },
    { id: 136, hex: '#fdd6cd', name: 'Rosa Salmón' },

    // 4. PÚRPURAS
    { id: 142, hex: '#26152b', name: 'Púrpura Medianoche' },
    { id: 145, hex: '#621276', name: 'Púrpura Brillante' },

    // 5. AZULES (De profundos a claros)
    { id: 71, hex: '#171e42', name: 'Azul Spinnaker' },
    { id: 61, hex: '#0b1421', name: 'Azul Galaxia' },
    { id: 62, hex: '#0f1b2e', name: 'Azul Oscuro' },
    { id: 63, hex: '#2c4369', name: 'Azul Sajonia' },
    { id: 64, hex: '#1f3c73', name: 'Azul' },
    { id: 65, hex: '#3b6797', name: 'Azul Marino' },
    { id: 70, hex: '#0062a7', name: 'Azul Brillante' },
    { id: 72, hex: '#3144a6', name: 'Azul Ultra' },
    { id: 67, hex: '#8da9c2', name: 'Azul Diamante' },
    { id: 68, hex: '#487c9f', name: 'Azul Surf' },

    // 6. VERDES (Bosque a Lima)
    { id: 49, hex: '#0d1812', name: 'Verde Oscuro' },
    { id: 50, hex: '#162e24', name: 'Verde Carreras' },
    { id: 51, hex: '#122e2b', name: 'Verde Mar' },
    { id: 52, hex: '#394735', name: 'Verde Oliva' },
    { id: 53, hex: '#165724', name: 'Verde' },
    { id: 55, hex: '#568f00', name: 'Verde Lima' },

    // 7. AMARILLOS Y NARANJAS (Cálidos vibrantes)
    { id: 92, hex: '#89b614', name: 'Lima' },
    { id: 91, hex: '#dce11a', name: 'Amarillo Rocío' },
    { id: 89, hex: '#f8b417', name: 'Amarillo Carrera' },
    { id: 88, hex: '#ffca18', name: 'Amarillo Taxi' },
    { id: 138, hex: '#f68d2b', name: 'Naranja Brillante' },
    { id: 38, hex: '#f36315', name: 'Naranja' },
    { id: 36, hex: '#d44a17', name: 'Naranja Amanecer' }
];

// =================================================================
// BLOQUEO DE SEGURIDAD: PREVENIR DRAG & DROP EN TODO EL NUI
// =================================================================
document.addEventListener('dragstart', function (event) {
    // Bloqueamos absolutamente todo el drag nativo de HTML5.
    // (Esto no afecta a la rotación del coche en VISTA PREVIA porque usa otro sistema)
    event.preventDefault();
});

// Bloquear también el menú contextual (clic derecho) por si acaso intentan "Guardar imagen como..."
document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
});

// =================================================================
// MÓDULO 2: SISTEMA DE TRADUCCIÓN Y FORMATO
// =================================================================

function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');

        // Caso especial: Encabezados de tabla (TH)
        if (el.tagName === 'TH' && globalTranslations[key]) {
            const headerTextSpan = el.querySelector('.header-text');
            if (headerTextSpan) headerTextSpan.innerText = globalTranslations[key];

            // Inyectar iconos de ordenación si no existen
            const sortIconSpan = el.querySelector('.sort-icon');
            if (sortIconSpan) {
                sortIconSpan.innerHTML = '<i class="fa-solid fa-sort-up"></i><i class="fa-solid fa-sort-down"></i><i class="fa-solid fa-sort"></i>';
            }
        }
        // Caso normal: Textos simples, botones, etiquetas
        else if (globalTranslations[key]) {
            el.innerText = globalTranslations[key];
        }
    });

    // Reinicializar listeners de ordenación tras aplicar textos
    initializeSortListeners();
}

// Formateador de dinero (Ej: 50000 -> $50,000)
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

// =================================================================
// GENERADOR INTELIGENTE DE IMÁGENES DE VEHÍCULOS (DRY)
// =================================================================
function getSmartVehicleImage(model, shop) {
    // 1. Calculamos si es Vanilla o Custom
    const isVanilla = shop === 'pdm' || shop === 'luxury' || shop === 'boats' || shop === 'air';
    const primaryImg = isVanilla ? `https://docs.fivem.net/vehicles/${model}.webp` : `./veh_custom/${model}.png`;
    const initialTries = isVanilla ? '0' : '1';

    // 2. Devolvemos el HTML con la lógica de fallbacks incorporada
    return `
        <iconify-icon class="no-image-placeholder" icon="tdesign:image-off-filled" style="position: absolute; font-size: 4vw; color: rgba(255,255,255,0.05); z-index: 0; display: none;"></iconify-icon>
        
        <img src="${primaryImg}" 
            alt="${model}" 
            draggable="false" 
            data-tries="${initialTries}"
            style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 15px 10px rgba(0,0,0,0.6)); z-index: 1; transition: transform 0.2s ease;"
            onerror="
                const tries = parseInt(this.getAttribute('data-tries') || '0');
                this.style.transform = 'scale(1.2)'; 
                if (tries === 0) {
                    this.setAttribute('data-tries', '1');
                    this.src = './veh_custom/${model}.png'; 
                } else if (tries === 1) {
                    this.setAttribute('data-tries', '2');
                    this.src = './veh_custom/${model}.jpg'; 
                } else if (tries === 2) {
                    this.setAttribute('data-tries', '3');
                    this.src = './veh_custom/${model}.webp'; 
                } else {
                    this.style.display = 'none';
                    const placeholder = this.parentElement.querySelector('.no-image-placeholder');
                    if (placeholder) placeholder.style.display = 'block';
                }
            "
        >
    `;
}

// =================================================================
// MÓDULO 3: GESTIÓN VISUAL (MENÚ Y MODALES)
// =================================================================

/**
 * Cierra el menú completamente y devuelve el control al juego.
 */
function closeMenu() {
    const container = document.getElementById('container');
    container.style.display = 'none';

    // Avisar a Lua para quitar el cursor (SetNuiFocus false)
    fetch(`https://DP-VehicleShop/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ message: 'Menu cerrado desde JS' })
    }).catch(err => console.error('Error callback closeMenu:', err));
}

/**
 * Muestra u oculta ventanas emergentes (Modales).
 * @param {string} modalId - ID del div del modal
 * @param {boolean} isVisible - true/false
 */
function toggleModal(modalId, isVisible) {
    const modal = document.getElementById(modalId);
    const menuContainer = document.getElementById('container');

    if (modal) {
        modal.style.display = isVisible ? 'flex' : 'none';
    }

    if (menuContainer) {
        // Efecto de desenfoque (blur) en el fondo
        if (isVisible) {
            menuContainer.classList.add('modal-active');
        } else {
            menuContainer.classList.remove('modal-active');
        }
    }
}

/**
 * Actualiza los inputs de coordenadas en el modal de Crear Spawn.
 */
function updateCoordsDisplay(coords) {
    if (coords && document.getElementById('set-spawn-modal').style.display === 'flex') {
        document.getElementById('coord_x').value = coords.x.toFixed(2);
        document.getElementById('coord_y').value = coords.y.toFixed(2);
        document.getElementById('coord_z').value = coords.z.toFixed(2);
        document.getElementById('coord_h').value = coords.h.toFixed(2);
    }
}

/**
 * Cierra el menú de configuración de administradores.
 */
function closeAdminMenu() {
    isAdminMenuOpen = false;
    const adminContainer = document.getElementById('admin-config-container');
    if (adminContainer) adminContainer.style.display = 'none';

    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ message: 'Admin menu cerrado' })
    }).catch(err => console.error('Error callback closeAdminMenu:', err));
}

// Override de alert para mostrar mensajes en un modal personalizado
window.alert = function (message) {
    const modalTitle = document.getElementById('generic-alert-title-text');
    const modalText = document.getElementById('generic-alert-text');
    const modalIcon = document.getElementById('generic-alert-icon');
    const modalBtn = document.getElementById('generic-alert-btn');

    if (modalTitle) modalTitle.innerText = "ALERTA";
    if (modalIcon) {
        modalIcon.className = "fa-solid fa-circle-exclamation";
        modalIcon.style.color = "#f39c12"; // Naranja para alertas
    }
    if (modalText) modalText.innerText = message;
    if (modalBtn) modalBtn.style.background = "#f39c12";

    toggleModal('generic-alert-modal', true);
};

// Override de console.error para mostrar errores críticos en un modal
console.error = function (...args) {
    // 1. Mantenemos el error nativo en la consola F8/Inspect por si necesitas tracear
    originalConsoleError.apply(console, args);

    // 2. Formateamos los argumentos por si envías objetos u errores nativos
    const message = args.map(arg => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch (e) { return "[Objeto Complejo]"; }
        }
        return String(arg);
    }).join(' ');

    const modalTitle = document.getElementById('generic-alert-title-text');
    const modalText = document.getElementById('generic-alert-text');
    const modalIcon = document.getElementById('generic-alert-icon');
    const modalBtn = document.getElementById('generic-alert-btn');

    if (modalTitle) modalTitle.innerText = "ERROR INTERNO";
    if (modalIcon) {
        modalIcon.className = "fa-solid fa-triangle-exclamation";
        modalIcon.style.color = "#e74c3c"; // Rojo para errores críticos
    }
    if (modalText) modalText.innerText = message;
    if (modalBtn) modalBtn.style.background = "#e74c3c";

    toggleModal('generic-alert-modal', true);
};

// FUNCIÓN PARA SUSTITUIR CONFIRM NATIVO (Basado en Promesas)
function customConfirm(message, title = "CONFIRMAR ACCIÓN") {
    return new Promise((resolve) => {
        const modalTitle = document.getElementById('generic-confirm-title-text');
        const modalText = document.getElementById('generic-confirm-text');
        const btnOkOld = document.getElementById('generic-confirm-ok-btn');
        const btnCancelOld = document.getElementById('generic-confirm-cancel-btn');

        if (modalTitle) modalTitle.innerText = title;
        if (modalText) modalText.innerText = message;

        // TRUCO PRO: Clonamos los botones para destruir CUALQUIER event listener "fantasma"
        // que se haya quedado atascado de confirmaciones anteriores.
        const btnOk = btnOkOld.cloneNode(true);
        const btnCancel = btnCancelOld.cloneNode(true);
        btnOkOld.parentNode.replaceChild(btnOk, btnOkOld);
        btnCancelOld.parentNode.replaceChild(btnCancel, btnCancelOld);

        // Usamos { once: true } para que el evento se autodestruya tras un único clic
        btnOk.addEventListener('click', () => {
            toggleModal('generic-confirm-modal', false);
            resolve(true);
        }, { once: true });

        btnCancel.addEventListener('click', () => {
            toggleModal('generic-confirm-modal', false);
            resolve(false);
        }, { once: true });

        toggleModal('generic-confirm-modal', true);
    });
}

// =================================================================
// MÓDULO 4: HUD (ETIQUETAS FLOTANTES)
// =================================================================

/**
 * Actualiza las etiquetas flotantes sobre los vehículos.
 * @param {Array} visibleVehicles - Array de objetos {id, x, y, display_name, ...}
 */
function updateShowroomHUD(visibleVehicles) {
    const hudContainer = document.getElementById('hud-container');
    if (!hudContainer) return;

    // Crea un Set con los IDs visibles actuales para saber cuáles borrar
    const currentIds = new Set(visibleVehicles.map(v => v.id));

    // 1. LIMPIEZA: Eliminar etiquetas que ya no están en la lista visible
    Array.from(hudContainer.children).forEach(child => {
        const childId = parseInt(child.getAttribute('data-vehicle-id'));
        if (!currentIds.has(childId)) {
            child.remove();
        }
    });

    // 2. ACTUALIZACIÓN/CREACIÓN: Recorrer vehículos visibles
    visibleVehicles.forEach(veh => {
        let tag = hudContainer.querySelector(`.vehicle-tag[data-vehicle-id="${veh.id}"]`);

        // Si la etiqueta NO existe, crearla
        if (!tag) {
            tag = document.createElement('div');
            tag.className = 'vehicle-tag';
            tag.setAttribute('data-vehicle-id', veh.id);

            // HTML interno de la tarjeta (CON PRECIO)
            tag.innerHTML = `
                <div class="tag-title">${veh.display_name}</div>
                <div class="tag-spot">${veh.spawn_name || 'Sin Posición'}</div>
                <div class="tag-info">Colocado por: <strong>${veh.setter_name}</strong></div>
                <div class="tag-price">${formatCurrency(veh.price || 0)}</div>
            `;
            hudContainer.appendChild(tag);
        }

        // Si la etiqueta YA existe, solo actualiza su posición (style)
        // Las coordenadas x, y vienen de Lua en rango 0.0 a 1.0
        // Multiplica por 100 para obtener porcentaje CSS
        tag.style.left = `${veh.x * 100}%`;
        tag.style.top = `${veh.y * 100}%`;
    });
}


// =================================================================
// MÓDULO 5: TABLA DE GESTIÓN (DATOS, PAGINACIÓN Y FILTROS)
// =================================================================

/**
 * [CORE] Recibe los datos crudos de Lua, guarda el original y prepara la vista.
 */
function populateVehicleTable(vehicleList) {
    originalFullList = vehicleList; // Guardar copia de seguridad

    // Aplicar ordenación por defecto a la lista de trabajo
    currentWorkingList = applySortLogic(originalFullList);

    // Ajustar paginación si pasa de rango
    const totalPages = Math.ceil(currentWorkingList.length / itemsPerPage);
    if (currentPage > totalPages) {
        currentPage = totalPages > 0 ? totalPages : 1;
    }

    displayCurrentPage();
}

/**
 * Renderiza los botones < Anterior | Siguiente >
 */
function renderPaginationControls() {
    const controlsContainer = document.getElementById('pagination-controls');
    controlsContainer.innerHTML = '';

    const totalItems = currentWorkingList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return; // Si solo hay 1 página, no mostrar controles

    // Botón Anterior
    const prevButton = document.createElement('button');
    prevButton.className = 'page-button';
    prevButton.innerText = '<';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; displayCurrentPage(); }
    });
    controlsContainer.appendChild(prevButton);

    // Texto Central
    const pageCounter = document.createElement('span');
    pageCounter.className = 'current-page';
    pageCounter.innerText = `${currentPage} / ${totalPages}`;
    controlsContainer.appendChild(pageCounter);

    // Botón Siguiente
    const nextButton = document.createElement('button');
    nextButton.className = 'page-button';
    nextButton.innerText = '>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage++; displayCurrentPage(); }
    });
    controlsContainer.appendChild(nextButton);
}

/**
 * Corta la lista y dibuja solo las filas de la página actual.
 */
function displayCurrentPage() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const vehiclesToShow = currentWorkingList.slice(startIndex, endIndex);

    populateVehicleTableRows(vehiclesToShow);
    renderPaginationControls();
}

/**
 * Genera el HTML de las filas de la tabla (<tr>...</tr>).
 */
function populateVehicleTableRows(vehicleList) {
    const tableBody = document.getElementById('vehicle-list');
    tableBody.innerHTML = '';

    // Si no hay datos, mostrar mensaje
    if (currentWorkingList.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="7" class="no-data-row" data-i18n="no_vehicles">${globalTranslations['no_vehicles'] || 'No hay vehículos.'}</td>`;
        tableBody.appendChild(emptyRow);
        document.getElementById('pagination-controls').innerHTML = '';
        return;
    }

    vehicleList.forEach(vehicle => {
        const row = document.createElement('tr');

        // --- PROCESAMIENTO DE FECHA ---
        let dateTimeDisplay = 'Fecha Inválida';
        try {
            if (vehicle.date_added) {
                let dateString = typeof vehicle.date_added === 'string'
                    ? vehicle.date_added.replace(' ', 'T')
                    : vehicle.date_added;

                const date = new Date(dateString);

                if (!isNaN(date.getTime())) {
                    const formattedDate = date.toLocaleDateString('es-ES');
                    const formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
                    dateTimeDisplay = `${formattedDate} | ${formattedTime}`;
                }
            }
        } catch (e) { console.error("Error fecha:", e); }

        // --- VISUALIZACIÓN DE COORDENADAS ---
        const coordsDisplay = (vehicle.spawn_name)
            ? vehicle.spawn_name
            : (vehicle.spawn_x ? `${vehicle.spawn_x}, ${vehicle.spawn_y}` : 'No Asignado');

        // --- HTML DE LA FILA (Con Precio) ---
        row.innerHTML = `
            <td>${vehicle.model}</td>
            <td>${vehicle.display_name}</td>
            <td style="white-space: nowrap;">${dateTimeDisplay}</td> 
            <td>${vehicle.setter_name}</td>
            <td>${coordsDisplay}</td>
            <td>${formatCurrency(vehicle.price || 0)}</td>
            <td class="centro">
                <button class="btn-icon edit-vehicle" data-id="${vehicle.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon delete-vehicle" data-id="${vehicle.id}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Reasignar listeners a los botones generados dinámicamente
    attachRowActionListeners();
}

function toggleComparisonInteraction(isLocked) {
    const elementsToLock = [
        'buy-vehicle',
        'change-plate',
        'test-drive',
        'vehicle-extras',
        'preview-view',
        'gta-colors-list',
        'custom-rgb-btn'
    ];

    elementsToLock.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (isLocked) {
                el.classList.add('interaction-locked');
            } else {
                el.classList.remove('interaction-locked');
            }
        }
    });
}

/**
 * Asigna eventos Click a los botones de Editar y Eliminar de cada fila.
 */
function attachRowActionListeners() {
    // Botones Editar
    document.querySelectorAll('.edit-vehicle').forEach(button => {
        button.addEventListener('click', (event) => {
            const vehicleId = parseInt(event.currentTarget.getAttribute('data-id'));
            openEditModal(vehicleId);
        });
    });

    // Botones Eliminar
    document.querySelectorAll('.delete-vehicle').forEach(button => {
        button.addEventListener('click', (event) => {
            const vehicleId = event.currentTarget.getAttribute('data-id');
            const row = event.currentTarget.closest('tr');
            const vehicleName = row.children[1].innerText; // Columna Nombre

            // Preparar Modal de Confirmación
            const title = globalTranslations['modal_delete_title'] || 'Confirmar';
            const descTemplate = globalTranslations['modal_delete_desc'] || 'Borrar %s?';

            document.getElementById('delete-modal-title').innerText = title;
            document.getElementById('delete-modal-text').innerText = descTemplate.replace('%s', vehicleName);
            document.getElementById('vehicle-to-delete-id').value = vehicleId;

            toggleModal('delete-confirm-modal', true);
        });
    });
}

/**
 * Filtra la lista según lo que escribas en el buscador.
 */
function filterVehicleList() {
    const searchTerm = document.getElementById('vehicle-search-input').value.toLowerCase().trim();
    currentFilter = searchTerm;

    if (!searchTerm) {
        // Resetear si está vacío
        currentWorkingList = applySortLogic(originalFullList);
    } else {
        // Filtrar sobre la lista ORIGINAL
        const filteredList = originalFullList.filter(vehicle => {
            const searchStr = `${vehicle.model} ${vehicle.display_name} ${vehicle.setter_name} ${vehicle.spawn_name}`.toLowerCase();
            return searchStr.includes(searchTerm);
        });
        currentWorkingList = applySortLogic(filteredList);
    }

    currentPage = 1;
    displayCurrentPage();
}

/**
 * Ordena la lista actual (WorkingList) según columna y dirección.
 */
function sortVehicleList() {
    if (currentFilter) {
        filterVehicleList(); // Si hay filtro, reaplicarlo con el nuevo orden
    } else {
        currentWorkingList = applySortLogic(originalFullList);
        currentPage = 1;
        displayCurrentPage();
    }
}

function applySortLogic(listToSort) {
    const key = sortColumn;
    const direction = sortDirection === 'asc' ? 1 : -1;
    const sortedList = [...listToSort]; // Copia para no mutar original

    sortedList.sort((a, b) => {
        let valA = a[key], valB = b[key];

        // Manejo especial para fechas y números
        if (key === 'date_added') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else if (key === 'price') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else if (!isNaN(valA) && !isNaN(valB) && key !== 'price') {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        return (valA < valB ? -1 : 1) * direction;
    });
    return sortedList;
}

function initializeSortListeners() {
    document.querySelectorAll('thead th[data-sort-key]').forEach(header => {
        header.addEventListener('click', () => {
            const key = header.getAttribute('data-sort-key');

            // Alternar dirección si es la misma columna
            if (key === sortColumn) {
                sortDirection = (sortDirection === 'asc' ? 'desc' : 'asc');
            } else {
                sortColumn = key;
                sortDirection = 'desc';
            }

            sortVehicleList();
            updateSortHeaders(header);
        });
    });

    // Marcar columna inicial
    const defaultHeader = document.querySelector(`thead th[data-sort-key="${sortColumn}"]`);
    if (defaultHeader) updateSortHeaders(defaultHeader);
}

function updateSortHeaders(activeHeader) {
    document.querySelectorAll('thead th').forEach(h => h.classList.remove('active-sort', 'sort-asc', 'sort-desc'));
    activeHeader.classList.add('active-sort', `sort-${sortDirection}`);
}


// =================================================================
// MÓDULO 6: FORMULARIOS DE GESTIÓN (EDITAR / SELECTORES / SPAWNS)
// =================================================================

function openEditModal(vehicleId) {
    const vehicleData = originalFullList.find(v => v.id === vehicleId);
    if (!vehicleData) return;

    // Rellenar formulario
    document.getElementById('editVehicleId').value = vehicleId;
    document.getElementById('editVehicleDisplayName').value = vehicleData.display_name;
    document.getElementById('editVehicleHash').value = vehicleData.model;
    document.getElementById('editVehiclePrice').value = vehicleData.price || 0; // Cargar precio

    // Copiar opciones del selector principal al de edición
    const spawnSelector = document.getElementById('editSpawnSelector');
    spawnSelector.innerHTML = document.getElementById('spawnSelector').innerHTML;
    spawnSelector.value = vehicleData.spawn_id || 0;

    toggleModal('edit-vehicle-modal', true);
}

function populateSpawnSelector(spawnList) {
    const selector = document.getElementById('spawnSelector');
    const defaultOption = selector.querySelector('option[value="0"]'); // Guardar opción "Ninguno"

    selector.innerHTML = '';
    if (defaultOption) selector.appendChild(defaultOption);

    if (!spawnList || spawnList.length === 0) return;

    spawnList.forEach(spawn => {
        const option = document.createElement('option');
        option.value = spawn.id;
        option.innerText = `${spawn.name} (X: ${Math.round(spawn.x)})`;
        selector.appendChild(option);
    });
}

// =================================================================
// MÓDULO 7: SHOWROOM (CARRUSEL DE CLIENTES)
// =================================================================

// Utilidad inteligente para convertir Números Romanos a Enteros (Para la ordenación)
function romanToInt(roman) {
    const romanMap = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10 };
    return romanMap[roman.toLowerCase()] || 0;
}

// Función principal que filtra (por Categoría Y por Búsqueda), ordena y prepara el carrusel
function applyShowroomFilter(categoryName) {
    currentShowroomCategory = categoryName;
    const carousel = document.getElementById('vehicle-carousel');
    if (!carousel) return;

    // Obtenemos el texto en minúsculas
    const term = currentShowroomSearch.toLowerCase().trim();

    // 1. Filtrar la lista maestra (Categoría + Texto)
    filteredShowroomStock = globalStock.filter(v => {
        // ¿Coincide con la categoría seleccionada?
        const matchCategory = (categoryName === 'all') || (v.category === categoryName);

        // ¿Coincide con el texto escrito en la lupa?
        const matchSearch = (term === '') ||
            (v.name && v.name.toLowerCase().includes(term)) ||
            (v.brand && v.brand.toLowerCase().includes(term)) ||
            (v.model && v.model.toLowerCase().includes(term));

        const price = v.price || 0;
        const matchPrice = price >= filterPrice.min && price <= filterPrice.max;

        const speed = v.maxSpeed || v.max_speed || 0;
        const matchSpeed = speed === 0 || (speed >= filterSpeed.min && speed <= filterSpeed.max);

        const seats = v.seats || 0;
        const matchSeats = seats === 0 || (seats >= filterSeats.min && seats <= filterSeats.max);

        return matchCategory && matchSearch && matchPrice && matchSpeed && matchSeats;
    });

    // 2. Ordenación Alfabética, Numérica y de Números Romanos
    filteredShowroomStock.sort((a, b) => {
        const nameA = (a.name || a.model).toString().trim();
        const nameB = (b.name || b.model).toString().trim();

        const romanMatchA = nameA.match(/\s+(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i);
        const romanMatchB = nameB.match(/\s+(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i);

        const baseA = romanMatchA ? nameA.substring(0, romanMatchA.index) : nameA;
        const baseB = romanMatchB ? nameB.substring(0, romanMatchB.index) : nameB;

        if (baseA.toLowerCase() === baseB.toLowerCase() && romanMatchA && romanMatchB) {
            return romanToInt(romanMatchA[1]) - romanToInt(romanMatchB[1]);
        }

        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // 3. Resetear el estado del carrusel
    carousel.innerHTML = '';
    showroomLoadedCount = 0;
    carousel.scrollLeft = 0;

    // 4. Inyectar el primer lote o mostrar error
    if (filteredShowroomStock.length === 0) {
        carousel.innerHTML = `
            <div class="empty-state" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; grid-column: 1 / -1;">
                <iconify-icon icon="solar:car-broken-bold-duotone" class="empty-state-icon" style="font-size: 5vw;"></iconify-icon>
                <span class="empty-state-text" style="color: #888; font-size: 1vw; margin-top: 1vw;">No se encontraron vehículos en esta categoría</span>
            </div>
        `;
    } else {
        loadMoreShowroomVehicles();
    }

    updateCarouselMask();
}

// Función Lazy Load: Dibuja las tarjetas físicamente en el HTML
function loadMoreShowroomVehicles() {
    const carousel = document.getElementById('vehicle-carousel');
    if (!carousel) return;

    // Recortamos los siguientes 65 vehículos
    const nextBatch = filteredShowroomStock.slice(showroomLoadedCount, showroomLoadedCount + SHOWROOM_BATCH_SIZE);

    nextBatch.forEach(v => {
        const card = document.createElement('div');
        card.className = 'vehicle-card';
        card.setAttribute('data-model', v.model);

        const formattedPrice = new Intl.NumberFormat('es-ES').format(v.price || 0);

        card.innerHTML = `
            <div class="card-header-info">
                <div class="card-brand-logo"><i class="fa-solid fa-car"></i></div>
                <div class="card-text-info">
                    <span class="card-brand-name">${v.brand || 'Custom'}</span>
                    <span class="card-model-name">${v.name || v.model}</span>
                </div>
            </div>
            
            <div class="card-vehicle-image" style="position: relative; display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; overflow: hidden; padding: 0.5vw; background: rgba(0,0,0,0.2);">
                
                ${getSmartVehicleImage(v.model, v.shop)}
                
                <span style="position: absolute; bottom: 0.4vw; right: 0.4vw; color: #fff; font-weight: 900; font-size: 0.9vw; text-shadow: 0 4px 10px rgba(0,0,0,1); z-index: 2; font-family: 'Orbitron', sans-serif;">
                    $ ${formattedPrice}
                </span>
            </div>
        `;
        carousel.appendChild(card);

        card.addEventListener('click', () => {
            selectShowroomVehicle(v);
        });
    });

    showroomLoadedCount += nextBatch.length;
    updateCarouselMask();
}

// Scroll Infinito HORIZONTAL: Detectar cuando llegamos al fondo derecho
document.getElementById('vehicle-carousel')?.addEventListener('scroll', function () {
    updateCarouselMask();

    // Matemática: Si la barra de scroll (Left) + el tamaño visible (Client) es casi igual al tamaño total oculto (ScrollWidth)
    if (this.scrollLeft + this.clientWidth >= this.scrollWidth - 100) {
        if (showroomLoadedCount < filteredShowroomStock.length) {
            loadMoreShowroomVehicles(); // Inyectamos 65 más
        }
    }
});

// Control dinámico del difuminado (Máscaras CSS)
function updateCarouselMask() {
    const carousel = document.getElementById('vehicle-carousel');
    if (!carousel) return;

    const scrollLeft = carousel.scrollLeft;
    const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;
    const tolerance = 2; // Margen de error en píxeles

    // Limpiamos todas las clases
    carousel.classList.remove('mask-both', 'mask-left', 'mask-right', 'mask-none');

    if (maxScrollLeft <= 0) {
        carousel.classList.add('mask-none');
    } else if (scrollLeft <= tolerance) {
        carousel.classList.add('mask-right');
    } else if (scrollLeft >= maxScrollLeft - tolerance) {
        carousel.classList.add('mask-left');
    } else {
        carousel.classList.add('mask-both');
    }
}

// Función para seleccionar un vehículo y mostrar su info
function selectShowroomVehicle(vehicle) {

    if (isCompareModeActive && currentPreviewVehicle) {
        if (currentPreviewVehicle === vehicle.model) return;

        currentCompareVehicle = vehicle.model;

        // 1. Seleccionamos ambos elementos h2
        const baseTitle = document.querySelector('#base-stats-panel .panel-category-title');
        const compareTitle = document.querySelector('#compare-stats-panel .panel-category-title');

        // 2. Aplicamos el mismo formato de título a AMBOS
        const brand1 = currentPreviewVehicleData.brand ? currentPreviewVehicleData.brand + ' ' : '';
        const name1 = (currentPreviewVehicleData.name || currentPreviewVehicleData.model).toUpperCase();

        const brand2 = vehicle.brand ? vehicle.brand + ' ' : '';
        const name2 = (vehicle.name || vehicle.model).toUpperCase();

        if (baseTitle) {
            baseTitle.innerHTML = `RENDIMIENTO | <span style="color: #aaa; font-size: 0.7vw; margin-left: 5px;">${brand1 + name1}</span>`;
        }
        if (compareTitle) {
            compareTitle.innerHTML = `RENDIMIENTO | <span style="color: #aaa; font-size: 0.7vw; margin-left: 5px;">${brand2 + name2}</span>`;
        }

        // Mostrar el panel y pedir stats
        document.getElementById('compare-stats-panel').style.display = 'flex';
        updateCardSelectionVisuals();

        fetch(`https://${GetParentResourceName()}/requestCompareStats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: vehicle.model })
        });

        return;
    }

    // ==========================================
    // FLUJO NORMAL (Coche Base)
    // ==========================================
    currentPreviewVehicle = vehicle.model;
    currentPreviewVehicleData = vehicle;
    const baseTitle = document.querySelector('#base-stats-panel .panel-category-title');
    if (baseTitle) baseTitle.innerText = "RENDIMIENTO";
    currentActiveExtras = null;
    currentCompareVehicle = null; // Si cambiamos el coche base, borramos el coche a comparar

    const panel = document.getElementById('vehicle-info-panel');
    if (!panel) return;

    // Si estábamos comparando y seleccionamos uno nuevo como base, APAGAMOS LA COMPARATIVA POR COMPLETO
    if (isCompareModeActive) {
        isCompareModeActive = false;
        const btnCompare = document.getElementById('showroom-compare-btn');
        if (btnCompare) btnCompare.classList.remove('active');

        const comparePanel = document.getElementById('compare-stats-panel');
        if (comparePanel) comparePanel.style.display = 'none';
    }

    // Pintar la tarjeta verde (Base) y limpiar la azul
    updateCardSelectionVisuals();

    // OCULTAR PANELES LATERALES AL CAMBIAR DE VEHÍCULO
    const paymentPanel = document.getElementById('payment-selection-panel');
    if (paymentPanel) paymentPanel.style.display = 'none';

    const extrasPanel = document.getElementById('extras-selection-panel');
    if (extrasPanel) extrasPanel.style.display = 'none';

    // RESETEAR CÁMARA DE MATRÍCULA AL CAMBIAR DE COCHE
    if (isPlateViewActive) {
        isPlateViewActive = false;
        const btnPlate = document.getElementById('change-plate');
        if (btnPlate) {
            btnPlate.classList.remove('active');
            btnPlate.innerText = 'CAMBIAR MATRÍCULA';
            btnPlate.style.background = '';
        }
        fetch(`https://${GetParentResourceName()}/focusPlateCamera`, {
            method: 'POST',
            body: JSON.stringify({ focus: false })
        });
    }

    // Limpiar el input de la matrícula y ocultar alertas
    currentCustomPlate = "";
    const plateInput = document.getElementById('custom-plate-input');
    const plateWarning = document.getElementById('plate-warning');
    if (plateInput) plateInput.value = "";
    if (plateWarning) plateWarning.style.display = 'none';

    // Asegurarnos de que el panel se oculte al seleccionar otro coche
    const platePanel = document.getElementById('plate-modifier-panel');
    if (platePanel) platePanel.style.display = 'none';

    // 1. Mostramos el panel si estaba oculto
    panel.style.display = 'flex';

    // MOSTRAR EL PANEL DERECHO CLONADO
    const rightCustomPanel = document.getElementById('right-custom-panel');
    if (rightCustomPanel) rightCustomPanel.style.display = 'flex';

    // Las ponemos a 0 visualmente. Cuando el cliente termine de spawnear...
    const statFills = ['speed', 'accel', 'brakes', 'handling'];
    statFills.forEach(stat => {
        const fill = document.getElementById(`stat-${stat}-fill`);
        const val = document.getElementById(`stat-${stat}-val`);
        if (fill) fill.style.width = '0%';
        if (val) val.innerText = '0.0 / 10';
    });

    // RESETEAR CUADRÍCULA EXTRA (Efecto Escáner)
    const maxSpeedEl = document.getElementById('detail-max-speed');
    if (maxSpeedEl) maxSpeedEl.innerText = '--';

    const classBadgeEl = document.getElementById('info-vehicle-class');
    if (classBadgeEl) {
        classBadgeEl.innerText = '--';
        classBadgeEl.className = 'vehicle-class-badge class-e';
    }

    const seatsEl = document.getElementById('detail-seats');
    if (seatsEl) seatsEl.innerText = '--';

    const accelTimeEl = document.getElementById('detail-acceleration-time');
    if (accelTimeEl) accelTimeEl.innerText = '--';

    const tuningBox = document.getElementById('detail-tuning-box');
    const tuningText = document.getElementById('detail-tuning-text');
    if (tuningBox) {
        tuningBox.classList.remove('tuning-available');
        tuningBox.classList.add('tuning-unavailable');
    }
    if (tuningText) tuningText.innerText = '--';

    // 2. Actualizamos los textos
    document.getElementById('info-brand-name').innerText = vehicle.brand || 'CUSTOM';
    document.getElementById('info-model-name').innerText = vehicle.name || vehicle.model;

    const formattedPrice = new Intl.NumberFormat('es-ES').format(vehicle.price || 0);
    document.getElementById('info-vehicle-price').innerText = `$ ${formattedPrice}`;
    document.getElementById('info-vehicle-stock').innerText = vehicle.stock || 0;

    // 2.5 LÓGICA DE STOCK Y RESERVAS
    const buyBtn = document.getElementById('buy-vehicle');
    const extrasPlateRow = document.getElementById('row-extras-plate');

    buyBtn.dataset.model = vehicle.model;
    buyBtn.dataset.price = vehicle.price || 0;
    buyBtn.dataset.brand = vehicle.brand || 'CUSTOM';
    buyBtn.dataset.name = vehicle.name || vehicle.model;

    buyBtn.disabled = false;
    buyBtn.style.background = '';
    buyBtn.style.color = '';

    if ((vehicle.stock || 0) <= 0) {
        if (extrasPlateRow) extrasPlateRow.style.display = 'none';
        if (myPendingReservations.includes(vehicle.model)) {
            buyBtn.innerText = 'YA RESERVADO';
            buyBtn.dataset.action = 'none';
            buyBtn.disabled = true;
            buyBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            buyBtn.style.color = 'rgba(255, 255, 255, 0.3)';
            buyBtn.style.cursor = 'not-allowed';
        } else {
            buyBtn.innerText = '¡RESERVAR AHORA!';
            buyBtn.dataset.action = 'reserve';
            buyBtn.style.cursor = 'pointer';
        }
    } else {
        buyBtn.innerText = 'COMPRAR';
        buyBtn.dataset.action = 'buy';
        buyBtn.style.cursor = 'pointer';
        if (extrasPlateRow) extrasPlateRow.style.display = 'flex';
    }

    // 3. Generamos la paleta de colores interactiva
    const colorGrid = document.getElementById('gta-colors-list');
    colorGrid.innerHTML = '';

    GTA_COLORS.forEach(colorData => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'color-option';
        colorDiv.style.backgroundColor = colorData.hex;
        colorDiv.title = colorData.name;

        if (currentPreviewColor === colorData.id) {
            colorDiv.classList.add('selected');
        }

        colorDiv.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            colorDiv.classList.add('selected');
            currentPreviewColor = colorData.id;
            fetch(`https://${GetParentResourceName()}/updateVehicleColor`, {
                method: 'POST',
                body: JSON.stringify({ color: currentPreviewColor })
            });
        });

        colorGrid.appendChild(colorDiv);
    });

    // 4. Llamamos a la previsualización del vehículo
    fetch(`https://${GetParentResourceName()}/previewVehicle`, {
        method: 'POST',
        body: JSON.stringify({
            model: vehicle.model,
            color: currentPreviewColor
        })
    });
}

// Función para actualizar los bordes de color de las tarjetas seleccionadas
function updateCardSelectionVisuals() {
    // 1. Limpiamos todas las tarjetas primero
    document.querySelectorAll('.vehicle-card').forEach(card => {
        card.classList.remove('selected', 'selected-base', 'selected-compare');
    });

    // 2. Pintamos el Coche Base
    if (currentPreviewVehicle) {
        const baseCard = document.querySelector(`.vehicle-card[data-model="${currentPreviewVehicle}"]`);
        if (baseCard) {
            if (isCompareModeActive) {
                // Si estamos comparando, lo ponemos verde y con el "1"
                baseCard.classList.add('selected-base');
            } else {
                // Si NO estamos comparando, lo ponemos blanco normal
                baseCard.classList.add('selected');
            }
        }
    }

    // 3. Pintamos el Coche a Comparar (Azul y número "2")
    if (currentCompareVehicle && isCompareModeActive) {
        const compareCard = document.querySelector(`.vehicle-card[data-model="${currentCompareVehicle}"]`);
        if (compareCard) {
            compareCard.classList.add('selected-compare');
        }
    }
}

// Función para resetear el panel
function hideVehicleInfo() {
    const infoPanel = document.getElementById('vehicle-info-panel');
    if (infoPanel) infoPanel.style.display = 'none';

    // Ocultar paletas de colores con comprobación de seguridad
    const colorPalette = document.getElementById('color-palette-container');
    if (colorPalette) colorPalette.style.display = 'none';

    // Asegurarnos de que los dos paneles laterales se cierran
    const paymentPanel = document.getElementById('payment-selection-panel');
    if (paymentPanel) paymentPanel.style.display = 'none';

    const extrasPanel = document.getElementById('extras-selection-panel');
    if (extrasPanel) extrasPanel.style.display = 'none';

    const rgbPanelToHide = document.getElementById('rgb-selection-panel');
    if (rgbPanelToHide) rgbPanelToHide.style.display = 'none';

    // OCULTAR EL PANEL DERECHO CLONADO
    const rightCustomPanel = document.getElementById('right-custom-panel');
    if (rightCustomPanel) rightCustomPanel.style.display = 'none';

    // Ocultar el panel de la matrícula al cerrar los menús
    const platePanel = document.getElementById('plate-modifier-panel');
    if (platePanel) platePanel.style.display = 'none';

    // Resetear variables de matrícula al cerrar todo
    currentCustomPlate = "";
    const pInput = document.getElementById('custom-plate-input');
    if (pInput) pInput.value = "";

    currentPreviewVehicle = null;

    // Resetear variables del cupón al cerrar o cambiar coche
    if (typeof appliedDiscountData !== 'undefined') {
        appliedDiscountData = null;
    }
    const discInput = document.getElementById('input-purchase-discount');
    const discBtn = document.getElementById('btn-apply-discount');
    const discMsg = document.getElementById('discount-status-msg');
    const rowDisc = document.getElementById('conf-discount-block');

    if (discInput) { discInput.value = ''; discInput.disabled = false; discInput.style.opacity = '1'; }
    if (discBtn) discBtn.style.display = 'block';
    if (discMsg) discMsg.style.display = 'none';
    if (rowDisc) rowDisc.style.display = 'none';
}

// =================================================================
// MÓDULO: SELECTOR DE COLOR CUSTOM (IRO.JS)
// =================================================================
const customRgbBtn = document.getElementById('custom-rgb-btn');
const rgbPanel = document.getElementById('rgb-selection-panel');
const closeRgbBtn = document.getElementById('close-rgb-panel');
const applyRgbBtn = document.getElementById('apply-rgb-color');

let colorPickerInstance = null;

function initColorPicker() {
    if (colorPickerInstance) return;

    // Inicializar Iro.js adaptado al tamaño del panel
    colorPickerInstance = new iro.ColorPicker("#iro-color-picker", {
        width: 180, // Tamaño ajustado al ancho de tu UI
        color: "#ffffff",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
        layout: [
            { component: iro.ui.Box, options: {} },
            { component: iro.ui.Slider, options: { sliderType: 'hue', marginTop: 15 } }
        ]
    });

    // Evento al cambiar color en la ruleta
    colorPickerInstance.on('color:change', function (color) {
        document.getElementById('in-hex').value = color.hexString.substring(1).toUpperCase();
        document.getElementById('in-r').value = color.rgb.r;
        document.getElementById('in-g').value = color.rgb.g;
        document.getElementById('in-b').value = color.rgb.b;

        // Enviar color al coche en TIEMPO REAL
        fetch(`https://${GetParentResourceName()}/updateVehicleColor`, {
            method: 'POST',
            body: JSON.stringify({ color: { r: color.rgb.r, g: color.rgb.g, b: color.rgb.b } })
        });
    });

    // Eventos para inputs manuales
    document.getElementById('in-hex').addEventListener('input', function () {
        let val = this.value.trim();
        // Usamos Regex para asegurar que solo manda a iro.js si son exactamente 3 o 6 letras/números válidos
        let isValidHex = /^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/i.test(val);

        if (isValidHex) {
            try {
                colorPickerInstance.color.hexString = "#" + val;
            } catch (error) {
                // Silenciamos cualquier otro error interno de iro.js
            }
        }
    });

    ['r', 'g', 'b'].forEach(c => {
        document.getElementById(`in-${c}`).addEventListener('input', () => {
            const r = document.getElementById('in-r').value || 0;
            const g = document.getElementById('in-g').value || 0;
            const b = document.getElementById('in-b').value || 0;
            colorPickerInstance.color.rgb = { r: parseInt(r), g: parseInt(g), b: parseInt(b) };
        });
    });

    // Presets
    document.querySelectorAll('.dp-swatch').forEach(swatch => {
        swatch.addEventListener('click', function () {
            colorPickerInstance.color.hexString = this.getAttribute('data-hex');
        });
    });
}

// Función global para cambiar entre RGB y HEX (se llama desde el HTML)
window.switchColorMode = (mode) => {
    // 1. Cambiamos la pestaña activa visualmente
    document.querySelectorAll('.tab-btn-color').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 2. Limpiamos TODOS los paneles (les quitamos la clase activa y los ocultamos)
    document.querySelectorAll('.color-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });

    // 3. Activamos SOLO el panel correspondiente
    const targetPanel = document.getElementById(`panel-${mode}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.style.display = 'block';
    }
};

// Abrir el panel
if (customRgbBtn) {
    customRgbBtn.addEventListener('click', () => {
        const paymentPanel = document.getElementById('payment-selection-panel');
        const extrasPanel = document.getElementById('extras-selection-panel');
        if (paymentPanel) paymentPanel.style.display = 'none';
        if (extrasPanel) extrasPanel.style.display = 'none';

        if (rgbPanel) {
            rgbPanel.style.display = rgbPanel.style.display === 'none' ? 'flex' : 'none';
            if (rgbPanel.style.display === 'flex') {
                initColorPicker();
            }
        }
    });
}

// Cerrar panel
if (closeRgbBtn) {
    closeRgbBtn.addEventListener('click', () => {
        if (rgbPanel) rgbPanel.style.display = 'none';
    });
}

// Aplicar el color y mandar a Lua
if (applyRgbBtn) {
    applyRgbBtn.addEventListener('click', () => {
        if (!colorPickerInstance) return;

        const rgb = colorPickerInstance.color.rgb;

        // Apagar los bordes blancos de la cuadrícula de colores GTA clásica
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));

        // Guardar el color como objeto en la variable global
        currentPreviewColor = { r: rgb.r, g: rgb.g, b: rgb.b };

        // Enviar al cliente Lua
        fetch(`https://${GetParentResourceName()}/updateVehicleColor`, {
            method: 'POST',
            body: JSON.stringify({ color: currentPreviewColor })
        });

        if (rgbPanel) rgbPanel.style.display = 'none';

        // Feedback visual en el botón de la paleta
        customRgbBtn.style.background = '#fff';
        customRgbBtn.style.color = '#000';
        setTimeout(() => {
            customRgbBtn.style.background = '';
            customRgbBtn.style.color = '';
        }, 1000);
    });
}

// =================================================================
// SISTEMA DE EXTRAS Y ALTERNANCIA DE PANELES (COMPRAR VS EXTRAS)
// =================================================================

// 1. ALTERNANCIA: Cuando le damos a "COMPRAR"
const btnBuyShowroom = document.getElementById('buy-vehicle');
if (btnBuyShowroom) {
    btnBuyShowroom.addEventListener('click', function () {
        // 1. Tu código actual para abrir/cerrar paneles
        const paymentPanel = document.getElementById('payment-selection-panel');
        const extrasPanel = document.getElementById('extras-selection-panel');
        const rgbPanel = document.getElementById('rgb-selection-panel');

        if (extrasPanel) extrasPanel.style.display = 'none';
        if (rgbPanel) rgbPanel.style.display = 'none';
        if (paymentPanel) paymentPanel.style.display = paymentPanel.style.display === 'none' ? 'flex' : 'none';

        // 2. BLOQUEO DINÁMICO DE ENTREGAS
        // Leemos el texto del botón en ese milisegundo. Si dice "RESERV...", es una reserva.
        const isReservation = this.innerText.toUpperCase().includes('RESERV');

        const optionDrive = document.querySelector('[data-delivery="drive"]') || document.getElementById('delivery-drive') || document.querySelector('.delivery-option:nth-child(1)');
        const optionGarage = document.querySelector('[data-delivery="garage"]') || document.getElementById('delivery-garage') || document.querySelector('.delivery-option:nth-child(2)');

        if (optionDrive && optionGarage) {
            if (isReservation) {
                // ES RESERVA: Bloqueamos "Sacar del concesionario" y forzamos "Garaje"
                optionDrive.style.opacity = '0.3';
                optionDrive.style.pointerEvents = 'none';
                optionDrive.style.filter = 'grayscale(100%)';
                optionGarage.click();
            } else {
                // ES COMPRA: Restauramos la opción por si antes estaba bloqueada
                optionDrive.style.opacity = '1';
                optionDrive.style.pointerEvents = 'auto';
                optionDrive.style.filter = 'none';
            }
        }
    });
}

// 2. ALTERNANCIA: Cuando le damos a "EXTRAS" (Asume que el ID de tu botón es btn-vehicle-extras)
const btnExtrasShowroom = document.getElementById('vehicle-extras');
if (btnExtrasShowroom) {
    btnExtrasShowroom.addEventListener('click', () => {
        // OCULTAMOS EL PANEL DE PAGO
        const paymentPanel = document.getElementById('payment-selection-panel');
        if (paymentPanel) paymentPanel.style.display = 'none';

        const rgbPanel = document.getElementById('rgb-selection-panel');
        if (rgbPanel) rgbPanel.style.display = 'none';

        const extrasPanel = document.getElementById('extras-selection-panel');
        if (extrasPanel) {
            if (extrasPanel.style.display === 'none') {
                extrasPanel.style.display = 'flex';

                // Ponemos un icono de carga temporal por si tarda
                document.getElementById('extras-list-container').innerHTML = `
                    <div class="empty-extras-msg">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>Buscando modificaciones...</span>
                    </div>
                `;

                // Le pedimos al Lua que escanee el vehículo físico que estamos mirando
                fetch(`https://${GetParentResourceName()}/requestVehicleExtras`, {
                    method: 'POST',
                    body: JSON.stringify({})
                });
            } else {
                // Si ya estaba abierto, lo cerramos
                extrasPanel.style.display = 'none';
            }
        }
    });
}

// 3. CERRAR DESDE EL PANEL DE EXTRAS
const closeExtrasBtn = document.getElementById('close-extras');
if (closeExtrasBtn) {
    closeExtrasBtn.addEventListener('click', () => {
        document.getElementById('extras-selection-panel').style.display = 'none';
    });
}

// 3.5 ALTERNANCIA: Cuando le damos a "CAMBIAR MATRÍCULA"
const btnChangePlate = document.getElementById('change-plate');
if (btnChangePlate) {
    btnChangePlate.addEventListener('click', () => {
        isPlateViewActive = !isPlateViewActive; // Invertimos el estado
        const platePanel = document.getElementById('plate-modifier-panel'); // Panel de matrícula

        if (isPlateViewActive) {
            // Activado: Cambiamos visualmente el botón y avisamos a Lua
            btnChangePlate.classList.add('active');
            btnChangePlate.innerText = 'VISTA NORMAL';
            btnChangePlate.style.background = 'rgba(255, 255, 255, 0.2)';
            if (platePanel) platePanel.style.display = 'flex'; // MOSTRAMOS EL PANEL
        } else {
            // Desactivado: Restauramos el botón y avisamos a Lua
            btnChangePlate.classList.remove('active');
            btnChangePlate.innerText = 'CAMBIAR MATRÍCULA';
            btnChangePlate.style.background = '';
            if (platePanel) platePanel.style.display = 'none'; // OCULTAMOS EL PANEL
        }

        // Enviamos la orden al cliente para mover la cámara
        fetch(`https://${GetParentResourceName()}/focusPlateCamera`, {
            method: 'POST',
            body: JSON.stringify({ focus: isPlateViewActive })
        });
    });
}

// 3.6 LÓGICA DEL INPUT DE LA MATRÍCULA CUSTOM EN TIEMPO REAL
const plateInput = document.getElementById('custom-plate-input');
const plateWarning = document.getElementById('plate-warning');
if (plateInput) {
    plateInput.addEventListener('input', function (e) {
        // 1. Filtramos todo lo que no sea Letra (incluida la Ñ), Número o Espacio
        let rawValue = this.value.toUpperCase();
        let filteredValue = rawValue.replace(/[^A-Z0-9Ñ\s]/g, '');

        // 2. Si el usuario escribió un símbolo raro, lo forzamos a borrarse visualmente
        if (rawValue !== filteredValue) {
            this.value = filteredValue;
        }

        currentCustomPlate = filteredValue;

        // ACTUALIZACIÓN EN VIVO DEL RESUMEN (FACTURA)
        const confirmPanel = document.getElementById('purchase-confirmation-panel');
        if (confirmPanel && confirmPanel.style.display !== 'none') {
            isCustomPlateApplied = (currentCustomPlate.trim() !== "");
            if (typeof window.calculateFinalCheckoutPrice === 'function') {
                window.calculateFinalCheckoutPrice(); // Llama a la función maestra
            }
        }

        // 3. Validación de Longitud y Envío al Coche 3D
        if (currentCustomPlate.length > 8) {
            // Máximo superado: Mostramos alerta roja
            if (plateWarning) plateWarning.style.display = 'flex';
        } else if (currentCustomPlate.length === 0) {
            // Vacío: Ocultamos alerta (quizá el jugador simplemente ya no quiere matrícula)
            // Y mandamos a Lua que ponga la aleatoria en el coche
            if (plateWarning) plateWarning.style.display = 'none';
            fetch(`https://${GetParentResourceName()}/updateVehiclePlate`, {
                method: 'POST',
                body: JSON.stringify({ plate: "" })
            });
        } else {
            // Normal (1 a 8 caracteres): Ocultamos alerta y actualizamos el coche
            if (plateWarning) plateWarning.style.display = 'none';
            fetch(`https://${GetParentResourceName()}/updateVehiclePlate`, {
                method: 'POST',
                body: JSON.stringify({ plate: currentCustomPlate })
            });
        }
    });
}

// 4. GENERADOR DINÁMICO DE LA LISTA DE EXTRAS
function renderVehicleExtras(extras) {
    const container = document.getElementById('extras-list-container');
    container.innerHTML = '';

    // Inicializamos la memoria de extras para este coche
    currentActiveExtras = [];

    if (!extras || extras.length === 0) {
        container.innerHTML = `
            <div class="empty-extras-msg">
                <i class="fa-solid fa-circle-info"></i>
                <span>Este vehículo no dispone de extras.</span>
            </div>
        `;
        return;
    }

    extras.forEach(extra => {
        // Si el extra ya viene encendido de fábrica, lo guardamos
        if (extra.enabled) {
            currentActiveExtras.push(extra.id);
        }

        const div = document.createElement('div');
        div.className = `extra-item ${extra.enabled ? 'active' : ''}`;
        div.innerHTML = `
            <span>EXTRA ${extra.id}</span>
            <i class="fa-solid fa-power-off"></i>
        `;

        div.addEventListener('click', function () {
            const isNowActive = this.classList.toggle('active');

            // Actualizamos la lista mental del JS en tiempo real
            if (isNowActive) {
                if (!currentActiveExtras.includes(extra.id)) currentActiveExtras.push(extra.id);
            } else {
                currentActiveExtras = currentActiveExtras.filter(id => id !== extra.id);
            }

            fetch(`https://${GetParentResourceName()}/toggleVehicleExtra`, {
                method: 'POST',
                body: JSON.stringify({
                    extraId: extra.id,
                    state: isNowActive
                })
            });
        });

        container.appendChild(div);
    });
}

// =================================================================
// EVENTO DEL BOTÓN PRUEBA DE MANEJO
// =================================================================
const testDriveBtn = document.getElementById('test-drive');
if (testDriveBtn) {
    testDriveBtn.addEventListener('click', function () {
        if (!currentPreviewVehicle) return;

        // Recogemos la matrícula personalizada si la pusieron
        const plateInput = document.getElementById('custom-plate-input');
        const customPlate = plateInput ? plateInput.value.trim().toUpperCase() : '';

        // Recogemos los extras activos en el coche de preview
        fetch(`https://${GetParentResourceName()}/requestVehicleExtras`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        // Empaquetamos todo lo que necesita el cliente para spawnear el coche
        const testDriveData = {
            model: currentPreviewVehicle,
            color: currentPreviewColor,
            plate: customPlate !== '' ? customPlate : 'PRUEBA',
            extras: [] // Se rellenarán en el NUICallback del cliente
        };

        fetch(`https://${GetParentResourceName()}/startTestDrive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(testDriveData)
        });
    });
}

// =================================================================
// FUNCIÓN DE CIERRE DEL SHOWROOM
// =================================================================
function closeShowroom() {
    isShowroomOpen = false;
    document.getElementById('showroom-container').style.display = 'none';

    hideVehicleInfo();       // Oculta el panel izquierdo y derecho
    currentPreviewColor = 0;
    currentPreviewVehicle = null; // Limpiamos la memoria del coche seleccionado

    // Resetear el estado de la matrícula al cerrar
    if (isPlateViewActive) {
        isPlateViewActive = false;
        const btnPlate = document.getElementById('change-plate');
        if (btnPlate) {
            btnPlate.classList.remove('active');
            btnPlate.innerText = 'CAMBIAR MATRÍCULA';
            btnPlate.style.background = '';
        }
    }

    // Apagamos completamente el modo Vista Previa
    const previewUI = document.getElementById('preview-mode-ui');
    if (previewUI) previewUI.style.display = 'none';
    isPreviewModeActive = false;
    isDraggingPreview = false;
    document.body.style.cursor = 'default';

    // Nos aseguramos por fuerza bruta de que los paneles no se queden encendidos
    const infoPanelPreview = document.getElementById('vehicle-info-panel');
    const rightPanelPreview = document.getElementById('right-custom-panel');
    const carouselContainerPreview = document.querySelector('.bottom-carousel-container');

    if (infoPanelPreview) infoPanelPreview.style.display = 'none';
    if (rightPanelPreview) rightPanelPreview.style.display = 'none';

    // Al cerrar, nos aseguramos de que la próxima vez que se abra, el carrusel SÍ se vea
    if (carouselContainerPreview) carouselContainerPreview.style.display = 'flex';

    fetch(`https://${GetParentResourceName()}/closeShowroomMenu`, {
        method: 'POST'
    }).catch(err => console.log(err));
}

// =================================================================
// EVENTO DE COMPRA / RESERVA DE VEHÍCULO
// =================================================================
const mainBuyBtn = document.getElementById('buy-vehicle');

if (mainBuyBtn) {
    mainBuyBtn.addEventListener('click', function () {
        console.log("[DP-JS] 🛒 Clic en botón 'Comprar'. Abriendo panel...");
        const action = this.dataset.action;

        if (action === 'none' || this.disabled) return;

        const paymentPanel = document.getElementById('payment-selection-panel');
        if (paymentPanel) {
            paymentPanel.style.display = 'flex';

            // RESET FINANCIACIÓN AL ABRIR
            const installmentsInput = document.getElementById('payment-installments');
            if (installmentsInput) installmentsInput.value = '';
            const downpayInput = document.getElementById('payment-downpayment');
            if (downpayInput) downpayInput.value = '';

            // Volver a poner "Efectivo" por defecto
            document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
            const cashBtn = document.querySelector('.payment-method-btn[data-method="cash"]');
            if (cashBtn) cashBtn.classList.add('active');

            // Volver a poner "Sacar del Concesionario" por defecto
            document.querySelectorAll('.delivery-method-btn').forEach(b => b.classList.remove('active'));
            const driveBtn = document.querySelector('.delivery-method-btn[data-delivery="drive"]');
            if (driveBtn) {
                driveBtn.classList.add('active');
                console.log("[DP-JS] 🔄 Opción de entrega forzada a: DRIVE (Por defecto)");
            }

            const fPanel = document.getElementById('finance-config-panel');
            if (fPanel) fPanel.style.display = 'none';

            financeInstallments = 0;
            financeDownpayment = 0;
            updateFinanceSummary();
        }
    });
}

// =================================================================
// LÓGICA DEL PANEL DE PAGO Y ENTREGA (REDISEÑADO)
// =================================================================

// --- ESTADO DE FINANCIACIÓN ---
let financeInstallments = 0;
let financeDownpayment = 0;

// 1. Botones de Método de Pago (Efectivo / Banco / Financiación)
document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const financePanel = document.getElementById('finance-config-panel');
        const isFinance = this.dataset.method === 'finance';

        // Mostrar/ocultar el panel de configuración de cuotas
        if (financePanel) financePanel.style.display = isFinance ? 'flex' : 'none';

        // Si se cambia a efectivo/banco, reseteamos los valores de financiación
        if (!isFinance) {
            const inp = document.getElementById('payment-installments');
            const dp = document.getElementById('payment-downpayment');
            if (inp) inp.value = '';
            if (dp) dp.value = '';
            financeInstallments = 0;
            financeDownpayment = 0;
            updateFinanceSummary();
        }
    });
});

// 1.5 Lógica de cálculo en tiempo real para Financiación
function updateFinanceSummary() {
    const buyBtn = document.getElementById('buy-vehicle');
    // Usamos el precio base del botón (el JS ya lo tiene actualizado con extras en tu lógica)
    const basePrice = parseInt(buyBtn?.dataset.price) || 0;

    const days = parseInt(document.getElementById('payment-installments')?.value) || 0;
    const downpay = parseInt(document.getElementById('payment-downpayment')?.value) || 0;

    financeInstallments = days;
    financeDownpayment = downpay;

    // Calculamos el total que queda por financiar tras la entrada
    const toFinance = Math.max(0, basePrice - downpay);
    const daily = days > 0 ? Math.ceil(toFinance / days) : 0;

    const fmt = v => '$' + new Intl.NumberFormat('es-ES').format(v);

    if (document.getElementById('fs-daily')) document.getElementById('fs-daily').innerText = days > 0 ? fmt(daily) : '—';
    if (document.getElementById('fs-total')) document.getElementById('fs-total').innerText = days > 0 ? fmt(toFinance) : '—';
    if (document.getElementById('fs-days')) document.getElementById('fs-days').innerText = days > 0 ? days + ' días' : '— días';
}

document.getElementById('payment-installments')?.addEventListener('input', updateFinanceSummary);
document.getElementById('payment-downpayment')?.addEventListener('input', updateFinanceSummary);

// 2. Botones de Entrega (Concesionario / Garaje)
document.querySelectorAll('.delivery-method-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        console.log("[DP-JS] 👆 Has clicado en Entrega. Valor seleccionado: " + this.dataset.delivery);

        // Quitamos la clase 'active' a todos
        document.querySelectorAll('.delivery-method-btn').forEach(b => b.classList.remove('active'));

        // Se la ponemos solo al que hemos clickeado
        this.classList.add('active');
    });
});

// 3. Botón CANCELAR
const cancelPaymentBtn = document.getElementById('cancel-payment');
if (cancelPaymentBtn) {
    cancelPaymentBtn.addEventListener('click', () => {
        document.getElementById('payment-selection-panel').style.display = 'none';
    });
}

// =================================================================
// MÓDULO: CONFIRMACIÓN DE COMPRA EN 2 PASOS (RESUMEN, MATRÍCULA Y EXTRAS)
// =================================================================

let isCustomPlateApplied = false;
let finalPurchasePrice = 0;
const EXTRA_PRICE_UNIT = 125; // Precio por cada extra
let appliedDiscountData = null; // Memoria del cupón aplicado

// FUNCIÓN MAESTRA: Calcula todo el ticket de golpe sin errores
window.calculateFinalCheckoutPrice = function () {
    const buyBtn = document.getElementById('buy-vehicle');
    const basePrice = buyBtn ? (parseInt(buyBtn.dataset.price) || 0) : 0;
    let tempFinalPrice = basePrice;

    // 1. DESCUENTO (Calculado sobre el precio base)
    if (appliedDiscountData) {
        const discountAmount = Math.floor(basePrice * (appliedDiscountData.percentage / 100));
        tempFinalPrice -= discountAmount; // Se lo restamos al total

        const rowDisc = document.getElementById('conf-discount-block');
        if (rowDisc) rowDisc.style.display = 'flex';
        document.getElementById('conf-discount-perc-text').innerText = `(${appliedDiscountData.percentage}%)`;
        document.getElementById('conf-discount-amount').innerText = "- $ " + new Intl.NumberFormat('es-ES').format(discountAmount);
    } else {
        const rowDisc = document.getElementById('conf-discount-block');
        if (rowDisc) rowDisc.style.display = 'none';
    }

    // 2. MATRÍCULA
    const customPlateBlock = document.getElementById('conf-custom-plate-block');
    const plateTextPreview = document.getElementById('conf-plate-text');
    if (isCustomPlateApplied) {
        tempFinalPrice += 25000; // Sumamos placa
        if (customPlateBlock) customPlateBlock.style.display = 'flex';
        if (plateTextPreview) plateTextPreview.innerText = `(${currentCustomPlate})`;
    } else {
        if (customPlateBlock) customPlateBlock.style.display = 'none';
    }

    // 3. EXTRAS
    const extrasBlock = document.getElementById('conf-extras-block');
    const extrasCountLabel = document.getElementById('conf-extras-count');
    const extrasPriceLabel = document.getElementById('conf-extras-price');
    const activeExtrasCount = (currentActiveExtras && Array.isArray(currentActiveExtras)) ? currentActiveExtras.length : 0;

    if (activeExtrasCount > 0) {
        const totalExtrasCost = activeExtrasCount * EXTRA_PRICE_UNIT;
        tempFinalPrice += totalExtrasCost; // Sumamos extras
        if (extrasBlock) extrasBlock.style.display = 'flex';
        if (extrasCountLabel) extrasCountLabel.innerText = `(${activeExtrasCount} Activadas)`;
        if (extrasPriceLabel) extrasPriceLabel.innerText = `+ $ ${new Intl.NumberFormat('es-ES').format(totalExtrasCost)}`;
    } else {
        if (extrasBlock) extrasBlock.style.display = 'none';
    }

    // PLASMAMOS EL PRECIO FINAL
    finalPurchasePrice = tempFinalPrice;
    document.getElementById('conf-base-price').innerText = "$ " + new Intl.NumberFormat('es-ES').format(basePrice);
    document.getElementById('conf-total-price').innerText = "$ " + new Intl.NumberFormat('es-ES').format(finalPurchasePrice);
};

// --- BOTÓN CONFIRMAR DEL PANEL DE PAGO ---
const confirmFinalBuyBtn = document.getElementById('confirm-final-buy');
if (confirmFinalBuyBtn) {
    confirmFinalBuyBtn.addEventListener('click', () => {
        isCustomPlateApplied = (currentCustomPlate && currentCustomPlate.trim() !== "");

        window.calculateFinalCheckoutPrice(); // Forzamos el cálculo perfecto

        const activeMethodBtn = document.querySelector('.payment-method-btn.active');
        const methodMap = { cash: 'EFECTIVO', bank: 'BANCO', finance: 'FINANCIACIÓN' };
        const methodKey = activeMethodBtn ? activeMethodBtn.dataset.method : 'cash';

        document.getElementById('conf-method-selected').innerText = methodMap[methodKey] || 'EFECTIVO';

        const activeDeliveryBtn = document.querySelector('.delivery-method-btn.active');
        document.getElementById('conf-delivery-selected').innerText = activeDeliveryBtn && activeDeliveryBtn.dataset.delivery === 'garage' ? 'GARAJE' : 'CONCES.';

        document.getElementById('payment-selection-panel').style.display = 'none';
        document.getElementById('purchase-confirmation-panel').style.display = 'flex';
    });
}

// --- BOTÓN DE COMPROBAR/APLICAR CUPÓN ---
document.getElementById('btn-apply-discount')?.addEventListener('click', () => {
    const input = document.getElementById('input-purchase-discount');
    const msg = document.getElementById('discount-status-msg');
    const code = input.value.trim().toUpperCase();

    if (code === '') return;

    // Efecto de cargando...
    const btn = document.getElementById('btn-apply-discount');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    // Preguntamos al servidor si el código sirve para este coche en este concesionario
    fetch(`https://${GetParentResourceName()}/verifyDiscountCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: code,
            model: currentPreviewVehicleData.model,
            category: currentPreviewVehicleData.category
        })
    })
        .then(resp => resp.json())
        .then(data => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> APLICAR';

            if (data.valid) {
                appliedDiscountData = { code: code, percentage: data.percentage };
                msg.style.display = 'block';
                msg.className = 'disc-msg-success';
                msg.innerText = `¡CUPÓN APLICADO! (-${data.percentage}%)`;
                input.disabled = true;
                input.style.opacity = '0.5';
                btn.style.display = 'none';
                window.calculateFinalCheckoutPrice(); // RECALCULAR TOTAL
            } else {
                msg.style.display = 'block';
                msg.className = 'disc-msg-error';
                msg.innerText = data.message || "CÓDIGO INVÁLIDO O CADUCADO.";
            }
        }).catch(err => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> APLICAR';
        });
});

// --- PAPELERA: QUITAR CUPÓN ---
document.getElementById('confirm-reset-discount')?.addEventListener('click', () => {
    appliedDiscountData = null; // Lo borramos de la memoria

    const input = document.getElementById('input-purchase-discount');
    const btn = document.getElementById('btn-apply-discount');
    const msg = document.getElementById('discount-status-msg');

    if (input) { input.value = ''; input.disabled = false; input.style.opacity = '1'; }
    if (btn) btn.style.display = 'block';
    if (msg) msg.style.display = 'none';

    window.calculateFinalCheckoutPrice(); // RECALCULAR TOTAL
});

// --- PAPELERA: EXTRAS ---
const confirmResetExtrasBtn = document.getElementById('confirm-reset-extras');
if (confirmResetExtrasBtn) {
    confirmResetExtrasBtn.addEventListener('click', () => {
        currentActiveExtras = [];
        document.querySelectorAll('.extra-item').forEach(item => item.classList.remove('active'));
        fetch(`https://${GetParentResourceName()}/resetAllVehicleExtras`, {
            method: 'POST', body: JSON.stringify({})
        });
        window.calculateFinalCheckoutPrice();
    });
}

// --- BOTÓN CANCELAR RESUMEN ---
const cancelFinalPurchaseBtn = document.getElementById('cancel-final-purchase');
if (cancelFinalPurchaseBtn) {
    cancelFinalPurchaseBtn.addEventListener('click', () => {
        document.getElementById('purchase-confirmation-panel').style.display = 'none';
        document.getElementById('payment-selection-panel').style.display = 'flex';
    });
}

// --- PAPELERA: MATRÍCULA ---
const confirmResetPlateBtn = document.getElementById('confirm-reset-plate');
if (confirmResetPlateBtn) {
    confirmResetPlateBtn.addEventListener('click', () => {
        currentCustomPlate = "";
        isCustomPlateApplied = false;

        const plateInputDOM = document.getElementById('custom-plate-input') || document.querySelector('.plate-modifier-input');
        if (plateInputDOM) plateInputDOM.value = "";

        fetch(`https://${GetParentResourceName()}/updateVehiclePlate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plate: "" })
        });
        window.calculateFinalCheckoutPrice();
    });
}

// --- BOTÓN ACEPTAR COMPRA FINAL ---
const acceptFinalPurchaseBtn = document.getElementById('accept-final-purchase');
if (acceptFinalPurchaseBtn) {
    acceptFinalPurchaseBtn.addEventListener('click', () => {
        const buyBtn = document.getElementById('buy-vehicle');
        const action = buyBtn.dataset.action; // Detectamos si es compra o reserva

        const activeMethodBtn = document.querySelector('.payment-method-btn.active');
        const paymentMethod = activeMethodBtn ? activeMethodBtn.dataset.method : 'cash';
        const isFinanceMethod = (paymentMethod === 'finance');

        // const activeDeliveryBtn = document.querySelector('.delivery-method-btn.active');
        // const deliveryMethod = activeDeliveryBtn ? activeDeliveryBtn.dataset.delivery : 'drive';

        // FORZAMOS LA ENTREGA A 'DRIVE' PARA SALTARNOS LOS BUGS DEL HTML DURANTE LA PRUEBA
        const deliveryMethod = 'drive';

        console.log("[DP-JS] 📦 Delivery capturado de la UI FORZADO A: " + deliveryMethod);

        // Empaquetamos todo
        const finalVehicleData = {
            model: buyBtn.dataset.model,
            price: parseInt(buyBtn.dataset.price),
            brand: buyBtn.dataset.brand,
            name: buyBtn.dataset.name,
            color: currentPreviewColor,
            paymentType: paymentMethod,
            installments: isFinanceMethod ? financeInstallments : 0,
            downpayment: isFinanceMethod ? financeDownpayment : 0,
            deliveryType: deliveryMethod,
            extras: currentActiveExtras,
            plate: currentCustomPlate,
            discountCode: appliedDiscountData ? appliedDiscountData.code : null
        };

        // 1. ENVIAMOS LA COMPRA AL SERVIDOR INMEDIATAMENTE PARA QUE COBRE
        if (action === 'reserve') {
            fetch(`https://${GetParentResourceName()}/reserveVehicle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalVehicleData)
            });
            myPendingReservations.push(buyBtn.dataset.model);
        } else {
            fetch(`https://${GetParentResourceName()}/buyVehicle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalVehicleData)
            });
        }

        // ==========================================================
        // 2. MAGIA DE SINCRONIZACIÓN: CÁLCULO DEL CAMIÓN (BATCHING)
        // ==========================================================
        // Calculamos los segundos restantes hasta el próximo minuto exacto.
        let secondsLeft = 60 - new Date().getSeconds();
        // Si quedan menos de 5s, le sumamos 1 minuto para asegurar que entra en el siguiente envío y no hay bugs.
        if (secondsLeft < 5) secondsLeft += 60;
        const totalSeconds = secondsLeft;

        // 3. PREPARAMOS LA UI PARA EL TRACKER
        document.getElementById('cancel-final-purchase').style.display = 'none';
        acceptFinalPurchaseBtn.style.display = 'none';

        const discSection = document.querySelector('.discount-code-section');
        if (discSection) discSection.style.display = 'none';

        document.getElementById('delivery-tracker-panel').style.display = 'flex';

        const timeText = document.getElementById('delivery-countdown-time');
        const progressBar = document.getElementById('delivery-progress-bar');
        const titleText = document.querySelector('.delivery-desc');

        // 4. BUCLE DEL TEMPORIZADOR INMERSIVO
        const timerInterval = setInterval(() => {
            secondsLeft--;

            // Formato 00:XX
            const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
            const secs = (secondsLeft % 60).toString().padStart(2, '0');
            if (timeText) timeText.innerText = `${mins}:${secs}`;

            // Progreso de la barra (de 0% a 100%)
            const progressPerc = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
            if (progressBar) progressBar.style.width = `${progressPerc}%`;

            if (secondsLeft <= 0) {
                clearInterval(timerInterval);

                // Efecto de completado
                if (titleText) titleText.innerText = "¡El camión ha salido hacia su destino!";
                if (progressBar) progressBar.style.background = "rgba(255, 255, 255, 0.05)";

                // Esperamos 2 segunditos para que el jugador lea que ha salido, y cerramos solo el panel de compra.
                setTimeout(() => {
                    const confirmPanel = document.getElementById('purchase-confirmation-panel');
                    if (confirmPanel) confirmPanel.style.display = 'none';

                    if (action === 'reserve') {
                        buyBtn.innerText = '¡RESERVA ENVIADA!';
                        buyBtn.style.background = 'rgba(255, 255, 255, 0.05)';
                        buyBtn.style.color = 'rgba(255, 255, 255, 0.3)';
                        buyBtn.disabled = true;
                        setTimeout(() => {
                            buyBtn.innerText = 'YA RESERVADO';
                            buyBtn.style.cursor = 'not-allowed';
                        }, 2500);
                    } else {
                        // COMPRA: Marcamos el botón en verde pero NO cerramos el showroom
                        buyBtn.innerText = '¡COMPRA FINALIZADA!';
                        buyBtn.style.background = 'rgba(255, 255, 255, 0.05)';
                        buyBtn.style.color = 'rgba(255, 255, 255, 0.3)';
                        buyBtn.disabled = true;

                        setTimeout(() => {
                            buyBtn.innerText = 'VEHÍCULO ADQUIRIDO';
                            buyBtn.style.cursor = 'not-allowed';
                        }, 2500);
                    }

                    // Restaurar el panel de confirmación (oculto en background) para la próxima compra
                    document.getElementById('cancel-final-purchase').style.display = 'block';
                    acceptFinalPurchaseBtn.style.display = 'block';
                    document.getElementById('delivery-tracker-panel').style.display = 'none';
                    if (discSection) discSection.style.display = 'block';
                    if (progressBar) {
                        progressBar.style.width = '0%';
                        progressBar.style.background = 'linear-gradient(90deg, #e3be46, #fff4cc)';
                    }
                    if (titleText) titleText.innerText = "Asignando transporte y cargando vehículos en cola...";

                }, 2000);
            }
        }, 1000);

        // Inicializamos los textos en el segundo 0 para que no haya parpadeos
        const initMins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
        const initSecs = (secondsLeft % 60).toString().padStart(2, '0');
        if (timeText) timeText.innerText = `${initMins}:${initSecs}`;
        if (progressBar) progressBar.style.width = `0%`;
    });
}

// =================================================================
// EVENTOS DEL BUSCADOR EXPANDIBLE (SHOWROOM)
// =================================================================
const searchBox = document.getElementById('showroom-search-box');
const searchInput = document.getElementById('showroom-search-input');
const searchClose = document.getElementById('showroom-search-close');

if (searchBox && searchInput && searchClose) {
    // 1. Expandir al hacer clic en la caja (lupa o fondo)
    searchBox.addEventListener('click', () => {
        if (!searchBox.classList.contains('expanded')) {
            searchBox.classList.add('expanded');
            searchInput.focus(); // Ponemos el cursor a parpadear automáticamente
        }
    });

    // 2. Filtrar los vehículos en tiempo real mientras escribes
    searchInput.addEventListener('input', (e) => {
        currentShowroomSearch = e.target.value;
        applyShowroomFilter(currentShowroomCategory); // Filtra dentro de la categoría actual
    });

    // 3. Cerrar al hacer clic en la X, limpiar el texto y restaurar coches
    searchClose.addEventListener('click', (e) => {
        e.stopPropagation(); // ¡VITAL! Evita que el clic "traspase" y vuelva a abrir la caja

        searchBox.classList.remove('expanded'); // Contraemos la caja
        searchInput.value = ''; // Vaciamos el texto visualmente
        searchInput.blur(); // Quitamos el foco

        currentShowroomSearch = ''; // Vaciamos el texto en la memoria
        applyShowroomFilter(currentShowroomCategory); // Restauramos la lista
    });
}

// --- ANIMACIÓN DEL BOTÓN DE AYUDA (SHOWROOM) ---
const helpBtn = document.getElementById('showroom-help-btn');
const closeHelp = document.getElementById('close-help');

if (helpBtn && closeHelp) {
    // Expandir al hacer clic en el botón (si no está ya expandido)
    helpBtn.addEventListener('click', () => {
        if (!helpBtn.classList.contains('expanded')) {
            helpBtn.classList.add('expanded');
        }
    });

    // Cerrar al hacer clic en la X del header
    closeHelp.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitamos que el clic se propague al contenedor padre y lo reabra
        helpBtn.classList.remove('expanded');
    });
}

// --- ACCESO RÁPIDO POR TECLADO (TECLA T) ---
document.addEventListener('keydown', (e) => {
    // Si el showroom no está abierto, ignoramos
    if (!isShowroomOpen) return;

    // Si el usuario ya está escribiendo en algún input, ignoramos
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Tecla T (keyCode 84)
    if (e.key.toLowerCase() === 't') {
        const searchBox = document.getElementById('showroom-search-box');
        const searchInput = document.getElementById('showroom-search-input');

        if (searchBox && searchInput) {
            e.preventDefault(); // Evitamos que escriba la 't' en el input al enfocar

            // Si no está expandido, lo expandimos
            if (!searchBox.classList.contains('expanded')) {
                searchBox.classList.add('expanded');
            }

            // Enfocamos el input y lo dejamos listo para escribir
            searchInput.focus();
        }
    }
});

// =================================================================
// MÓDULO 7.5: MODO VISTA PREVIA (CÁMARA CINEMÁTICA 360º Y DRAG 360)
// =================================================================
const btnPreview = document.getElementById('preview-view');
const btnExitPreview = document.getElementById('exit-preview-btn');
const previewUI = document.getElementById('preview-mode-ui');

const infoPanelPreview = document.getElementById('vehicle-info-panel');
const rightPanelPreview = document.getElementById('right-custom-panel');
const carouselContainerPreview = document.querySelector('.bottom-carousel-container');

// Variables de Control para la Rotación
let isPreviewModeActive = false;
let isDraggingPreview = false;
let previewLastX = 0;

// 1. ENTRAR AL MODO VISTA PREVIA
if (btnPreview) {
    btnPreview.addEventListener('click', () => {
        // Ocultamos toda la interfaz principal
        if (infoPanelPreview) infoPanelPreview.style.display = 'none';
        if (rightPanelPreview) rightPanelPreview.style.display = 'none';
        if (carouselContainerPreview) carouselContainerPreview.style.display = 'none';

        // Mostramos la barra de controles cinemáticos y activamos estado
        if (previewUI) previewUI.style.display = 'flex';
        isPreviewModeActive = true;
        document.body.style.cursor = 'grab'; // Cursor de manita abierta

        // Nos aseguramos de que el botón Exterior esté marcado por defecto al entrar
        document.getElementById('cam-exterior-btn').classList.add('active');
        document.getElementById('cam-interior-btn').classList.remove('active');

        // Avisamos a Lua para que libere los controles y posicione la cámara exterior
        fetch(`https://${GetParentResourceName()}/togglePreviewCamera`, {
            method: 'POST',
            body: JSON.stringify({ mode: 'exterior' })
        }).catch(err => console.log("Error en el callback de Preview: ", err));
    });
}

// 2. SALIR DEL MODO VISTA PREVIA
if (btnExitPreview) {
    btnExitPreview.addEventListener('click', () => {
        // Ocultamos la barra cinemática y desactivamos estado
        if (previewUI) previewUI.style.display = 'none';
        isPreviewModeActive = false;
        isDraggingPreview = false;
        document.body.style.cursor = 'default'; // Restauramos cursor normal

        // Restauramos los paneles SOLO si hay un vehículo seleccionado previamente
        if (currentPreviewVehicle) {
            if (infoPanelPreview) infoPanelPreview.style.display = 'flex';
            if (rightPanelPreview) rightPanelPreview.style.display = 'flex';
        }

        if (carouselContainerPreview) carouselContainerPreview.style.display = 'flex';

        // Avisamos a Lua para que devuelva la cámara a su sitio original del catálogo
        fetch(`https://${GetParentResourceName()}/togglePreviewCamera`, {
            method: 'POST',
            body: JSON.stringify({ mode: 'reset' })
        });
    });
}

// 3. ALTERNAR ENTRE CÁMARA EXTERIOR E INTERIOR
const btnCamExt = document.getElementById('cam-exterior-btn');
const btnCamInt = document.getElementById('cam-interior-btn');

if (btnCamExt && btnCamInt) {
    btnCamExt.addEventListener('click', () => {
        if (btnCamExt.classList.contains('active')) return;
        btnCamExt.classList.add('active');
        btnCamInt.classList.remove('active');
        fetch(`https://${GetParentResourceName()}/togglePreviewCamera`, {
            method: 'POST',
            body: JSON.stringify({ mode: 'exterior' })
        }).catch(err => console.log("Error en el callback de Preview: ", err));
    });

    btnCamInt.addEventListener('click', () => {
        if (btnCamInt.classList.contains('active')) return;
        btnCamInt.classList.add('active');
        btnCamExt.classList.remove('active');
        fetch(`https://${GetParentResourceName()}/togglePreviewCamera`, {
            method: 'POST',
            body: JSON.stringify({ mode: 'interior' })
        });
    });
}

// 4. LÓGICA DE ROTACIÓN 360º (CLICK & DRAG)
window.addEventListener('mousedown', (e) => {
    if (!isPreviewModeActive) return;

    // Si hacemos clic encima de un botón o de la pastilla superior de texto, ignoramos el drag
    if (e.target.closest('.preview-action-btn') ||
        e.target.closest('.preview-toggle-btn') ||
        e.target.closest('.preview-center')) {
        return;
    }

    isDraggingPreview = true;
    previewLastX = e.clientX; // Guardamos la posición inicial X del ratón
    document.body.style.cursor = 'grabbing'; // Manita cerrada (agarrando)
});

// Detectar cuando el usuario suelta el clic
window.addEventListener('mouseup', () => {
    if (!isPreviewModeActive) return;
    isDraggingPreview = false;
    document.body.style.cursor = 'grab'; // Manita abierta de nuevo
});

// Por si el usuario saca el ratón de la ventana de FiveM mientras arrastra
window.addEventListener('mouseleave', () => {
    if (!isPreviewModeActive) return;
    isDraggingPreview = false;
    document.body.style.cursor = 'grab';
});

// Detectar el movimiento constante del ratón
window.addEventListener('mousemove', (e) => {
    // Si no estamos en modo preview o no estamos manteniendo el clic, no hacemos nada
    if (!isPreviewModeActive || !isDraggingPreview) return;

    // Calculamos la diferencia matemática (Delta) entre la posición anterior y la nueva
    let deltaX = e.clientX - previewLastX;
    previewLastX = e.clientX; // Actualizamos para el siguiente frame

    // Si hubo un movimiento real horizontal, se lo mandamos a Lua
    if (deltaX !== 0) {
        fetch(`https://${GetParentResourceName()}/rotatePreviewCamera`, {
            method: 'POST',
            body: JSON.stringify({ dragAmount: deltaX })
        });
    }
});

// LÓGICA DE ZOOM CON SCROLL (VISTA PREVIA)
window.addEventListener('wheel', (e) => {
    if (!isPreviewModeActive) return;

    // Detectamos si el scroll va hacia arriba (negativo) o hacia abajo (positivo)
    let zoomDir = e.deltaY > 0 ? 'out' : 'in';

    fetch(`https://${GetParentResourceName()}/updatePreviewZoom`, {
        method: 'POST',
        body: JSON.stringify({ direction: zoomDir })
    });
});

// =================================================================
// MÓDULO 8: BOSS MENU (DASHBOARD Y NAVEGACIÓN)
// =================================================================

// 1. Sistema de Navegación de Pestañas (Tabs estilo DP-Inventory)
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Quitar clase active de todos los botones y páginas
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.boss-page').forEach(p => p.classList.remove('active'));

        // Usamos currentTarget para capturar el DIV completo, no solo el icono interno
        const targetBtn = e.currentTarget;

        // Activar el botón clicado
        targetBtn.classList.add('active');

        // Mostrar la página correspondiente leyendo el data-target
        const targetId = targetBtn.getAttribute('data-target');
        const pageElement = document.getElementById(targetId);
        if (pageElement) {
            pageElement.classList.add('active');
        }

        // Ocultar botón VOLVER y restaurar el título al cambiar de pestaña principal
        const backBtn = document.getElementById('boss-back-btn');
        if (backBtn) backBtn.style.display = 'none';

        const titleEl = document.getElementById('boss-dealer-title');
        if (titleEl) titleEl.innerText = currentBossDealerName;

        // Generar las tarjetas visuales de stock SOLO si entramos a esa pestaña
        if (targetId === 'tab-vehicles') {

            // Simplemente llamamos a la función. Como ahora tiene lógica de persistencia,
            // si ya habías cargado 300, mantendrá los 300 ahí.
            renderBossVehicles(document.getElementById('boss-vehicles-search').value);
        }
    });
});

// Navegación de Sub-pestañas y Título Dinámico
function openSubTab(tabId) {
    // 1. Ocultar todas las páginas del boss menu
    document.querySelectorAll('.boss-page').forEach(p => p.classList.remove('active'));

    // 2. Mostrar la solicitada
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    // 3. Lógica del Título Superior y el Botón Volver
    const titleEl = document.getElementById('boss-dealer-title');
    const backBtn = document.getElementById('boss-back-btn');

    if (tabId === 'tab-company-staff') {
        titleEl.innerText = currentBossDealerName + ' | CONFIGURACIÓN DEL PERSONAL';
        backBtn.style.display = 'flex';
    } else if (tabId === 'tab-company-settings') {
        titleEl.innerText = currentBossDealerName + ' | CONFIGURACIÓN DE LA EMPRESA';
        backBtn.style.display = 'flex';
    } else {
        // Volvemos a la pestaña base de Compañía
        titleEl.innerText = currentBossDealerName;
        backBtn.style.display = 'none';
    }
}

// Lógica de Inputs Excluyentes (Transferir Empresa)
const transferIdInput = document.getElementById('transfer-id-input');
const transferSelect = document.getElementById('transfer-employee-select');

if (transferIdInput && transferSelect) {
    transferIdInput.addEventListener('input', (e) => {
        if (e.target.value.trim().length > 0) {
            transferSelect.disabled = true;
            transferSelect.style.opacity = '0.5';
        } else {
            transferSelect.disabled = false;
            transferSelect.style.opacity = '1';
        }
    });

    transferSelect.addEventListener('change', (e) => {
        if (e.target.value !== "0") {
            transferIdInput.disabled = true;
            transferIdInput.style.opacity = '0.5';
            transferIdInput.value = '';
        } else {
            transferIdInput.disabled = false;
            transferIdInput.style.opacity = '1';
        }
    });
}


// =================================================================
// MÓDULO 9: BOSS MENU - STOCK DE VEHÍCULOS (LAZY LOAD)
// =================================================================

// 1. Función principal que prepara la búsqueda
function renderBossVehicles(searchTerm = '') {
    const grid = document.getElementById('boss-vehicles-grid');
    if (!grid) return;

    const term = searchTerm.toLowerCase().trim();

    // Decidimos cuántos hay que cargar.
    // Si hay texto en el buscador, empezamos en 65.
    // Si no hay texto, recuperamos el caché de ESTE concesionario en específico.
    let targetLoadCount = VEHICLE_BATCH_SIZE;
    if (term === '') {
        targetLoadCount = dealerLoadCache[currentBossDealerName] || VEHICLE_BATCH_SIZE;
    }

    // SIEMPRE vaciamos el grid para dibujar los datos frescos (por si compramos stock y cambió el número verde)
    grid.innerHTML = '';
    currentLoadedCount = 0;

    let filtered = globalStock.filter(v =>
        (v.name && v.name.toLowerCase().includes(term)) ||
        (v.brand && v.brand.toLowerCase().includes(term)) ||
        (v.model && v.model.toLowerCase().includes(term))
    );

    // --- ORDENACIÓN NATURAL Y ALFABÉTICA (A-Z, 1-10) ---
    currentFilteredStock = filtered.sort((a, b) => {
        const nameA = (a.name || a.model).toString();
        const nameB = (b.name || b.model).toString();

        // localeCompare con numeric: true es la forma más profesional de ordenar 1, 2, 10
        return nameA.localeCompare(nameB, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });

    if (currentFilteredStock.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #aaa; margin-top: 2vw; font-size: 0.9vw;">No hay vehículos.</div>`;
        return;
    }

    // Cargamos de golpe todos los lotes necesarios hasta llegar al caché que teníamos guardado
    while (currentLoadedCount < targetLoadCount && currentLoadedCount < currentFilteredStock.length) {
        loadMoreVehicles();
    }
}

// 2. Función que añade físicamente las tarjetas al DOM (Lazy Load)
function loadMoreVehicles() {
    const grid = document.getElementById('boss-vehicles-grid');
    if (!grid) return;

    const nextBatch = currentFilteredStock.slice(currentLoadedCount, currentLoadedCount + VEHICLE_BATCH_SIZE);

    nextBatch.forEach(v => {
        const card = document.createElement('div');
        card.className = 'vehicle-card';
        card.setAttribute('data-model', v.model);

        const formattedPrice = new Intl.NumberFormat('es-ES').format(v.price || 0);
        const stockNum = v.stock || 0;
        const badgeBg = stockNum > 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        const badgeColor = stockNum > 0 ? '#ffffff' : '#888888';
        const badgeBorder = stockNum > 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)';

        card.innerHTML = `
            <div class="card-header-info">
                <div class="card-brand-logo"><i class="fa-solid fa-car"></i></div>
                <div class="card-text-info">
                    <span class="card-brand-name">${v.brand || 'Desconocido'}</span>
                    <span class="card-model-name">${v.name || v.model}</span>
                </div>
                
                <div style="margin-left: auto; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 0.2vw 0.4vw; border-radius: 4px; font-size: 0.7vw; font-weight: 900; font-family: 'Orbitron', sans-serif; display: flex; align-items: center; gap: 0.3vw;">
                    ${stockNum} <i class="fa-solid fa-cubes"></i>
                </div>
            </div>
            
            <div class="card-vehicle-image" style="position: relative; display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; overflow: hidden; padding: 0.5vw; background: rgba(0,0,0,0.2);">
    
                <span style="position: absolute; top: 0.4vw; left: 0.4vw; font-size: 0.55vw; color: #666; background: rgba(0,0,0,0.5); padding: 0.2vw 0.4vw; border-radius: 3px; z-index: 2;">ID: ${v.model}</span>
                
                ${getSmartVehicleImage(v.model, v.shop)}
                
                <span style="position: absolute; bottom: 0.4vw; right: 0.4vw; color: #fff; font-weight: 900; font-size: 0.9vw; text-shadow: 0 4px 10px rgba(0,0,0,1); z-index: 2; font-family: 'Orbitron', sans-serif;">
                    $ ${formattedPrice}
                </span>
            </div>
        `;

        card.addEventListener('click', () => {
            openOrderStockModal(v);
        });

        grid.appendChild(card);
    });

    currentLoadedCount += nextBatch.length;

    const currentSearch = document.getElementById('boss-vehicles-search')?.value.trim() || '';
    if (currentSearch === '') {
        dealerLoadCache[currentBossDealerName] = currentLoadedCount;
    }
}

// 3. Evento en vivo: Filtrar vehículos al escribir en el buscador
document.getElementById('boss-vehicles-search')?.addEventListener('input', (e) => {
    renderBossVehicles(e.target.value);
});

// 4. Evento para detectar cuándo llegamos al final del scroll y cargar más
document.getElementById('boss-vehicles-grid')?.addEventListener('scroll', function () {
    // Si nos acercamos a 50px del fondo y aún quedan coches por mostrar...
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
        if (currentLoadedCount < currentFilteredStock.length) {
            loadMoreVehicles(); // Inyectamos los siguientes 65 silenciosamente
        }
    }
});


// =================================================================
// MÓDULO 10: BOSS MENU - PEDIDO DE STOCK (COMPRAS AL POR MAYOR)
// =================================================================

function openOrderStockModal(vehicle) {
    document.getElementById('order-stock-title').innerHTML = `<i class="fa-solid fa-truck-fast"></i> Pedir Stock: ${vehicle.name || vehicle.model}`;
    document.getElementById('order-stock-model').value = vehicle.model;
    document.getElementById('order-stock-retail-price').value = vehicle.price || 0;

    // Etiqueta del precio Retail original
    const formattedRetail = new Intl.NumberFormat('es-ES').format(vehicle.price || 0);
    document.getElementById('order-stock-retail').innerText = `$ ${formattedRetail}`;

    document.getElementById('order-stock-amount').value = 1;

    // Rellenar el selector con las categorías de esta empresa
    const catSelect = document.getElementById('order-stock-category');
    catSelect.innerHTML = '';
    if (!activeCategories || activeCategories.length === 0) {
        catSelect.innerHTML = `<option value="">⚠️ No hay categorías creadas</option>`;
    } else {
        activeCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.innerText = cat.label;
            catSelect.appendChild(opt);
        });
    }

    // Forzar el primer cálculo para que muestre los datos de 1 unidad
    calculateOrderTotal();
    toggleModal('order-stock-modal', true);
}

// Función matemática en vivo (Descuento Escalonado)
function calculateOrderTotal() {
    let qtyInput = document.getElementById('order-stock-amount');
    let qty = parseInt(qtyInput?.value);

    if (isNaN(qty) || qty < 1) {
        qty = 1; // Base de seguridad
    }

    const retailPrice = parseInt(document.getElementById('order-stock-retail-price').value) || 0;

    // 1. Descuento Fijo de Empresa (25%)
    const baseDiscount = 0.25;

    // 2. Sistema de Descuento Escalonado
    let bulkDiscount = 0;

    if (qty >= 1000) {
        bulkDiscount = 0.22; // +22% para pedidos enormes (1000+)
    } else if (qty >= 750) {
        bulkDiscount = 0.18; // +18% para pedidos enormes (750+)
    } else if (qty >= 500) {
        bulkDiscount = 0.15; // +15% para pedidos enormes (500+)
    } else if (qty >= 300) {
        bulkDiscount = 0.12; // +12% para pedidos enormes (300+)
    } else if (qty >= 100) {
        bulkDiscount = 0.08; // +8% para pedidos grandes (100+)
    } else if (qty >= 50) {
        bulkDiscount = 0.05; // +5% para pedidos medianos (50+)
    } else if (qty >= 10) {
        bulkDiscount = 0.02; // +2% para pedidos pequeños (10+)
    }
    // Si es menor a 10, bulkDiscount se mantiene en 0.

    // Suma de descuentos (Máximo 37% total)
    const totalDiscount = baseDiscount + bulkDiscount;

    // Costo Base con Descuento Fijo (Para mostrar que NO cambia con la cantidad)
    const baseUnitCost = Math.floor(retailPrice * (1 - baseDiscount));

    // Costo Final con el Descuento Escalonado aplicado
    const finalUnitCost = Math.floor(retailPrice * (1 - totalDiscount));
    const totalOrderCost = finalUnitCost * qty;

    // Actualización visual en milisegundos
    document.getElementById('order-stock-discount-badge').innerText = `25% Base + ${(bulkDiscount * 100).toFixed(0)}% Por Volumen`;

    // Mantenemos el costo base visualmente estable, mostrando el ahorro final en el total
    document.getElementById('order-stock-unit-cost').innerText = `$ ${new Intl.NumberFormat('es-ES').format(baseUnitCost)}`;
    document.getElementById('order-stock-total').innerText = `$ ${new Intl.NumberFormat('es-ES').format(totalOrderCost)}`;
}

// Escuchar cambios en el input numérico en tiempo real
document.getElementById('order-stock-amount')?.addEventListener('input', calculateOrderTotal);

document.getElementById('btn-confirm-order')?.addEventListener('click', () => {
    const model = document.getElementById('order-stock-model').value;
    const retailPrice = document.getElementById('order-stock-retail-price').value;
    const amount = document.getElementById('order-stock-amount').value;
    const category = document.getElementById('order-stock-category').value;

    // Validación básica de seguridad
    if (!category) {
        console.log("[Error] Debes seleccionar una categoría o crear una primero.");
        return;
    }

    // Enviamos el paquete de datos al cl_main.lua
    fetch(`https://${GetParentResourceName()}/orderStock`, {
        method: 'POST',
        body: JSON.stringify({
            model: model,
            retailPrice: parseInt(retailPrice) || 0,
            amount: parseInt(amount) || 1,
            category: category
        })
    });

    // Cerramos el modal instantáneamente tras darle al botón
    toggleModal('order-stock-modal', false);
});

// =================================================================
// MÓDULO 11: BOSS MENU - RESERVAS
// =================================================================

// 2. Lógica del Botón "Aceptar Reserva"
function acceptReservation(btnElement) {
    // Aquí mandaremos el evento a Lua
    console.log("Reserva Aceptada");
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Notificando...';
    btnElement.disabled = true;

    // Simulación: Borrar la tarjeta después de 1.5s
    setTimeout(() => {
        btnElement.closest('.reservation-card').remove();
    }, 1500);
}

// =================================================================
// GENERADOR DINÁMICO DE RESERVAS (BOSS MENU)
// =================================================================
function loadPendingReservations(reservations) {
    const container = document.getElementById('boss-reservation-list');
    if (!container) return;

    container.innerHTML = ''; // Limpiamos la lista

    // Si no hay reservas, inyectamos el HTML de estado vacío
    if (!reservations || reservations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <iconify-icon icon="solar:bell-bing-bold-duotone" class="empty-state-icon"></iconify-icon>
                <span class="empty-state-text">Sin reservas, ¡Toca esperar!</span>
            </div>
        `;
        return;
    }

    // Si hay reservas, generamos las NUEVAS tarjetas rediseñadas
    reservations.forEach(res => {
        const formattedPrice = new Intl.NumberFormat('es-ES').format(res.price || 0);

        // 1. Buscamos el coche en tu stock global
        const v = globalStock.find(car => car.model === res.vehicle_model) || { model: res.vehicle_model, shop: 'pdm' };

        const card = document.createElement('div');
        card.className = 'reservation-card';

        card.innerHTML = `
            <div class="res-card-header">
                <span class="res-customer"><i class="fa-solid fa-user"></i> ${res.customer_name}</span>
                <span class="res-date" title="Color de la reserva"><i class="fa-solid fa-palette"></i> ID: ${res.color}</span>
            </div>
            
            <div class="res-card-body">
                <div class="res-image-container" style="position: relative; display: flex; justify-content: center; align-items: center;">
                    ${getSmartVehicleImage(v.model, v.shop)}
                </div>
                
                <div class="res-vehicle-details">
                    <span class="res-vehicle-name">${res.vehicle_name}</span>
                    <span class="res-price">$ ${formattedPrice}</span>
                </div>
            </div>

            <div class="res-card-footer">
                <button class="btn-res-cancel" data-id="${res.id}"><i class="fa-solid fa-xmark"></i> Rechazar</button>
                <button class="btn-res-accept" data-id="${res.id}"><i class="fa-solid fa-check"></i> Aprobar</button>
            </div>
        `;

        container.appendChild(card);
    });

    // Eventos para los botones (Aprobar)
    document.querySelectorAll('.btn-res-accept').forEach(btn => {
        btn.addEventListener('click', function () {
            const resId = this.dataset.id;

            // Borrar al instante visualmente
            this.closest('.reservation-card').remove();
            checkEmptyReservations(container);

            fetch(`https://${GetParentResourceName()}/acceptReservation`, {
                method: 'POST',
                body: JSON.stringify({ id: resId })
            });
        });
    });

    // Eventos para los botones (Rechazar)
    document.querySelectorAll('.btn-res-cancel').forEach(btn => {
        btn.addEventListener('click', function () {
            const resId = this.dataset.id;

            // Borrar al instante visualmente
            this.closest('.reservation-card').remove();
            checkEmptyReservations(container);

            fetch(`https://${GetParentResourceName()}/cancelReservation`, {
                method: 'POST',
                body: JSON.stringify({ id: resId })
            });
        });
    });
}

// Función auxiliar para comprobar si nos quedamos sin reservas al borrar una
function checkEmptyReservations(container) {
    if (container.children.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <iconify-icon icon="solar:bell-bing-bold-duotone" class="empty-state-icon"></iconify-icon>
                <span class="empty-state-text">Sin reservas, ¡Toca esperar!</span>
            </div>
        `;
    }
}

// =================================================================
// MÓDULO 12: BOSS MENU - FINANZAS (BALANCE, TRANSACCIONES Y VENTAS)
// =================================================================

function renderTransactionsTable() {
    const tbody = document.getElementById('boss-transactions-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalPages = Math.ceil(transWorkingList.length / transItemsPerPage) || 1;
    if (transCurrentPage > totalPages) transCurrentPage = totalPages;
    if (transCurrentPage < 1) transCurrentPage = 1;

    document.getElementById('transactions-page-info').innerText = `${transCurrentPage} / ${totalPages}`;

    const paginationControls = document.getElementById('transactions-pagination-controls');
    if (paginationControls) {
        paginationControls.style.display = (totalPages <= 1) ? 'none' : 'flex';
    }

    const startIndex = (transCurrentPage - 1) * transItemsPerPage;
    const endIndex = startIndex + transItemsPerPage;
    const itemsToShow = transWorkingList.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="border:none;"><div class="empty-state"><iconify-icon icon="solar:wallet-money-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text">Sin movimientos financieros</span></div></td></tr>`;
        return;
    }

    itemsToShow.forEach(tx => {
        // Detectamos si es ingreso o gasto. (Como 'SUELDO' no está aquí, será isDeposit = false)
        const isDeposit = tx.action === 'DEPOSITO' || tx.action === 'VENTA_VEHICULO';
        const actionClass = isDeposit ? 'text-deposit' : 'text-withdraw';

        // Formateamos el texto de la acción para que sea legible en la tabla
        let displayText = tx.action;
        if (tx.action === 'VENTA_VEHICULO') {
            displayText = `VENTA: ${tx.model || 'Vehículo'}`;
        } else if (tx.action === 'SUELDO') {
            displayText = 'PAGO DE NÓMINA';
        }

        // Formateamos la cantidad para que se vea bonita con comas
        const formattedAmount = new Intl.NumberFormat('es-ES').format(tx.amount);

        tbody.innerHTML += `
            <tr>
                <td><strong>${tx.employee}</strong></td>
                <td class="${actionClass}">${displayText}</td>
                <td style="color:#aaa;">${tx.rank || '--'}</td>
                <td class="${actionClass}">$ ${formattedAmount}</td>
                <td style="font-size:0.8vw;">${tx.date}</td>
            </tr>
        `;
    });
}

// Listeners Paginación
const btnTransPrev = document.getElementById('transactions-prev');
if (btnTransPrev) {
    btnTransPrev.addEventListener('click', () => {
        if (transCurrentPage > 1) { transCurrentPage--; renderTransactionsTable(); }
    });
}

const btnTransNext = document.getElementById('transactions-next');
if (btnTransNext) {
    btnTransNext.addEventListener('click', () => {
        const totalPages = Math.ceil(transWorkingList.length / transItemsPerPage);
        if (transCurrentPage < totalPages) { transCurrentPage++; renderTransactionsTable(); }
    });
}

// Buscador (Filtra por nombre, acción o rango)
const searchTrans = document.getElementById('boss-transactions-search');
if (searchTrans) {
    searchTrans.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        transWorkingList = originalTransList.filter(t =>
            t.employee.toLowerCase().includes(term) ||
            t.action.toLowerCase().includes(term) ||
            t.rank.toLowerCase().includes(term)
        );
        transCurrentPage = 1;
        renderTransactionsTable();
    });
}

// Lógica de Modales (Mandar a Lua)
document.getElementById('confirm-deposit-btn')?.addEventListener('click', () => {
    const amount = document.getElementById('deposit-amount').value;
    if (!amount || amount <= 0) return;

    fetch(`https://${GetParentResourceName()}/bossAction`, {
        method: 'POST',
        body: JSON.stringify({ action: 'deposit', amount: amount })
    });

    toggleModal('deposit-modal', false);
    document.getElementById('deposit-amount').value = '';
});

document.getElementById('confirm-withdraw-btn')?.addEventListener('click', () => {
    const amount = document.getElementById('withdraw-amount').value;
    if (!amount || amount <= 0) return;

    fetch(`https://${GetParentResourceName()}/bossAction`, {
        method: 'POST',
        body: JSON.stringify({ action: 'withdraw', amount: amount })
    });

    toggleModal('withdraw-modal', false);
    document.getElementById('withdraw-amount').value = '';
});

// 3. Tabla de Ventas (Datos Reales de la Base de Datos)

// Renderizar Tabla
function renderSalesTable() {
    const tbody = document.getElementById('boss-sales-tbody');
    tbody.innerHTML = '';

    // Paginación Math
    const totalPages = Math.ceil(salesWorkingList.length / salesItemsPerPage) || 1;
    if (salesCurrentPage > totalPages) salesCurrentPage = totalPages;
    if (salesCurrentPage < 1) salesCurrentPage = 1;

    document.getElementById('sales-page-info').innerText = `${salesCurrentPage} / ${totalPages}`;

    // Ocultar paginación si solo hay 1 página
    const paginationControls = document.querySelector('.sales-pagination');
    if (paginationControls) {
        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
        } else {
            paginationControls.style.display = 'flex';
        }
    }

    const startIndex = (salesCurrentPage - 1) * salesItemsPerPage;
    const endIndex = startIndex + salesItemsPerPage;
    const itemsToShow = salesWorkingList.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888;">No hay ventas registradas</td></tr>`;
        return;
    }

    itemsToShow.forEach(sale => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${sale.buyer}</strong></td>
                <td>${sale.modelLabel}</td>
                <td style="color:#aaa;">${sale.modelId}</td>
                <td style="color:#fff; font-weight:bold;">$ ${sale.price}</td>
                <td style="font-size:0.8vw; color:#aaa;">${sale.date}</td>
            </tr>
        `;
    });
}

// Botones Paginación
document.getElementById('sales-prev').addEventListener('click', () => {
    if (salesCurrentPage > 1) { salesCurrentPage--; renderSalesTable(); }
});

document.getElementById('sales-next').addEventListener('click', () => {
    const totalPages = Math.ceil(salesWorkingList.length / salesItemsPerPage);
    if (salesCurrentPage < totalPages) { salesCurrentPage++; renderSalesTable(); }
});

// Buscador (Filtra por nombre comprador o coche)
const salesSearchInput = document.getElementById('boss-sales-search');
if (salesSearchInput) {
    salesSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        salesWorkingList = originalSalesList.filter(s =>
            (s.buyer && s.buyer.toLowerCase().includes(term)) ||
            (s.modelLabel && s.modelLabel.toLowerCase().includes(term))
        );
        salesCurrentPage = 1; // Volver a la pag 1 al buscar
        renderSalesTable();
    });
}

// =================================================================
// MÓDULO: TABLA DE CONCESIONARIOS (ADMINISTRADOR) Y MAPA INTERACTIVO
// =================================================================

function renderAdminDealersTable() {
    const tbody = document.getElementById('admin-dealers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // === RECOLECCIÓN DE ELEMENTOS DE LA INTERFAZ ===
    const markersContainer = document.getElementById('admin-map-markers');
    const tooltip = document.getElementById('admin-map-tooltip');
    const mapScrollContent = document.getElementById('admin-map-scroll-content');
    const mapContainer = document.getElementById('admin-map-container');

    if (markersContainer) {
        markersContainer.innerHTML = ''; // Limpieza total de puntos previos
    }

    // Paginación y estadísticas
    const totalPages = Math.ceil(adminDealersWorkingList.length / adminDealersItemsPerPage) || 1;
    if (adminDealersCurrentPage > totalPages) adminDealersCurrentPage = totalPages;
    if (adminDealersCurrentPage < 1) adminDealersCurrentPage = 1;

    document.getElementById('admin-dealers-page-info').innerText = `${adminDealersCurrentPage} / ${totalPages}`;
    const statTotal = document.getElementById('admin-stat-total');
    if (statTotal) statTotal.innerText = originalAdminDealersList.length;

    const paginationControls = document.querySelector('#admin-config-content .sales-pagination');
    if (paginationControls) {
        paginationControls.style.display = totalPages <= 1 ? 'none' : 'flex';
    }

    const startIndex = (adminDealersCurrentPage - 1) * adminDealersItemsPerPage;
    const endIndex = startIndex + adminDealersItemsPerPage;
    const itemsToShow = adminDealersWorkingList.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="border:none;"><div class="empty-state"><iconify-icon icon="solar:buildings-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text"> Aún no hay concesionarios registrados </span></div></td></tr>`;
        return;
    }

    // APLICAR ESCALA ACTUAL AL CONTENEDOR CONJUNTO
    if (mapScrollContent) {
        mapScrollContent.style.width = `${currentMapZoomPercent}%`;
    }

    // Renderizado de filas y generación de blips en el mapa
    itemsToShow.forEach(dealer => {
        // Icono del blip, colores y estado
        const cfg = dealer.config || {};
        const blipId = cfg.blip ?? 225; // 225 = Coche por defecto

        // Verificamos si está desactivado
        const isDisabled = cfg.disabled === true;

        // Empezamos asumiendo un icono base que sabemos que existe en FiveM Docs
        let blipSlug = 'crim_carsteal2';

        if (typeof commonGtaBlips !== 'undefined') {
            const foundBlip = commonGtaBlips.find(b => String(b.id) === String(blipId));
            if (foundBlip && foundBlip.slug) {
                blipSlug = foundBlip.slug;
            }
        }

        const blipImg = `https://docs.fivem.net/blips/radar_${blipSlug}.png`;

        // Renderizado de la fila (Con estilos dinámicos si está desactivado)
        tbody.innerHTML += `
            <tr id="admin-row-${dealer.id}" style="${isDisabled ? 'opacity: 0.5; background: rgba(255, 0, 0, 0.05);' : ''}">
                <td class="dealer-blip-cell">
                    <div class="dealer-blip-circle" style="display:flex; justify-content:center; align-items:center; width: 1.5vw; height: 1.5vw; background: rgba(255,255,255,0.05); border-radius: 50%;">
                        <img src="${blipImg}" style="width:1.25vw; height:1.25vw; object-fit:contain; image-rendering:pixelated; ${isDisabled ? 'filter: grayscale(1);' : ''}" onerror="this.outerHTML='<i class=\\'fa-solid fa-location-dot\\' style=\\'color:#aaa; font-size: 0.9vw;\\'></i>'">
                    </div>
                </td>
                <td class="dealer-name-cell">
                    <strong>${dealer.name}</strong> 
                    ${isDisabled ? '<span style="color: #ff4747;font-size: 0.4vw;display: flex;align-items: center;font-weight: 900;">[DESACTIVADO]</span>' : ''}
                </td>
                <td class="dealer-id-cell"><span class="dealer-id-badge">${dealer.id}</span></td>
                <td class="dealer-actions-cell">
                    <div style="display:flex; gap:4px; align-items:center;">
                        <button class="btn-icon" onclick="editAdminDealer('${dealer.id}')" title="Editar Nombre/Tipo">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-config-dealer" id="btn-cfg-${dealer.id}" onclick="configureAdminDealer('${dealer.id}')" title="Configurar Spawns/Zonas">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                        <button class="btn-icon" onclick="markGPSAdminDealer('${dealer.id}')" title="Marcar en el GPS">
                            <i class="fa-solid fa-location-dot"></i>
                        </button>
                        <button class="btn-icon" onclick="toggleAdminDealer('${dealer.id}')" title="${isDisabled ? 'Activar Concesionario' : 'Desactivar Concesionario'}">
                            <i class="fa-solid fa-power-off"};"></i>
                        </button>
                        <button class="btn-icon" onclick="exportAdminDealer('${dealer.id}')" title="Exportar JSON">
                            <i class="fa-solid fa-file-export"></i>
                        </button>
                        <button class="btn-icon delete-vehicle" onclick="deleteAdminDealer('${dealer.id}')" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;

        // === CALIBRACIÓN ULTRA PRECISA DE LOS BLIPS EN EL MAPA ===
        // Solo pintamos el blip en el mapa interactivo si NO está desactivado
        if (markersContainer && cfg.coords && !isDisabled) {

            // 1. Bordes del mapa de GTA V
            const MAP_LEFT_X = -4700.0;   // EMPUJA A LA IZQUIERDA EL ANCHO DEL MAPA
            const MAP_RIGHT_X = 6000.0;   // EMPUJA A LA DERECHA EL ANCHO DEL MAPA
            const MAP_TOP_Y = 8500.0;     // EMPUJA HACIA ARRIBA EL ALTO DEL MAPA
            const MAP_BOTTOM_Y = -4800.0; // EMPUJA HACIA ABAJO EL ALTO DEL MAPA

            // 2. Cálculo automático del tamaño total del mapa
            const MAP_WIDTH = MAP_RIGHT_X - MAP_LEFT_X;
            const MAP_HEIGHT = MAP_TOP_Y - MAP_BOTTOM_Y;

            // 3. Conversión de Coordenadas (X, Y) a Porcentajes (%) para el HTML
            let mapXPercent = ((cfg.coords.x - MAP_LEFT_X) / MAP_WIDTH) * 100;
            let mapYPercent = ((MAP_TOP_Y - cfg.coords.y) / MAP_HEIGHT) * 100;

            const marker = document.createElement('div');
            marker.className = 'admin-map-marker';
            marker.dataset.id = dealer.id;
            marker.style.left = `${mapXPercent}%`;
            marker.style.top = `${mapYPercent}%`;

            marker.addEventListener('mousemove', (e) => {
                if (tooltip) {
                    tooltip.innerText = dealer.name;
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${e.clientX}px`;
                    tooltip.style.top = `${e.clientY - 15}px`;
                }
            });

            marker.addEventListener('mouseleave', () => {
                if (tooltip) tooltip.style.display = 'none';
            });

            marker.addEventListener('click', () => {
                document.querySelectorAll('.admin-map-marker').forEach(m => m.classList.remove('active'));
                marker.classList.add('active');

                const row = document.getElementById(`admin-row-${dealer.id}`);
                if (row) {
                    row.style.backgroundColor = 'rgba(0, 250, 154, 0.2)';
                    setTimeout(() => { row.style.backgroundColor = 'transparent'; }, 1000);
                }

                const configBtn = document.getElementById(`btn-cfg-${dealer.id}`);
                if (configBtn) configBtn.click();
            });

            markersContainer.appendChild(marker);
        }
    });

    // VISTA POR DEFECTO AUTOMÁTICA EN LOS SANTOS (ABAJO A LA IZQUIERDA)
    setTimeout(() => {
        if (mapContainer) {
            mapContainer.scrollLeft = 150;
            mapContainer.scrollTop = mapContainer.scrollHeight;
        }
    }, 60);
}

// =================================================================
// FUNCIONES DE ACCIÓN DE LA TABLA DE ADMINISTRADOR
// =================================================================

window.editAdminDealer = function (id) {
    const dealer = originalAdminDealersList.find(d => d.id === id);
    if (!dealer) return;

    // Rellenar campos básicos
    document.getElementById('edit-dealer-id').value = id;
    document.getElementById('edit-dealer-name').value = dealer.name || '';
    document.getElementById('edit-dealer-subtitle').innerText = `Editando: ${dealer.name} (ID: ${id})`;

    // Config data (blip, color, coords, scale)
    const cfg = dealer.config || {
        coords: dealer.coords,
        blip: dealer.blip,
        color: dealer.color,
        scale: dealer.scale
    };
    selectedEditBlip = cfg.blip ?? 225;
    selectedEditColor = cfg.color ?? 0;

    document.getElementById('edit-dealer-x').value = cfg.coords?.x ?? '';
    document.getElementById('edit-dealer-y').value = cfg.coords?.y ?? '';
    document.getElementById('edit-dealer-z').value = cfg.coords?.z ?? '';
    document.getElementById('edit-dealer-scale').value = cfg.scale ?? 0.55;
    document.getElementById('edit-dealer-job').value = cfg.job ?? '';

    // Renderizar blips y colores con valores actuales
    renderEditBlips(true);
    renderEditColors();

    // Mostrar modal
    document.getElementById('edit-dealer-modal').style.display = 'flex';
};

window.markGPSAdminDealer = function (id) {
    // Mandar fetch al cliente (cl_main.lua) para que ponga el waypoint en el mapa
    fetch(`https://${GetParentResourceName()}/adminMarkGPS`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    });
};

window.toggleAdminDealer = function (id) {
    // Enviar fetch al servidor para cambiar el estado de abierto/cerrado
    fetch(`https://${GetParentResourceName()}/adminToggleDealer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    });
};

window.deleteAdminDealer = function (id) {
    // Mandamos el ID al cl_main.lua para que procese el borrado en la BD
    fetch(`https://${GetParentResourceName()}/deleteAdminDealer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    });

    // UX Limpísima: Lo borramos de la interfaz al instante sin esperar a recargar
    adminDealersWorkingList = adminDealersWorkingList.filter(d => d.id !== id);
    originalAdminDealersList = originalAdminDealersList.filter(d => d.id !== id);
    renderAdminDealersTable();
};

// =================================================================
// MÓDULO: GRÁFICA DE RENDIMIENTO DE EMPRESA (CHART.JS)
// =================================================================
function updateCompanyChart(weeklyData) {
    const ctx = document.getElementById('company-balance-chart');
    if (!ctx) return;

    const sanitizedData = weeklyData.map(val => Math.round(val));

    // Calcular los últimos 7 días dinámicamente
    const shortDays = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const longDays = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

    let dynamicLabels = [];
    let fullNamesMap = {};
    let todayDate = new Date();

    // Generamos las letras y nombres desde hace 6 días hasta HOY
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(todayDate.getDate() - i);
        let dayIndex = d.getDay();

        dynamicLabels.push(shortDays[dayIndex]);
        fullNamesMap[shortDays[dayIndex]] = longDays[dayIndex];
    }

    if (companyBalanceChart) {
        companyBalanceChart.data.labels = dynamicLabels; // Actualizamos las letras
        companyBalanceChart.data.datasets[0].data = sanitizedData;

        // Actualizamos también el mapa de nombres en las opciones por si cambia de día jugando
        companyBalanceChart.options.plugins.tooltip.callbacks.title = function (context) {
            let shortName = context[0].label;
            return fullNamesMap[shortName] || shortName;
        };

        companyBalanceChart.update();
    } else {
        companyBalanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dynamicLabels, // Etiquetas dinámicas (Ej: J, V, S, D, L, M, X)
                datasets: [{
                    label: 'Balance ($)',
                    data: sanitizedData,
                    borderColor: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#000000',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { family: 'Orbitron', size: 10 },
                            callback: function (value) {
                                if (Number.isInteger(value)) {
                                    return value;
                                }
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { family: 'Orbitron', size: 12, weight: 'bold' }
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { family: 'Orbitron', size: 13 },
                        bodyFont: { family: 'Orbitron', size: 14, weight: 'bold' },
                        callbacks: {
                            // Título dinámico usando el mapa que generamos arriba
                            title: function (context) {
                                let shortName = context[0].label;
                                return fullNamesMap[shortName] || shortName;
                            },
                            label: function (context) {
                                return '$ ' + new Intl.NumberFormat('es-ES').format(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    }
}

// Filtra las transacciones y calcula el neto de los ÚLTIMOS 7 DÍAS
function calculateWeeklyChartData(transactions) {
    let weeklyTotals = [0, 0, 0, 0, 0, 0, 0]; // [Hace 6 días, ..., Ayer, Hoy]
    if (!transactions || transactions.length === 0) return weeklyTotals;

    // Calculamos la medianoche de hoy para poder comparar días exactos
    let todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // Calculamos la fecha límite (hace 6 días)
    let sixDaysAgo = new Date(todayMidnight);
    sixDaysAgo.setDate(todayMidnight.getDate() - 6);

    transactions.forEach((t) => {
        let rawDate = t.date || t.created_at || t.timestamp || t.fecha;
        let action = (t.action_type || t.type || t.action || "").toUpperCase();

        let amountStr = t.amount || t.price || t.value || t.cantidad;
        if (!amountStr && t.details) {
            try {
                let det = typeof t.details === 'string' ? JSON.parse(t.details) : t.details;
                amountStr = det.amount || det.price || det.value || 0;
            } catch (e) { }
        }
        let amount = parseFloat(amountStr) || 0;

        if (!rawDate) return;

        let tDate;
        if (typeof rawDate === 'string' && rawDate.includes('|')) {
            let parts = rawDate.split('|');
            let dateParts = parts[0].trim().split('-');
            let timeParts = parts[1].trim().split(':');
            tDate = new Date(dateParts[2], parseInt(dateParts[1]) - 1, dateParts[0], timeParts[0], timeParts[1]);
        } else if (typeof rawDate === 'string' && rawDate.includes('-') && !rawDate.includes('T')) {
            tDate = new Date(rawDate.replace(/-/g, "/"));
        } else {
            tDate = new Date(rawDate);
        }

        if (isNaN(tDate.getTime())) return;

        // Comprobamos la distancia en días desde HOY
        let tDateMidnight = new Date(tDate);
        tDateMidnight.setHours(0, 0, 0, 0);

        if (tDateMidnight >= sixDaysAgo && tDateMidnight <= todayMidnight) {
            // Calculamos cuántos días han pasado desde esa transacción hasta hoy
            let diffTime = todayMidnight - tDateMidnight;
            let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            // diffDays será 0 si fue hoy, 1 si fue ayer...
            // Hoy es el índice 6 (el de más a la derecha en la gráfica)
            let index = 6 - diffDays;

            if (index >= 0 && index <= 6) {
                if (action.includes('DEP') || action.includes('INGR') || action.includes('VENTA')) {
                    weeklyTotals[index] += amount;
                }
                else if (action.includes('RET') || action.includes('WITH')) {
                    weeklyTotals[index] -= amount;
                }
            }
        }
    });

    return weeklyTotals;
}

// =================================================================
// MÓDULO 13: BOSS MENU - TABLAS SECUNDARIAS (PERSONAL Y DESCUENTOS)
// =================================================================

// --- 1. SANCIONADOS ---
function renderSancTable() {
    const tbody = document.getElementById('sanc-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalPages = Math.ceil(sancWorkingList.length / sancItemsPerPage) || 1;
    if (sancCurrentPage > totalPages) sancCurrentPage = totalPages;
    if (sancCurrentPage < 1) sancCurrentPage = 1;

    document.getElementById('sanc-page').innerText = `${sancCurrentPage} / ${totalPages}`;

    const startIndex = (sancCurrentPage - 1) * sancItemsPerPage;
    const endIndex = startIndex + sancItemsPerPage;
    const itemsToShow = sancWorkingList.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) return tbody.innerHTML = `<tr><td colspan="3" style="border:none;"><div class="empty-state"><iconify-icon icon="solar:shield-warning-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text">Ningún empleado sancionado</span></div></td></tr>`;

    itemsToShow.forEach(s => {
        tbody.innerHTML += `<tr><td><strong>${s.name}</strong></td><td style="color:#fff; font-weight:bold;">${s.sanctions}</td><td style="font-size:0.7vw; color:#aaa;">${s.date}</td></tr>`;
    });
}

document.getElementById('sanc-prev')?.addEventListener('click', () => { if (sancCurrentPage > 1) { sancCurrentPage--; renderSancTable(); } });
document.getElementById('sanc-next')?.addEventListener('click', () => { if (sancCurrentPage < Math.ceil(sancWorkingList.length / sancItemsPerPage)) { sancCurrentPage++; renderSancTable(); } });
document.getElementById('sanc-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    sancWorkingList = dummySanc.filter(s => s.name.toLowerCase().includes(term));
    sancCurrentPage = 1; renderSancTable();
});


// --- 2. EMPLEADOS ---
function renderEmpTable() {
    const tbody = document.getElementById('emp-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalPages = Math.ceil(empWorkingList.length / empItemsPerPage) || 1;
    if (empCurrentPage > totalPages) empCurrentPage = totalPages;
    if (empCurrentPage < 1) empCurrentPage = 1;

    document.getElementById('emp-page').innerText = `${empCurrentPage} / ${totalPages}`;

    const startIndex = (empCurrentPage - 1) * empItemsPerPage;
    const endIndex = startIndex + empItemsPerPage;
    const itemsToShow = empWorkingList.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) return tbody.innerHTML = `<tr><td colspan="4" style="border:none;"><div class="empty-state"><iconify-icon icon="solar:users-group-two-rounded-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text">No hay empleados contratados</span></div></td></tr>`;

    itemsToShow.forEach(e => {
        tbody.innerHTML += `<tr>
            <td><strong>${e.name}</strong></td>
            <td style="color:#aaa;">${e.rank}</td>
            <td style="color:#fff;">$ ${e.salary}</td>
            <td class="centro"><button class="btn-icon" style="color:#aaa;"><i class="fa-solid fa-pen"></i></button></td>
        </tr>`;
    });
}

document.getElementById('emp-prev')?.addEventListener('click', () => { if (empCurrentPage > 1) { empCurrentPage--; renderEmpTable(); } });
document.getElementById('emp-next')?.addEventListener('click', () => { if (empCurrentPage < Math.ceil(empWorkingList.length / empItemsPerPage)) { empCurrentPage++; renderEmpTable(); } });
document.getElementById('emp-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    empWorkingList = dummyEmp.filter(emp => emp.name.toLowerCase().includes(emp) || emp.rank.toLowerCase().includes(term));
    empCurrentPage = 1; renderEmpTable();
});


// --- 3. DESCUENTOS ---
function renderDiscTable() {
    const tbody = document.getElementById('disc-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalPages = Math.ceil(discWorkingList.length / discItemsPerPage) || 1;
    if (discCurrentPage > totalPages) discCurrentPage = totalPages;
    if (discCurrentPage < 1) discCurrentPage = 1;

    document.getElementById('disc-page').innerText = `${discCurrentPage} / ${totalPages}`;

    const startIndex = (discCurrentPage - 1) * discItemsPerPage;
    const endIndex = startIndex + discItemsPerPage;
    const itemsToShow = discWorkingList.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) return tbody.innerHTML = `<tr><td colspan="7" style="border:none;"><div class="empty-state"><iconify-icon icon="solar:ticket-sale-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text">No hay descuentos activos</span></div></td></tr>`;

    itemsToShow.forEach(d => {
        // Formatear los vehículos permitidos
        let vehText = "Múltiples";
        try {
            let parsed = JSON.parse(d.vehicles_allowed);
            if (parsed === "ALL" || (Array.isArray(parsed) && parsed.includes("ALL"))) {
                vehText = "TODOS";
            } else if (Array.isArray(parsed)) {
                vehText = `${parsed.length} Seleccionado(s)`;
            }
        } catch (e) { vehText = d.vehicles_allowed; }

        // Formatear Usos
        let usesText = d.is_unlimited_uses ? 'ILIMITADO' : `${d.uses_left} (${d.limit_type === 'GLOBAL' ? 'Total' : 'x Pers.'})`;

        // Formatear Fechas (Manejamos compatibilidad por si el SQL escupe una T o espacios)
        let dateText = "ILIMITADO";
        if (!d.is_unlimited_time && d.expiration_date) {
            let rawDate = typeof d.expiration_date === 'string' ? d.expiration_date.replace(/-/g, "/").replace("T", " ") : d.expiration_date;
            dateText = new Date(rawDate).toLocaleDateString('es-ES');
        }

        tbody.innerHTML += `<tr>
            <td><span class="discount-code-pill" data-code="${d.code}">${d.code}</span></td>
            <td style="color:#aaa;">${d.created_by}</td>
            <td><span class="disc-veh-pill" data-vehicles="${encodeURIComponent(d.vehicles_allowed)}" data-code="${d.code}">${vehText}</span></td>
            <td style="color:#fff; font-weight:bold;">${d.discount_percentage}%</td>
            <td style="color:#aaa;">${usesText}</td>
            <td><span class="expires-text">${dateText}</span></td>
            <td class="centro"><button class="btn-icon" onclick="deleteDiscountCode(${d.id}, '${d.code}')" style="color:#aaa;"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`;
    });
}

// Listener delegado para el pill de vehículos (evita JSON en onclick inline)
document.getElementById('disc-tbody')?.addEventListener('click', function (e) {
    const pill = e.target.closest('.disc-veh-pill');
    if (!pill) return;
    const vehiclesJson = decodeURIComponent(pill.getAttribute('data-vehicles'));
    const code = pill.getAttribute('data-code');
    openDiscVehiclesModal(vehiclesJson, code);
});

// Función global para el botón de borrar
window.deleteDiscountCode = function (id, code) {
    // Si quieres meterle un modal de confirmación en el futuro lo metes aquí. Por ahora dispara a matar.
    fetch(`https://${GetParentResourceName()}/deleteDiscountCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, code: code })
    });
}

// --- VARIABLES GLOBALES PARA EL LAZY LOAD DEL MODAL ---
let currentModalVehicles = [];
let modalVehLoadedCount = 0;
const MODAL_VEH_BATCH_SIZE = 100;

// Modal de detalle de vehículos de un descuento
window.openDiscVehiclesModal = function (vehiclesJson, code) {
    let parsed;
    try { parsed = JSON.parse(vehiclesJson); } catch (e) { parsed = vehiclesJson; }

    const listEl = document.getElementById('disc-veh-modal-list');
    const subEl = document.getElementById('disc-veh-modal-subtitle');
    listEl.innerHTML = '';

    // Construir lista expandida de vehículos reales
    let vehicles = [];

    if (parsed === 'ALL' || (Array.isArray(parsed) && parsed.includes('ALL'))) {
        // TODOS: mostrar cada vehículo del stock
        vehicles = globalStock.map(v => ({ name: v.name || v.model, type: 'veh' }));
        subEl.innerText = `Código ${code} · Aplica a TODO EL STOCK (${vehicles.length} vehículos)`;
    } else if (Array.isArray(parsed)) {
        parsed.forEach(entry => {
            if (entry.startsWith('CAT_')) {
                // Expandir categoría: todos los vehículos de esa cat
                const catName = entry.replace('CAT_', '');
                const catObj = activeCategories.find(c => c.name === catName);
                const vehs = globalStock.filter(v => v.category === catName);
                vehs.forEach(v => vehicles.push({ name: v.name || v.model, type: 'cat', catLabel: catObj ? catObj.label : catName }));
            } else if (entry.startsWith('VEH_')) {
                const model = entry.replace('VEH_', '');
                const vehObj = globalStock.find(v => v.model === model);
                vehicles.push({ name: vehObj ? (vehObj.name || model) : model, type: 'veh' });
            }
        });
        subEl.innerText = `Código ${code} · ${vehicles.length} vehículo(s) en total`;
    }

    if (vehicles.length === 0) {
        listEl.innerHTML = '<span style="color:rgba(255,255,255,0.3); font-size:0.7vw; font-style:italic;">Sin vehículos registrados.</span>';
    } else {
        // --- INICIO DE LAZY LOAD ---
        currentModalVehicles = vehicles;
        modalVehLoadedCount = 0;
        window.loadMoreModalVehicles(); // Cargamos los primeros 100
    }

    toggleModal('disc-vehicles-modal', true);
};

// Función que inyecta los vehículos de 100 en 100
window.loadMoreModalVehicles = function () {
    const listEl = document.getElementById('disc-veh-modal-list');
    if (!listEl) return;

    const nextBatch = currentModalVehicles.slice(modalVehLoadedCount, modalVehLoadedCount + MODAL_VEH_BATCH_SIZE);
    let htmlBatch = ''; // Agrupamos todo en un string para inyectarlo 1 sola vez (más rendimiento)

    nextBatch.forEach(v => {
        const isCat = v.type === 'cat';
        htmlBatch += `
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 0.35vw;
                padding: 0.25vw 0.5vw;
                border-radius: 4px;
                background: ${isCat ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.05)'};
                border: 1px solid ${isCat ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)'};
            ">
                ${isCat ? `<span style="font-family:'Orbitron',sans-serif; font-size:0.42vw; font-weight:900; color:rgba(0,0,0,0.4); background:rgba(0,0,0,0.1); border:1px solid rgba(0,0,0,0.08); border-radius:2px; padding:0.1vw 0.3vw;">CAT</span>`
                : `<span style="font-family:'Orbitron',sans-serif; font-size:0.42vw; font-weight:900; color:rgba(255,255,255,0.3); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:2px; padding:0.1vw 0.3vw;">VEH</span>`}
                <span style="font-family:'Orbitron',sans-serif; font-size:0.62vw; font-weight:700; color:${isCat ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.8)'};">${v.name}</span>
                ${isCat && v.catLabel ? `<span style="font-size:0.52vw; color:rgba(0,0,0,0.4); font-style:italic;">${v.catLabel}</span>` : ''}
            </div>`;
    });

    listEl.insertAdjacentHTML('beforeend', htmlBatch); // Inyección ultra rápida
    modalVehLoadedCount += nextBatch.length;
};

// Añadimos el listener directamente al contenedor (este código se ejecuta solo 1 vez)
const modalVehiclesListEl = document.getElementById('disc-veh-modal-list');
if (modalVehiclesListEl) {
    modalVehiclesListEl.addEventListener('scroll', function () {
        // Si estamos a 50px del final y aún quedan coches por pintar
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
            if (modalVehLoadedCount < currentModalVehicles.length) {
                window.loadMoreModalVehicles();
            }
        }
    });
}

document.getElementById('disc-prev')?.addEventListener('click', () => { if (discCurrentPage > 1) { discCurrentPage--; renderDiscTable(); } });
document.getElementById('disc-next')?.addEventListener('click', () => { if (discCurrentPage < Math.ceil(discWorkingList.length / discItemsPerPage)) { discCurrentPage++; renderDiscTable(); } });
document.getElementById('disc-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    // Filtramos la lista real original
    discWorkingList = originalDiscList.filter(d =>
        d.code.toLowerCase().includes(term) ||
        d.created_by.toLowerCase().includes(term)
    );
    discCurrentPage = 1;
    renderDiscTable();
});

// =================================================================
// LÓGICA DE SEGURIDAD (CÓDIGOS DE DESCUENTO)
// =================================================================
document.addEventListener('click', (e) => {
    const pill = e.target.closest('.discount-code-pill');
    if (!pill) {
        document.querySelectorAll('.discount-code-pill.revealed').forEach(p => p.classList.remove('revealed'));
        return;
    }
    if (pill.classList.contains('revealed')) {
        pill.classList.remove('revealed');
    } else {
        document.querySelectorAll('.discount-code-pill.revealed').forEach(p => p.classList.remove('revealed'));
        pill.classList.add('revealed');
    }
});

document.addEventListener('dblclick', (e) => {
    const pill = e.target.closest('.discount-code-pill');
    if (pill) {
        const code = pill.getAttribute('data-code');
        const tempInput = document.createElement('input');
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);

        pill.classList.add('copied');
        pill.innerText = "¡COPIADO!";
        setTimeout(() => {
            pill.classList.remove('copied');
            pill.innerText = code;
            window.getSelection().removeAllRanges();
        }, 1000);
    }
});


// =================================================================
// MÓDULO 14: BOSS MENU - CATEGORÍAS Y FILTROS DEL SHOWROOM
// =================================================================

function renderBossCatsTable() {
    const container = document.getElementById('cats-list-container');
    if (!container) return;

    container.innerHTML = '';

    // Asegurarnos de que se pintan en orden
    activeCategories.sort((a, b) => a.order - b.order);

    if (activeCategories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <iconify-icon icon="solar:tag-list-bold-duotone" class="empty-state-icon"></iconify-icon>
                <span class="empty-state-text">No hay categorías creadas</span>
            </div>`;
        return;
    }

    activeCategories.forEach((cat, index) => {
        const item = document.createElement('div');
        item.className = 'cat-list-item';
        item.id = `cat-item-${cat.id}`;

        item.innerHTML = `
            <div class="cat-col-order">
                <div class="cat-order-controls">
                    <button class="order-btn" title="Subir" onclick="moveCategoryUp(${index})" ${index === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button class="order-btn" title="Bajar" onclick="moveCategoryDown(${index})" ${index === activeCategories.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
                <div class="cat-order-badge">${index + 1}</div>
            </div>
            <div class="cat-col-name">
                <div class="cat-name-box">
                    <span class="cat-name-label">${cat.label}</span>
                    <span class="cat-name-id">ID: ${cat.name}</span>
                </div>
            </div>
            <div class="cat-col-actions">
                <button class="btn-icon" title="Ver vehículos" onclick="viewCategory(${cat.id})">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn-icon" title="Editar" onclick="editDummyCat(${cat.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-icon" title="Eliminar" onclick="deleteCategory(${cat.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        container.appendChild(item);
    });
}

// --- FUNCIONES PARA MOVER EL ORDEN ---
function moveCategoryUp(index) {
    if (index <= 0) return; // Si ya es el primero, no hace nada

    // Intercambiamos posiciones en el array
    const temp = activeCategories[index];
    activeCategories[index] = activeCategories[index - 1];
    activeCategories[index - 1] = temp;

    saveAndRenderNewCategoryOrder();
}

function moveCategoryDown(index) {
    if (index >= activeCategories.length - 1) return; // Si ya es el último, no hace nada

    // Intercambiamos posiciones en el array
    const temp = activeCategories[index];
    activeCategories[index] = activeCategories[index + 1];
    activeCategories[index + 1] = temp;

    saveAndRenderNewCategoryOrder();
}

function saveAndRenderNewCategoryOrder() {
    const newOrderData = [];

    // Reasignamos los números
    activeCategories.forEach((cat, idx) => {
        cat.order = idx + 1;
        newOrderData.push({ id: cat.id, order: cat.order });
    });

    // Refrescamos vistas
    renderBossCatsTable();
    renderShowroomFilters();

    // Hacemos el envío
    fetch(`https://${GetParentResourceName()}/updateCategoryOrder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ orderData: newOrderData })
    });
}

function renderShowroomFilters() {
    const filterContainer = document.querySelector('.toolbar-filters');
    if (!filterContainer) return;

    filterContainer.innerHTML = '';

    // Ordenamos las categorías por su orden definido
    const sortedCats = activeCategories.sort((a, b) => a.order - b.order);

    // LÓGICA: Solo mostrar "TODOS" si hay más de 1 categoría
    if (sortedCats.length > 1) {
        filterContainer.innerHTML += `<span class="filter-text active" data-cat="all">TODOS</span>`;
    }

    // Dibujamos el resto de categorías
    sortedCats.forEach(cat => {
        // Si solo hay 1 categoría, la marcamos como 'active' por defecto al no haber "TODOS"
        const activeClass = (sortedCats.length <= 1) ? 'active' : '';
        filterContainer.innerHTML += `<span class="filter-text ${activeClass}" data-cat="${cat.name}">• ${cat.label.toUpperCase()}</span>`;
    });

    // Eventos de clic para filtrar
    document.querySelectorAll('.filter-text').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-text').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Aquí llamarías a tu función de filtrado real
            const catName = e.target.getAttribute('data-cat');
            applyShowroomFilter(catName);
        });
    });
}

// Abrir Modal para NUEVA Categoría
function openNewCategoryModal() {
    document.getElementById('cat-modal-title').innerHTML = '<i class="fa-solid fa-folder-plus"></i> Nueva Categoría';
    document.getElementById('cat-modal-desc').innerText = 'Crea una nueva categoría para organizar los vehículos.';
    document.getElementById('cat-id-input').value = '';
    document.getElementById('cat-old-name-input').value = ''; // Limpiamos

    const nameInput = document.getElementById('cat-name-input');
    nameInput.value = '';
    nameInput.disabled = false; // Activado
    nameInput.style.opacity = '1';

    document.getElementById('cat-label-input').value = '';
    toggleModal('category-modal', true);
}

// Abrir Modal para EDITAR Categoría
function editDummyCat(id) {
    const cat = activeCategories.find(c => c.id === id);
    if (cat) {
        document.getElementById('cat-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Categoría';
        document.getElementById('cat-modal-desc').innerText = 'Modifica el nombre o ID. Si cambias el ID, todos los coches dentro se actualizarán solos.';
        document.getElementById('cat-id-input').value = cat.id;
        document.getElementById('cat-old-name-input').value = cat.name; // Guardamos el viejo para el SQL

        const nameInput = document.getElementById('cat-name-input');
        nameInput.value = cat.name;
        nameInput.disabled = false; // ¡Ahora sí dejamos editarlo!
        nameInput.style.opacity = '1';

        document.getElementById('cat-label-input').value = cat.label;
        toggleModal('category-modal', true);
    }
}

// Botón de Cancelar Edición
document.getElementById('btn-cancel-cat')?.addEventListener('click', () => {
    document.getElementById('cat-form-title').innerHTML = '<i class="fa-solid fa-folder-plus"></i> Nueva Categoría';
    document.getElementById('cat-id-input').value = '';
    document.getElementById('cat-name-input').value = '';
    document.getElementById('cat-label-input').value = '';
    document.getElementById('btn-cancel-cat').style.display = 'none';
});

// Guardar Categoría desde el Modal
document.getElementById('btn-save-cat')?.addEventListener('click', () => {
    const id = document.getElementById('cat-id-input').value;
    const oldName = document.getElementById('cat-old-name-input').value;
    const name = document.getElementById('cat-name-input').value.trim().toLowerCase();
    const label = document.getElementById('cat-label-input').value.trim();

    if (name.length === 0 || label.length === 0) return;

    fetch(`https://${GetParentResourceName()}/saveCategory`, {
        method: 'POST',
        body: JSON.stringify({
            id: id ? parseInt(id) : null,
            name: name,
            oldName: oldName, // Mandamos el nombre viejo al servidor
            label: label
        })
    });

    toggleModal('category-modal', false);
});

// Eliminar Categoría (Lógica Actualizada para coches 'none')
function deleteCategory(id) {
    const cat = activeCategories.find(c => c.id === id);
    if (!cat) return;

    // Miramos en nuestra variable global si hay coches usando esta categoría
    const vehiclesInCat = globalStock.filter(v => v.category === cat.name);

    if (vehiclesInCat.length > 0) {
        // TIENE COCHES: Mostramos la advertencia avisando de que pasarán a "Sin Asignar"
        document.getElementById('delete-cat-modal-text').innerHTML = `La categoría <b>${cat.label.toUpperCase()}</b> contiene <b>${vehiclesInCat.length} modelos</b> en stock.<br><br>Si la eliminas, estos vehículos pasarán al estado <b>"SIN ASIGNAR"</b> y no serán visibles para los clientes hasta que los muevas a otra categoría. ¿Continuar?`;
        document.getElementById('cat-to-delete-id').value = cat.id;
        document.getElementById('cat-to-delete-name').value = cat.name;
        toggleModal('delete-category-modal', true);
    } else {
        // ESTÁ VACÍA: Disparamos a matar sin preguntar
        fetch(`https://${GetParentResourceName()}/deleteCategory`, {
            method: 'POST',
            body: JSON.stringify({ id: cat.id, name: cat.name })
        });
    }
}

// Botón de SÍ, ELIMINAR TODO del nuevo modal
document.getElementById('confirm-delete-cat-btn')?.addEventListener('click', () => {
    const id = document.getElementById('cat-to-delete-id').value;
    const name = document.getElementById('cat-to-delete-name').value;

    fetch(`https://${GetParentResourceName()}/deleteCategory`, {
        method: 'POST',
        body: JSON.stringify({ id: parseInt(id), name: name })
    });

    toggleModal('delete-category-modal', false);
});

// Función para el botón del "Ojito" (Ver vehículos de una categoría)
function viewCategory(id) {
    const cat = activeCategories.find(c => c.id === id);
    if (!cat) return;

    // 1. Le quitamos la clase 'active-cat' a todas las categorías
    document.querySelectorAll('.cat-list-item').forEach(el => el.classList.remove('active-cat'));

    // 2. Se la ponemos solo a la fila que hemos clickeado
    const selectedRow = document.getElementById(`cat-item-${id}`);
    if (selectedRow) selectedRow.classList.add('active-cat');

    const grid = document.querySelector('.category-vehicles-grid');
    const rightWidget = grid.parentElement;
    const titleEl = rightWidget.querySelector('.widget-title');

    // Le aplicamos flexbox al título para separar el texto del botón
    titleEl.style.display = 'flex';
    titleEl.style.justifyContent = 'space-between';
    titleEl.style.alignItems = 'center';

    titleEl.innerHTML = `
        <span><i class="fa-solid fa-car-side"></i> Vehículos en: <span style="color: #ffffff;">${cat.label.toUpperCase()}</span></span>
        <button class="btn-primary" onclick="openMassAddModal('${cat.name}', '${cat.label}')" style="font-size: 0.6vw; padding: 0.5vh 0.8vw; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); cursor: pointer; border-radius: 4px; color: white;">
            <i class="fa-solid fa-plus"></i> AÑADIR VEHÍCULOS
        </button>
    `;

    grid.className = 'category-vehicles-grid boss-vehicles-grid';
    grid.innerHTML = '';

    const filteredVehicles = globalStock.filter(v => v.category === cat.name);

    if (filteredVehicles.length === 0) {
        grid.className = 'category-vehicles-grid';
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                <iconify-icon icon="solar:car-broken-bold-duotone" class="empty-state-icon"></iconify-icon>
                <span class="empty-state-text">No hay vehículos asignados a esta categoría</span>
            </div>
        `;
        return;
    }

    filteredVehicles.forEach(v => {
        const card = document.createElement('div');
        card.className = 'vehicle-card';
        card.setAttribute('data-model', v.model);

        const formattedPrice = new Intl.NumberFormat('es-ES').format(v.price || 0);
        const stockNum = v.stock || 0;
        const badgeBg = stockNum > 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        const badgeColor = stockNum > 0 ? '#ffffff' : '#888888';
        const badgeBorder = stockNum > 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)';

        card.innerHTML = `
            <div class="card-header-info">
                <div class="card-brand-logo"><i class="fa-solid fa-car"></i></div>
                <div class="card-text-info">
                    <span class="card-brand-name">${v.brand || 'Desconocido'}</span>
                    <span class="card-model-name">${v.name || v.model}</span>
                </div>
                
                <div style="margin-left: auto; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 0.2vw 0.4vw; border-radius: 4px; font-size: 0.7vw; font-weight: 900; font-family: 'Orbitron', sans-serif; display: flex; align-items: center; gap: 0.3vw;">
                    ${stockNum} <i class="fa-solid fa-cubes"></i>
                </div>
            </div>
            
            <div class="card-vehicle-image" style="position: relative; display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; overflow: hidden; padding: 0.5vw; background: rgba(0,0,0,0.2);">
                <span style="position: absolute; top: 0.4vw; left: 0.4vw; font-size: 0.55vw; color: #666; background: rgba(0,0,0,0.5); padding: 0.2vw 0.4vw; border-radius: 3px; z-index: 2;">ID: ${v.model}</span>
                
                ${getSmartVehicleImage(v.model, v.shop)}
                
                <span style="position: absolute; bottom: 0.4vw; right: 0.4vw; color: #fff; font-weight: 900; font-size: 0.9vw; text-shadow: 0 4px 10px rgba(0,0,0,1); z-index: 2; font-family: 'Orbitron', sans-serif;">
                    $ ${formattedPrice}
                </span>
            </div>
        `;

        // Evento para abrir el modal al hacer clic en la tarjeta del vehículo
        card.addEventListener('click', () => {
            openChangeCategoryModal(v);
        });

        grid.appendChild(card);
    });
}


// =================================================================
// MÓDULO 15: BOSS MENU - RANGOS Y PERMISOS
// =================================================================

// --- FUNCIONES DE PERMISOS / RANGOS ---
function renderJobGrades() {
    const list = document.getElementById('boss-ranks-list');
    if (!list) return;

    if (activeJobGrades.length === 0) {
        list.innerHTML = `<div class="empty-state"><iconify-icon icon="solar:users-group-rounded-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text">No se encontraron rangos</span></div>`;
        return;
    }

    list.innerHTML = '';
    activeJobGrades.forEach(g => {
        list.innerHTML += `
            <div class="rank-list-item" id="rank-item-${g.grade}" onclick="selectJobGrade(${g.grade})">
                <div style="display: flex; align-items: center; gap: 0.8vw;">
                    <div style="background: rgba(255,255,255,0.1); width: 2vw; height: 2vw; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 0.9vw;">
                        ${g.grade}
                    </div>
                    <div>
                        <div style="color: white; font-weight: bold; font-size: 0.8vw;">${g.name}</div>
                        <div style="color: #aaa; font-size: 0.65vw;">Configurar Permisos</div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: #fff; font-size: 0.8vw; opacity: 0.5;"></i>
            </div>
        `;
    });
}

// Función para los botones de Marcar Todos / Ninguno
function toggleAllPermissions(state) {
    document.querySelectorAll('.perm-checkbox').forEach(cb => {
        cb.checked = state;
    });
}

// Abrir Formulario para NUEVO Rango
function openNewGradeForm() {
    // Apagar cualquier rango que estuviera seleccionado
    document.querySelectorAll('.rank-list-item').forEach(el => el.classList.remove('active'));

    document.getElementById('grade-empty-state').style.display = 'none';
    document.getElementById('grade-editor-form').style.display = 'flex';
    document.getElementById('grade-editor-title').innerHTML = '<i class="fa-solid fa-folder-plus"></i> Nuevo Rango';

    document.getElementById('grade-id-input').value = '';
    document.getElementById('grade-is-new-input').value = 'true';

    // Activar el input del Nivel
    const levelInput = document.getElementById('grade-level-input');
    levelInput.value = '';
    levelInput.disabled = false;
    levelInput.style.opacity = '1';

    document.getElementById('grade-name-input').value = '';
    document.getElementById('grade-payment-input').value = '';

    // Interruptor de Jefe por defecto desactivado
    document.getElementById('grade-isboss-input').checked = false;
    document.getElementById('grade-isboss-input').dispatchEvent(new Event('change'));

    // Desmarcar todos los permisos por defecto
    toggleAllPermissions(false);

    // Ocultar botón de eliminar
    document.getElementById('btn-delete-grade').style.display = 'none';
}

// Cargar datos en el Formulario para EDITAR Rango
function selectJobGrade(gradeLevel) {
    // Apagar todos los rangos y encender solo el que hemos clickeado
    document.querySelectorAll('.rank-list-item').forEach(el => el.classList.remove('active'));
    const selectedItem = document.getElementById(`rank-item-${gradeLevel}`);
    if (selectedItem) selectedItem.classList.add('active');

    // Buscamos los datos del rango
    const gradeData = activeJobGrades.find(g => g.grade === gradeLevel);
    if (!gradeData) return;

    document.getElementById('grade-empty-state').style.display = 'none';
    document.getElementById('grade-editor-form').style.display = 'flex';
    document.getElementById('grade-editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Rango';

    document.getElementById('grade-id-input').value = gradeData.grade;
    document.getElementById('grade-is-new-input').value = 'false';

    // Desactivar el input del Nivel
    const levelInput = document.getElementById('grade-level-input');
    levelInput.value = gradeData.grade;
    levelInput.disabled = true;
    levelInput.style.opacity = '0.5';

    // Rellenar los datos básicos
    document.getElementById('grade-name-input').value = gradeData.name || '';
    document.getElementById('grade-payment-input').value = gradeData.payment || 0;

    // Activar/Desactivar Interruptor
    document.getElementById('grade-isboss-input').checked = gradeData.isboss === true;
    document.getElementById('grade-isboss-input').dispatchEvent(new Event('change'));

    // Cargar y rellenar los permisos del rango seleccionado
    const perms = gradeData.permissions || {};
    document.getElementById('perm-admin').checked = perms.admin === true;
    document.getElementById('perm-funds').checked = perms.funds === true;
    document.getElementById('perm-reservations').checked = perms.reservations === true;
    document.getElementById('perm-discounts').checked = perms.discounts === true;
    document.getElementById('perm-logs').checked = perms.logs === true;
    document.getElementById('perm-bonus').checked = perms.bonus === true;
    document.getElementById('perm-prices').checked = perms.prices === true;
    document.getElementById('perm-fire').checked = perms.fire === true;
    document.getElementById('perm-manage_staff').checked = perms.manage_staff === true;
    document.getElementById('perm-hire').checked = perms.hire === true;

    // Mostrar botón de eliminar
    document.getElementById('btn-delete-grade').style.display = 'block';
}

// =================================================================
// LÓGICA PARA CAMBIAR VEHÍCULO DE CATEGORÍA (BOSS MENU)
// =================================================================

// 1. Función para abrir el modal y poblar el select en vivo
function openChangeCategoryModal(vehicle) {
    const modal = document.getElementById('change-category-modal');
    if (!modal) return;

    // Rellenar textos descriptivos
    document.getElementById('change-cat-target-name').innerText = vehicle.name || vehicle.model;

    // Guardar datos ocultos para usarlos al hacer el Fetch
    document.getElementById('change-cat-vehicle-model').value = vehicle.model;
    document.getElementById('change-cat-old-category').value = vehicle.category;

    // Poblar el select con las categorías actualizadas
    const select = document.getElementById('new-category-select');
    select.innerHTML = '<option value="" disabled selected>Selecciona una categoría...</option>';

    if (activeCategories && activeCategories.length > 0) {
        let optionsAdded = false;
        activeCategories.forEach(cat => {
            // Lógica inteligente: No mostramos la categoría en la que YA ESTÁ el coche
            if (cat.name !== vehicle.category) {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.innerText = cat.label.toUpperCase();
                select.appendChild(opt);
                optionsAdded = true;
            }
        });

        if (!optionsAdded) {
            select.innerHTML = '<option value="" disabled selected>No hay más categorías disponibles</option>';
        }
    } else {
        select.innerHTML = '<option value="" disabled selected>No hay otras categorías</option>';
    }

    // Mostrar el modal
    toggleModal('change-category-modal', true);
}

// 2. Evento del botón ACEPTAR del modal
document.addEventListener('DOMContentLoaded', () => {
    const confirmChangeCatBtn = document.getElementById('confirm-change-cat-btn');
    if (confirmChangeCatBtn) {
        confirmChangeCatBtn.addEventListener('click', () => {
            const model = document.getElementById('change-cat-vehicle-model').value;
            const oldCategory = document.getElementById('change-cat-old-category').value;
            const newCategory = document.getElementById('new-category-select').value;

            // Validación de seguridad
            if (!newCategory || newCategory === "") {
                return; // Podemos añadir una notificación roja si quieres, pero con esto no hace nada si no elige
            }

            // A. Cambiamos la categoría visualmente en la variable global (Actualización Instantánea UX)
            const vehicleInGlobal = globalStock.find(v => v.model === model);
            if (vehicleInGlobal) {
                vehicleInGlobal.category = newCategory;
            }

            // B. Refrescamos la vista de la categoría antigua (el coche desaparecerá de la cuadrícula al instante)
            const oldCatObj = activeCategories.find(c => c.name === oldCategory);
            if (oldCatObj) {
                viewCategory(oldCatObj.id);
            }

            // C. Mandamos la orden al cliente/servidor Lua
            fetch(`https://${GetParentResourceName()}/changeVehicleCategory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    oldCategory: oldCategory,
                    newCategory: newCategory
                })
            });

            // D. Cerramos el modal
            toggleModal('change-category-modal', false);
        });
    }
});

// =================================================================
// LÓGICA DE AÑADIDO MASIVO DE VEHÍCULOS A CATEGORÍAS (VERSIÓN BLINDADA)
// =================================================================

let selectedVehiclesForMassAdd = [];
let targetMassAddCategory = "";
let currentUnassignedStock = [];

// 1. Abrir el Modal (Hecho Global explícitamente con window.)
window.openMassAddModal = function (catName, catLabel) {
    targetMassAddCategory = catName;
    selectedVehiclesForMassAdd = []; // Reseteamos la selección
    document.getElementById('mass-add-count').innerText = "0";
    document.getElementById('mass-add-search').value = ""; // Limpiamos buscador

    // Actualizamos el texto visual
    document.getElementById('mass-add-target-cat-label').innerText = catLabel.toUpperCase();

    // Filtramos los coches que NO tienen una categoría válida asignada
    const validCatNames = activeCategories.map(c => c.name);

    currentUnassignedStock = globalStock.filter(v => {
        return !v.category || v.category === "" || v.category === "none" || !validCatNames.includes(v.category);
    });

    window.renderMassAddGrid(currentUnassignedStock);
    toggleModal('mass-add-vehicles-modal', true);
};

// 2. Dibujar la cuadrícula de coches sin categoría (Hecho Global)
window.renderMassAddGrid = function (vehicles) {
    const grid = document.getElementById('mass-add-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (vehicles.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; margin-top: 5vh;">
                <iconify-icon icon="solar:check-circle-bold-duotone" class="empty-state-icon" style="color: #cccccc;"></iconify-icon>
                <span class="empty-state-text" style="color: #aaaaaa;">¡Todo el stock está organizado en categorías!</span>
            </div>
        `;
        return;
    }

    vehicles.forEach(v => {
        const card = document.createElement('div');
        const isSelected = selectedVehiclesForMassAdd.includes(v.model);
        card.className = `vehicle-card selectable ${isSelected ? 'selected' : ''}`;

        card.innerHTML = `
            <span class="no-cat-badge">SIN ASIGNAR</span>
            <div class="card-header-info">
                <div class="card-brand-logo"><i class="fa-solid fa-car"></i></div>
                <div class="card-text-info">
                    <span class="card-brand-name">${v.brand || 'Custom'}</span>
                    <span class="card-model-name">${v.name || v.model}</span>
                </div>
            </div>
            
            <div class="card-vehicle-image" style="position: relative; display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; overflow: hidden; padding: 0.5vw; background: rgba(0,0,0,0.2);">
                <span style="position: absolute; top: 0.4vw; left: 0.4vw; font-size: 0.55vw; color: #666; background: rgba(0,0,0,0.5); padding: 0.2vw 0.4vw; border-radius: 3px; z-index: 2;">ID: ${v.model}</span>
                ${getSmartVehicleImage(v.model, v.shop)}
            </div>
        `;

        // Evento de clic para seleccionar/deseleccionar
        card.addEventListener('click', function () {
            const index = selectedVehiclesForMassAdd.indexOf(v.model);

            if (index === -1) {
                // Seleccionar
                selectedVehiclesForMassAdd.push(v.model);
                this.classList.add('selected');
            } else {
                // Deseleccionar
                selectedVehiclesForMassAdd.splice(index, 1);
                this.classList.remove('selected');
            }

            // Actualizar contador del botón
            document.getElementById('mass-add-count').innerText = selectedVehiclesForMassAdd.length;
        });

        grid.appendChild(card);
    });
};

// =================================================================
// EVENTOS (Asegurados dentro del DOMContentLoaded para que existan los botones)
// =================================================================
document.addEventListener('DOMContentLoaded', () => {

    // 3. Buscador en vivo dentro del Modal
    document.getElementById('mass-add-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();

        if (term === '') {
            window.renderMassAddGrid(currentUnassignedStock);
        } else {
            const filtered = currentUnassignedStock.filter(v =>
                (v.name && v.name.toLowerCase().includes(term)) ||
                (v.model && v.model.toLowerCase().includes(term))
            );
            window.renderMassAddGrid(filtered);
        }
    });

    // 4. Confirmar el envío masivo
    document.getElementById('confirm-mass-add-btn')?.addEventListener('click', () => {
        if (selectedVehiclesForMassAdd.length === 0) return;

        // 1. Actualizamos nuestra memoria global instantáneamente
        selectedVehiclesForMassAdd.forEach(model => {
            const vehicleInGlobal = globalStock.find(v => v.model === model);
            if (vehicleInGlobal) {
                vehicleInGlobal.category = targetMassAddCategory;
            }
        });

        // 2. Refrescamos la vista de la categoría actual para que aparezcan de golpe
        const catObj = activeCategories.find(c => c.name === targetMassAddCategory);
        if (catObj) {
            // viewCategory ya era global en tu código, funcionará bien
            viewCategory(catObj.id);
        }

        // 3. Enviamos un Fetch MASIVO a Lua
        fetch(`https://${GetParentResourceName()}/massChangeVehicleCategory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                models: selectedVehiclesForMassAdd,
                newCategory: targetMassAddCategory
            })
        });

        // 4. Cerramos
        toggleModal('mass-add-vehicles-modal', false);
    });

    // 3. LÓGICA DE CHECKBOXES (BLOQUEO DE INPUTS)
    document.getElementById('check-disc-unlimited-uses')?.addEventListener('change', function (e) {
        const input = document.getElementById('input-disc-uses');
        const container = document.getElementById('disc-toggle-uses-container');
        const desc = document.getElementById('disc-toggle-uses-desc');

        input.disabled = e.target.checked;
        input.style.opacity = e.target.checked ? '0.3' : '1';
        if (e.target.checked) input.value = '';

        if (e.target.checked) {
            container.classList.add('active');
            desc.innerText = '¡Sin límite de usos!';
            desc.style.color = '#fff';
        } else {
            container.classList.remove('active');
            desc.innerText = 'Límite de usos activo';
            desc.style.color = '#aaa';
        }
    });

    document.getElementById('check-disc-unlimited-time')?.addEventListener('change', function (e) {
        const input = document.getElementById('input-disc-expiration');
        const container = document.getElementById('disc-toggle-time-container');
        const desc = document.getElementById('disc-toggle-time-desc');

        input.disabled = e.target.checked;
        input.style.opacity = e.target.checked ? '0.3' : '1';
        if (e.target.checked) input.value = '';

        if (e.target.checked) {
            container.classList.add('active');
            desc.innerText = '¡Sin fecha de expiración!';
            desc.style.color = '#fff';
        } else {
            container.classList.remove('active');
            desc.innerText = 'Fecha de expiración activa';
            desc.style.color = '#aaa';
        }
    });

}); // <-- Este es el cierre del DOMContentLoaded de línea 3709

// =================================================================
// MÓDULO 17: SISTEMA DE CREACIÓN DE DESCUENTOS (MODAL HEAVY)
// =================================================================

// 1. ABRIR EL MODAL Y REINICIAR TODO AL ESTADO "LIMPIO"
window.openCreateDiscountModal = function () {
    // Reset de variables de control
    discountSelectedVehicles = [];
    isDiscountRandom = true;
    isDiscountGlobal = true;

    // UI: Tipo de Código
    const btnRandom = document.getElementById('btn-disc-random');
    const btnCustom = document.getElementById('btn-disc-custom');
    const customBox = document.getElementById('disc-custom-box');
    if (btnRandom) btnRandom.classList.add('active');
    if (btnCustom) btnCustom.classList.remove('active');
    if (customBox) {
        customBox.style.display = 'none';
        customBox.querySelector('input').value = '';
    }

    // UI: Inputs básicos y Checkboxes
    document.getElementById('input-disc-perc').value = '';
    document.getElementById('input-disc-search').value = '';
    document.getElementById('disc-search-results').style.display = 'none';

    // Reset visual de los switch-containers
    const contUses = document.getElementById('disc-toggle-uses-container');
    const contTime = document.getElementById('disc-toggle-time-container');
    if (contUses) {
        contUses.classList.remove('active');
        document.getElementById('disc-toggle-uses-desc').innerText = 'Límite de usos activo';
        document.getElementById('disc-toggle-uses-desc').style.color = '#aaa';
    }
    if (contTime) {
        contTime.classList.remove('active');
        document.getElementById('disc-toggle-time-desc').innerText = 'Fecha de expiración activa';
        document.getElementById('disc-toggle-time-desc').style.color = '#aaa';
    }

    // UI: Usos
    const inputUses = document.getElementById('input-disc-uses');
    const checkUses = document.getElementById('check-disc-unlimited-uses');
    if (inputUses) { inputUses.value = ''; inputUses.disabled = false; inputUses.style.opacity = '1'; }
    if (checkUses) checkUses.checked = false;

    const btnGlobal = document.getElementById('btn-disc-global');
    const btnPerson = document.getElementById('btn-disc-person');
    if (btnGlobal) btnGlobal.classList.add('active');
    if (btnPerson) btnPerson.classList.remove('active');

    // UI: Tiempo
    const inputTime = document.getElementById('input-disc-expiration');
    const checkTime = document.getElementById('check-disc-unlimited-time');
    if (inputTime) { inputTime.value = ''; inputTime.disabled = false; inputTime.style.opacity = '1'; }
    if (checkTime) checkTime.checked = false;

    window.populateDiscCatFilter(); // ← añadir esta línea
    renderDiscountTags();
    toggleModal('create-discount-modal', true);
    updateDiscPreview();
};

// 2. GESTIÓN DE BOTONES DUALES (ESTILO REUTILIZADO)
document.addEventListener('click', (e) => {
    // Código: Aleatorio vs Personalizado
    if (e.target.id === 'btn-disc-random' || e.target.closest('#btn-disc-random')) {
        isDiscountRandom = true;
        document.getElementById('btn-disc-random').classList.add('active');
        document.getElementById('btn-disc-custom').classList.remove('active');
        document.getElementById('disc-custom-box').style.display = 'none';
    }
    if (e.target.id === 'btn-disc-custom' || e.target.closest('#btn-disc-custom')) {
        isDiscountRandom = false;
        document.getElementById('btn-disc-custom').classList.add('active');
        document.getElementById('btn-disc-random').classList.remove('active');
        document.getElementById('disc-custom-box').style.display = 'block';
    }

    // Límite: Global vs Por Persona
    if (e.target.id === 'btn-disc-global' || e.target.closest('#btn-disc-global')) {
        isDiscountGlobal = true;
        document.getElementById('btn-disc-global').classList.add('active');
        document.getElementById('btn-disc-person').classList.remove('active');
    }
    if (e.target.id === 'btn-disc-person' || e.target.closest('#btn-disc-person')) {
        isDiscountGlobal = false;
        document.getElementById('btn-disc-person').classList.add('active');
        document.getElementById('btn-disc-global').classList.remove('active');
    }
});

// 4. BUSCADORES — Lazy Load (50 en 50), Caché y Filtros
let _discSearchTimer = null;
let _discActiveCatFilter = 'ALL';

// Variables para el Scroll Infinito de Vehículos
let _discVehList = []; // Lista filtrada guardada en caché
let _discVehLoadedCount = 0;
const DISC_BATCH_SIZE = 50; // De cuántos en cuántos carga al bajar el ratón

// Poblar el filtro cuando se abra el modal
window.populateDiscCatFilter = function () {
    const selFilter = document.getElementById('disc-cat-filter');

    // 1. Selector que filtra la lupa (Vehículos Específicos)
    if (selFilter) {
        selFilter.innerHTML = '<option value="ALL">⬡ TODOS</option>';
        activeCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = '⬡ ' + cat.label.toUpperCase();
            selFilter.appendChild(opt);
        });
        selFilter.value = 'ALL';
    }

    _discActiveCatFilter = 'ALL';

    // Limpiamos los inputs y la caché visual al abrir el menú de cero
    document.getElementById('input-disc-search').value = '';
    document.getElementById('input-disc-category').value = '';
    _discVehList = [];
    _discVehLoadedCount = 0;
};

// ==========================================
// EVENTO: CAMBIAR FILTRO (Desplegable superior)
// ==========================================
document.getElementById('disc-cat-filter')?.addEventListener('change', function () {
    _discActiveCatFilter = this.value;
    // Si cambiamos de filtro, obligamos al buscador a recalcular
    document.getElementById('input-disc-search').dispatchEvent(new Event('input'));
});


// ==========================================
// LUPA 1: VEHÍCULOS (SCROLL INFINITO)
// ==========================================
// Al hacer clic, si ya teníamos la caché cargada y no hemos borrado el texto, solo mostramos la caja
document.getElementById('input-disc-search')?.addEventListener('click', function () {
    if (_discVehList.length > 0 && this.value === '') {
        document.getElementById('disc-search-results').style.display = 'block';
    } else {
        this.dispatchEvent(new Event('input'));
    }
});

// Al escribir en la lupa de Vehículos
document.getElementById('input-disc-search')?.addEventListener('input', function () {
    const resultsBox = document.getElementById('disc-search-results');
    const term = this.value.toLowerCase().trim();

    clearTimeout(_discSearchTimer);
    _discSearchTimer = setTimeout(() => {

        // 1. Primero filtramos por la carpeta seleccionada en el select
        const stockToSearch = _discActiveCatFilter === 'ALL'
            ? globalStock
            : globalStock.filter(v => v.category === _discActiveCatFilter);

        // 2. Luego filtramos por lo que ha escrito en la lupa y lo GUARDAMOS EN CACHÉ
        _discVehList = stockToSearch.filter(v => {
            const name = (v.name || v.model).toLowerCase();
            return term === '' || name.includes(term) || v.model.toLowerCase().includes(term);
        });

        // 3. Reseteamos el contador y la caja visual
        _discVehLoadedCount = 0;
        resultsBox.innerHTML = '';
        resultsBox.scrollTop = 0;

        if (_discVehList.length === 0) {
            resultsBox.innerHTML = `<div class="disc-result-empty">Sin vehículos${term !== '' ? ` para "${term}"` : ' en esta categoría'}</div>`;
        } else {
            // 4. Disparamos la carga de los primeros 50
            window.loadMoreDiscVehicles();
        }

        resultsBox.style.display = 'block';
    }, 150); // Pequeño retraso para que no laguee si escribe muy rápido
});

// Función que inyecta de 50 en 50
window.loadMoreDiscVehicles = function () {
    const resultsBox = document.getElementById('disc-search-results');
    if (!resultsBox) return;

    // Cortamos los siguientes 50 coches
    const nextBatch = _discVehList.slice(_discVehLoadedCount, _discVehLoadedCount + DISC_BATCH_SIZE);
    let html = '';

    nextBatch.forEach(v => {
        const safeName = (v.name || v.model).replace(/'/g, "\\'");
        html += `<div class="disc-result-row" onclick="addDiscountTag('VEH_${v.model}','${safeName}')">
            <span class="disc-result-name">${v.name || v.model}</span>
            <span class="disc-result-meta">${v.brand || v.model}</span>
        </div>`;
    });

    resultsBox.insertAdjacentHTML('beforeend', html);
    _discVehLoadedCount += nextBatch.length;
};

// Evento: Detectar cuando llegamos al final del scroll para cargar más
document.getElementById('disc-search-results')?.addEventListener('scroll', function () {
    // Si estamos a 20 píxeles del fondo y aún quedan coches por pintar...
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 20) {
        if (_discVehLoadedCount < _discVehList.length) {
            window.loadMoreDiscVehicles(); // Inyectamos 50 más!
        }
    }
});


// ==========================================
// LUPA 2: CATEGORÍAS (Buscador Inteligente)
// ==========================================
document.getElementById('input-disc-category')?.addEventListener('click', function () {
    this.dispatchEvent(new Event('input'));
});

document.getElementById('input-disc-category')?.addEventListener('input', function () {
    const resultsBox = document.getElementById('disc-cat-search-results');
    const term = this.value.toLowerCase().trim();
    let html = '';

    // Filtramos las categorías
    const filteredCats = activeCategories.filter(cat =>
        term === '' || cat.label.toLowerCase().includes(term) || cat.name.toLowerCase().includes(term)
    );

    if (filteredCats.length === 0) {
        html = `<div class="disc-result-empty">Sin resultados para "${term}"</div>`;
    } else {
        filteredCats.forEach(cat => {
            const safeLabel = cat.label.replace(/'/g, "\\'");
            // Usamos la misma clase 'disc-result-row' para que tenga el mismo diseño exacto
            html += `<div class="disc-result-row disc-result-cat" onclick="addDiscountTag('CAT_${cat.name}','${safeLabel}')">
                <span class="disc-result-name">${cat.label.toUpperCase()}</span>
                <span class="disc-result-meta">Categoría completa</span>
            </div>`;
        });
    }

    resultsBox.innerHTML = html;
    resultsBox.style.display = 'block';
});

// ==========================================
// OCULTAR CAJAS AL CLICAR FUERA
// ==========================================
document.addEventListener('click', (e) => {
    // Si pincha fuera del buscador de Vehículos
    if (!e.target.closest('#input-disc-search') && !e.target.closest('#disc-search-results')) {
        const resV = document.getElementById('disc-search-results');
        if (resV) resV.style.display = 'none';
    }
    // Si pincha fuera del buscador de Categorías
    if (!e.target.closest('#input-disc-category') && !e.target.closest('#disc-cat-search-results')) {
        const resC = document.getElementById('disc-cat-search-results');
        if (resC) resC.style.display = 'none';
    }
});

// 5. GESTIÓN DE ETIQUETAS (TAGS SEPARADOS)
window.addDiscountTag = function (id, label) {
    if (!discountSelectedVehicles.find(x => x.id === id)) {
        discountSelectedVehicles.push({ id: id, label: label });
    }
    document.getElementById('input-disc-search').value = '';
    document.getElementById('disc-search-results').style.display = 'none';
    renderDiscountTags();
};

window.renderDiscountTags = function () {
    const vehContainer = document.getElementById('disc-tags-container');
    const catContainer = document.getElementById('disc-cat-tags-container');

    if (vehContainer) vehContainer.innerHTML = '';
    if (catContainer) catContainer.innerHTML = '';

    let hasVehs = false;
    let hasCats = false;

    discountSelectedVehicles.forEach((tag, idx) => {
        const isCat = tag.id.startsWith('CAT_');
        const typeLabel = isCat ? 'CAT' : 'VEH';
        const extraClass = isCat ? 'is-cat' : '';

        const tagHTML = `
            <div class="disc-tag-card ${extraClass}">
                <span class="disc-tag-type">${typeLabel}</span>
                <span class="disc-tag-name">${tag.label}</span>
                <button class="disc-tag-remove" onclick="removeDiscountTag(${idx})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        // Repartimos los tags en su cajón correspondiente
        if (isCat && catContainer) {
            catContainer.innerHTML += tagHTML;
            hasCats = true;
        } else if (!isCat && vehContainer) {
            vehContainer.innerHTML += tagHTML;
            hasVehs = true;
        }
    });

    if (!hasVehs && vehContainer) {
        vehContainer.innerHTML = '<span class="disc-tags-empty" style="font-size: 0.55vw; color: rgba(255,255,255,0.3); font-style: italic;">Ningún vehículo específico seleccionado...</span>';
    }
    if (!hasCats && catContainer) {
        catContainer.innerHTML = '<span class="disc-tags-empty" style="font-size: 0.55vw; color: rgba(255,255,255,0.3); font-style: italic;">Ninguna categoría seleccionada...</span>';
    }

    updateDiscPreview();
};

window.removeDiscountTag = function (index) {
    discountSelectedVehicles.splice(index, 1);
    renderDiscountTags();
};

// 6. ENVÍO FINAL AL SERVIDOR

// VISTA PREVIA EN VIVO (ACTUALIZADA)
function updateDiscPreview() {
    const perc = document.getElementById('input-disc-perc')?.value;
    const isRandom = isDiscountRandom;
    const customCode = document.getElementById('input-disc-custom-code')?.value?.trim().toUpperCase();

    const codeEl = document.getElementById('disc-preview-code-text');
    const percEl = document.getElementById('disc-preview-perc-text');
    const subEl = document.getElementById('disc-preview-sub-text');

    if (!codeEl || !percEl) return;

    if (isRandom) {
        codeEl.innerText = '— — — — — — — —';
    } else if (customCode.length >= 5) {
        codeEl.innerText = customCode;
    } else {
        codeEl.innerText = '— — — — — — — —';
    }

    if (perc && perc >= 5 && perc <= 90) {
        percEl.innerText = perc + '%';
        // Si no hay etiquetas seleccionadas, avisamos de que es GLOBAL
        subEl.innerText = discountSelectedVehicles.length > 0
            ? `${discountSelectedVehicles.length} objetivo(s) específico(s)`
            : 'Se aplicará a TODO EL STOCK';
    } else {
        percEl.innerText = '?%';
        subEl.innerText = 'Completa los campos para generar';
    }
}

document.getElementById('input-disc-perc')?.addEventListener('input', updateDiscPreview);
document.getElementById('input-disc-custom-code')?.addEventListener('input', updateDiscPreview);

document.getElementById('btn-save-discount')?.addEventListener('click', function () {
    const percentage = parseInt(document.getElementById('input-disc-perc').value);
    const uses = parseInt(document.getElementById('input-disc-uses').value);
    const isUnlimitedUses = document.getElementById('check-disc-unlimited-uses').checked;
    const expiration = document.getElementById('input-disc-expiration').value;
    const isUnlimitedTime = document.getElementById('check-disc-unlimited-time').checked;

    if (isNaN(percentage) || percentage < 5 || percentage > 90) return;

    // YA NO BLOQUEAMOS SI ESTÁ VACÍO. Si está vacío, se aplica a todo.
    // if (discountSelectedVehicles.length === 0) return; 

    if (!isUnlimitedUses && (isNaN(uses) || uses <= 0)) return;
    if (!isUnlimitedTime && !expiration) return;

    let code = "";
    if (isDiscountRandom) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    } else {
        code = document.getElementById('input-disc-custom-code').value.trim().toUpperCase();
        if (code.length < 5) return;
    }

    // LA MAGIA DE "TODOS": Si el array está vacío, enviamos "ALL" a la base de datos
    const finalVehicles = discountSelectedVehicles.length === 0 ? "ALL" : discountSelectedVehicles.map(v => v.id);

    fetch(`https://${GetParentResourceName()}/createDiscountCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: code,
            percentage: percentage,
            vehicles: finalVehicles,
            unlimitedUses: isUnlimitedUses,
            uses: uses,
            limitType: isDiscountGlobal ? 'GLOBAL' : 'PER_PERSON',
            unlimitedTime: isUnlimitedTime,
            expiration: expiration
        })
    });

    toggleModal('create-discount-modal', false);
});

// =================================================================
// MÓDULO 16: INICIALIZACIÓN - DOMContentLoaded
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');

    // =================================================================
    // BOTONES DE COMPARATIVA DE VEHÍCULOS
    // =================================================================
    const compareBtn = document.getElementById('showroom-compare-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', function () {
            if (!currentPreviewVehicle) return;

            isCompareModeActive = !isCompareModeActive;
            this.classList.toggle('active', isCompareModeActive);

            // ACTIVAR O DESACTIVAR BLOQUEO DE BOTONES
            toggleComparisonInteraction(isCompareModeActive);

            if (isCompareModeActive) {
                updateCardSelectionVisuals();
            } else {
                currentCompareVehicle = null;
                document.getElementById('compare-stats-panel').style.display = 'none';

                // Reset del título
                const baseTitle = document.querySelector('#base-stats-panel .panel-category-title');
                if (baseTitle) baseTitle.innerText = "RENDIMIENTO";

                updateCardSelectionVisuals();
            }
        });
    }

    const closeCompareBtn = document.getElementById('btn-close-compare');
    if (closeCompareBtn) {
        closeCompareBtn.addEventListener('click', function () {
            isCompareModeActive = false;

            // DESBLOQUEAR BOTONES AL CERRAR
            toggleComparisonInteraction(false);

            document.getElementById('showroom-compare-btn').classList.remove('active');
            document.getElementById('compare-stats-panel').style.display = 'none';

            const baseTitle = document.querySelector('#base-stats-panel .panel-category-title');
            if (baseTitle) baseTitle.innerText = "RENDIMIENTO";

            updateCardSelectionVisuals();
        });
    }

    // --- LISTENERS DE BOTONES PRINCIPALES (MENÚ DE GESTIÓN) ---
    document.querySelector('[data-i18n="btn_set_spawn"]').addEventListener('click', () => toggleModal('set-spawn-modal', true));
    document.querySelector('[data-i18n="btn_assign_vehicle"]').addEventListener('click', () => toggleModal('assign-vehicle-modal', true));

    // Copiar Coordenadas
    document.getElementById('copy-coords-btn').addEventListener('click', () => {
        fetch('https://DP-VehicleShop/requestSpawnCoords', { method: 'POST', body: JSON.stringify({}) });
    });

    // Cerrar Modales (X / Cancelar)
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleModal(e.currentTarget.getAttribute('data-modal'), false));
    });

    // --- BUSCADOR ---
    document.getElementById('vehicle-search-input').addEventListener('input', filterVehicleList);

    // --- ACCIONES DE FORMULARIOS (Fetch a Lua) ---

    // Crear Spawn
    document.getElementById('confirm-spawn-btn').addEventListener('click', () => {
        const name = document.getElementById('spawnName').value.trim();
        const x = parseFloat(document.getElementById('coord_x').value);
        const y = parseFloat(document.getElementById('coord_y').value);
        const z = parseFloat(document.getElementById('coord_z').value);
        const h = parseFloat(document.getElementById('coord_h').value);

        if (!name || isNaN(x)) return; // Validación simple

        fetch('https://DP-VehicleShop/setSpawnPosition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, x, y, z, h })
        });
        toggleModal('set-spawn-modal', false);
    });

    // Asignar Vehículo
    document.getElementById('confirm-assign-btn').addEventListener('click', () => {
        const model = document.getElementById('vehicleHash').value.trim();
        if (!model) return;

        // Envia el precio
        fetch('https://DP-VehicleShop/assignVehicle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                display_name: document.getElementById('vehicleDisplayName').value.trim(),
                model: model,
                spawn_id: parseInt(document.getElementById('spawnSelector').value),
                price: parseInt(document.getElementById('vehiclePrice').value) || 0
            })
        });
        toggleModal('assign-vehicle-modal', false);
        document.getElementById('vehicleHash').value = ''; // Limpiar
        document.getElementById('vehiclePrice').value = ''; // Limpiar precio
    });

    // Guardar Edición
    document.getElementById('confirm-edit-btn').addEventListener('click', () => {
        // Envia el precio editado
        fetch('https://DP-VehicleShop/editVehicle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: parseInt(document.getElementById('editVehicleId').value),
                display_name: document.getElementById('editVehicleDisplayName').value.trim(),
                model: document.getElementById('editVehicleHash').value.trim(),
                spawn_id: parseInt(document.getElementById('editSpawnSelector').value),
                price: parseInt(document.getElementById('editVehiclePrice').value) || 0
            })
        });
        toggleModal('edit-vehicle-modal', false);
    });

    // Confirmar Borrado
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        const id = document.getElementById('vehicle-to-delete-id').value;
        if (id) {
            fetch('https://DP-VehicleShop/deleteVehicle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
        }
        toggleModal('delete-confirm-modal', false);
    });

    // --- LISTENER DE MENSAJES NUI (Lua -> JS) ---
    window.addEventListener('message', (event) => {
        const data = event.data;
        switch (data.action) {
            case 'setVisible':
                container.style.display = data.status ? 'flex' : 'none';
                break;
            // Recibe las traducciones y la configuración de items por página
            case 'loadTranslations':
                globalTranslations = data.translations;
                itemsPerPage = data.itemsPerPage || 7;
                applyTranslations();
                break;
            // Actualiza las coordenadas en el modal de Crear Spawn
            case 'updateCoords':
                updateCoordsDisplay(data.coords);
                break;
            // Recibe la lista de vehículos para mostrar en la tabla
            case 'sendVehicles':
                if (data.vehicleList && Array.isArray(data.vehicleList)) {
                    populateVehicleTable(data.vehicleList);
                }
                break;
            // Recibe la lista de spawns para el selector (Crear/Editar Vehículo)
            case 'sendSpawns':
                populateSpawnSelector(data.spawnList);
                break;
            // Caso para actualizar el HUD
            case 'updateHUD':
                updateShowroomHUD(data.vehicles);
                break;
            // Abre el nuevo UI del Showroom
            case 'openDealershipUI':
                // Limpiamos todo el estado visual y el vehículo seleccionado anteriormente
                hideVehicleInfo();
                const paymentPanel = document.getElementById('payment-selection-panel');
                if (paymentPanel) paymentPanel.style.display = 'none';

                isShowroomOpen = true;
                document.getElementById('showroom-container').style.display = 'block';

                // Forzamos a que dibuje los coches de la categoría TODOS al abrir el menú
                applyShowroomFilter('all');
                break;
            // Abre el menú de gestión (Boss Menu)
            case 'openBossMenu':
                isBossMenuOpen = true;
                // CAMBIAMOS data.dealerLabel por data.dealerName para que coincida con tu Lua
                currentBossDealerName = data.dealerName;

                document.getElementById('boss-dealer-title').innerText = currentBossDealerName;
                document.getElementById('boss-back-btn').style.display = 'none';
                document.getElementById('boss-container').style.display = 'flex';

                // Limpiamos el panel derecho de categorías para que no se mezclen concesionarios
                const catGrid = document.querySelector('.category-vehicles-grid');
                if (catGrid) {
                    // Le quitamos la clase del grid para que se centre el mensaje
                    catGrid.className = 'category-vehicles-grid';
                    catGrid.innerHTML = `
                        <div class="empty-state" style="grid-column: 1 / -1; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                            <iconify-icon icon="solar:car-broken-bold-duotone" class="empty-state-icon"></iconify-icon>
                            <span class="empty-state-text">Selecciona una categoría a la izquierda</span>
                        </div>
                    `;
                    // Reseteamos también el título para quitar el nombre de la categoría vieja
                    const titleEl = catGrid.parentElement.querySelector('.widget-title');
                    if (titleEl) {
                        titleEl.innerHTML = `<i class="fa-solid fa-car-side"></i> Vehículos en la Categoría`;
                    }
                }
                break;
            // Actualiza los datos financieros en tiempo real
            case 'updateBossData':
                const balanceDisplay = document.getElementById('company-balance-display');

                // Formateamos para que el $ esté SIEMPRE a la izquierda
                const balanceStr = '$ ' + new Intl.NumberFormat('es-ES').format(data.balance);
                balanceDisplay.innerText = balanceStr;

                // Lógica de tamaño dinámico SÚPER AGRESIVA según la cantidad de números
                const charCount = balanceStr.length;
                if (charCount >= 16) {
                    balanceDisplay.style.fontSize = '1.3vw';
                } else if (charCount >= 13) {
                    balanceDisplay.style.fontSize = '1.6vw';
                } else if (charCount >= 10) {
                    balanceDisplay.style.fontSize = '2.0vw';
                } else if (charCount >= 8) {
                    balanceDisplay.style.fontSize = '2.3vw';
                } else {
                    balanceDisplay.style.fontSize = '2.8vw';
                }

                // Cargar Transacciones (Ingresos/Retiros)
                transWorkingList = data.transactions || [];
                originalTransList = [...transWorkingList];
                transCurrentPage = 1;
                renderTransactionsTable();

                // DIBUJAR GRÁFICA CON DATOS REALES
                const chartData = calculateWeeklyChartData(transWorkingList);
                updateCompanyChart(chartData);

                // Cargar Últimas Ventas
                salesWorkingList = data.sales || [];
                originalSalesList = [...salesWorkingList];
                salesCurrentPage = 1;
                renderSalesTable();

                // Cargar Descuentos Reales
                originalDiscList = data.discounts || [];
                discWorkingList = [...originalDiscList];
                discCurrentPage = 1;
                renderDiscTable();
                break;
            // Refresco individual solo para la tabla de descuentos
            case 'updateDiscounts':
                originalDiscList = data.discounts || [];
                discWorkingList = [...originalDiscList];
                discCurrentPage = 1;
                renderDiscTable();
                break;
            // Abre el menú de compra del concesionario (Buy Menu)
            case 'openBuyMenu':
                currentBuyDealer = data.dealerId;
                document.getElementById('buy-dealer-label').innerText = data.dealerLabel;
                document.getElementById('buy-dealer-price').innerText = new Intl.NumberFormat('es-ES').format(data.price) + ' $';
                document.getElementById('buy-container').style.display = 'flex';
                break;
            // Recibe las categorías de vehículos para el filtro del Showroom
            case 'loadCategories':
                activeCategories = data.categories || [];
                renderBossCatsTable();
                renderShowroomFilters();

                // Limpiar el formulario automáticamente tras guardar/borrar
                if (document.getElementById('cat-form-title')) {
                    document.getElementById('cat-form-title').innerHTML = '<i class="fa-solid fa-folder-plus"></i> Nueva Categoría';
                    document.getElementById('cat-id-input').value = '';
                    document.getElementById('cat-name-input').value = '';
                    document.getElementById('cat-label-input').value = '';
                    document.getElementById('btn-cancel-cat').style.display = 'none';
                }
                break;
            // Recibe los rangos de trabajo para mostrar/ocultar categorías en el Boss Menu
            case 'loadJobGrades':
                activeJobGrades = data.grades || [];
                renderJobGrades();
                break;
            // Recibe la lista de vehículos reales filtrada para este concesionario
            case 'loadBossStock':
                globalStock = data.vehicles || [];

                // Si la pestaña de vehículos está abierta justo ahora, la refrescamos al instante
                if (document.getElementById('tab-vehicles') && document.getElementById('tab-vehicles').classList.contains('active')) {
                    renderBossVehicles(document.getElementById('boss-vehicles-search').value);
                }
                break;
            // Recibe la lista de reservas pendientes para mostrar en el Boss Menu
            case 'updateReservations':
                // Recibe la lista de reservas desde el servidor/cliente y las pinta
                loadPendingReservations(data.reservations);
                break;
            // Recibe los coches que el jugador ya tiene reservados de antes
            case 'loadMyReservations':
                myPendingReservations = data.myReservations || [];
                break;
            // Actualización de stock en tiempo real
            case 'updateStockLive':
                const updatedModel = data.model;
                const newStock = data.stock;

                // Actualizamos las listas internas
                const inMasterList = originalFullList.find(v => v.model === updatedModel);
                if (inMasterList) inMasterList.stock = newStock;

                const inWorkingList = currentWorkingList.find(v => v.model === updatedModel);
                if (inWorkingList) inWorkingList.stock = newStock;

                // Recargamos el carrusel para que se actualice el número de stock
                if (isShowroomOpen) {
                    applyShowroomFilter(currentShowroomCategory);
                }

                if (currentPreviewVehicle && currentPreviewVehicle.model === updatedModel) {
                    currentPreviewVehicle.stock = newStock;
                    const stockLabel = document.getElementById('info-vehicle-stock');
                    if (stockLabel) stockLabel.innerText = newStock;
                    selectShowroomVehicle(currentPreviewVehicle);
                }
                break;
            // Recibir la lista de extras de un coche específico
            case 'loadVehicleExtras':
                renderVehicleExtras(data.extras);
                break;
            // Recibe las estadísticas reales de rendimiento desde Lua
            case 'updateVehicleStats':
                const stats = data.stats;

                // 1. ACTUALIZAR BARRAS DE PROGRESO
                const sVal = document.getElementById('stat-speed-val');
                if (sVal) sVal.innerText = `${stats.speed.toFixed(1)} / 10`;
                const sFill = document.getElementById('stat-speed-fill');
                if (sFill) sFill.style.width = `${(stats.speed / 10) * 100}%`;

                const aVal = document.getElementById('stat-accel-val');
                if (aVal) aVal.innerText = `${stats.acceleration.toFixed(1)} / 10`;
                const aFill = document.getElementById('stat-accel-fill');
                if (aFill) aFill.style.width = `${(stats.acceleration / 10) * 100}%`;

                const bVal = document.getElementById('stat-brakes-val');
                if (bVal) bVal.innerText = `${stats.braking.toFixed(1)} / 10`;
                const bFill = document.getElementById('stat-brakes-fill');
                if (bFill) bFill.style.width = `${(stats.braking / 10) * 100}%`;

                const hVal = document.getElementById('stat-handling-val');
                if (hVal) hVal.innerText = `${stats.handling.toFixed(1)} / 10`;
                const hFill = document.getElementById('stat-handling-fill');
                if (hFill) hFill.style.width = `${(stats.handling / 10) * 100}%`;

                // 2. ACTUALIZAR CUADRÍCULA EXTRA (Grid)
                const maxSpeedEl2 = document.getElementById('detail-max-speed');
                if (maxSpeedEl2 && stats.maxSpeedText) maxSpeedEl2.innerText = stats.maxSpeedText;

                const seatsEl2 = document.getElementById('detail-seats');
                if (seatsEl2 && stats.seats) seatsEl2.innerText = stats.seats;

                const accelTimeEl2 = document.getElementById('detail-acceleration-time');
                if (accelTimeEl2 && stats.accelTimeText) accelTimeEl2.innerText = stats.accelTimeText;

                // Cambiar el título de 0-100 KM/H a 0-60 MP/H dinámicamente
                const accelLabelEl = document.getElementById('detail-accel-label');
                if (accelLabelEl && stats.measurementUnit) {
                    if (stats.measurementUnit === 'mph') {
                        accelLabelEl.innerText = '0-60 MP/H';
                    } else {
                        accelLabelEl.innerText = '0-100 KM/H';
                    }
                }

                const tuningBox2 = document.getElementById('detail-tuning-box');
                const tuningText2 = document.getElementById('detail-tuning-text');
                if (tuningBox2 && tuningText2) {
                    tuningBox2.classList.remove('tuning-available', 'tuning-unavailable');
                    if (stats.hasTuning) {
                        tuningBox2.classList.add('tuning-available');
                        tuningText2.innerText = 'SÍ';
                    } else {
                        tuningBox2.classList.add('tuning-unavailable');
                        tuningText2.innerText = 'NO';
                    }
                }

                // CALCULAR LA CLASE/TIER DEL VEHÍCULO
                const classBadge = document.getElementById('info-vehicle-class');
                if (classBadge) {
                    // Sumamos las 4 estadísticas y sacamos la media sobre 10
                    const totalScore = stats.speed + stats.acceleration + stats.braking + stats.handling;
                    const avgScore = totalScore / 4;

                    let vehClass = 'E';
                    let cssClass = 'class-e';

                    // Sistema de Calificación Estricto
                    if (avgScore >= 8.8) {
                        vehClass = 'S+';
                        cssClass = 'class-splus';
                    } else if (avgScore >= 7.8) {
                        vehClass = 'S';
                        cssClass = 'class-s';
                    } else if (avgScore >= 6.8) {
                        vehClass = 'A';
                        cssClass = 'class-a';
                    } else if (avgScore >= 5.5) {
                        vehClass = 'B';
                        cssClass = 'class-b';
                    } else if (avgScore >= 4.0) {
                        vehClass = 'C';
                        cssClass = 'class-c';
                    } else if (avgScore >= 2.5) {
                        vehClass = 'D';
                        cssClass = 'class-d';
                    }

                    classBadge.innerText = vehClass;
                    classBadge.className = `vehicle-class-badge ${cssClass}`;
                }
                break;
            // Mostrar HUD de Test Drive con el tiempo restante
            case 'showTestDriveHUD':
                const hudEl = document.getElementById('testdrive-hud');
                if (hudEl) {
                    hudEl.style.display = 'flex';
                    document.getElementById('testdrive-timer').innerText = data.duration;
                }
                // Ocultar paneles del showroom durante la prueba
                const infoPanel = document.getElementById('vehicle-info-panel');
                const rightPanel = document.getElementById('right-custom-panel');
                const carousel = document.querySelector('.bottom-carousel-container');
                if (infoPanel) infoPanel.style.display = 'none';
                if (rightPanel) rightPanel.style.display = 'none';
                if (carousel) carousel.style.display = 'none';
                break;
            // Actualizar el tiempo restante en el HUD de Test Drive
            case 'updateTestDriveTimer':
                const timerEl = document.getElementById('testdrive-timer');
                if (timerEl) timerEl.innerText = data.timeLeft;
                break;
            // Ocultar el HUD de Test Drive
            case 'hideTestDriveHUD':
                const hudElHide = document.getElementById('testdrive-hud');
                if (hudElHide) hudElHide.style.display = 'none';
                // Restaurar paneles al terminar la prueba
                const infoPanelR = document.getElementById('vehicle-info-panel');
                const rightPanelR = document.getElementById('right-custom-panel');
                const carouselR = document.querySelector('.bottom-carousel-container');
                if (infoPanelR) infoPanelR.style.display = 'flex';
                if (rightPanelR) rightPanelR.style.display = 'flex';
                if (carouselR) carouselR.style.display = 'flex';
                break;
            // Recibe los stats del SEGUNDO coche para la comparativa
            case 'updateCompareStats':
                const compStats = data.stats;

                // 1. BARRAS
                document.getElementById('compare-stat-speed-val').innerText = `${compStats.speed.toFixed(1)} / 10`;
                document.getElementById('compare-stat-speed-fill').style.width = `${(compStats.speed / 10) * 100}%`;

                document.getElementById('compare-stat-accel-val').innerText = `${compStats.acceleration.toFixed(1)} / 10`;
                document.getElementById('compare-stat-accel-fill').style.width = `${(compStats.acceleration / 10) * 100}%`;

                document.getElementById('compare-stat-brakes-val').innerText = `${compStats.braking.toFixed(1)} / 10`;
                document.getElementById('compare-stat-brakes-fill').style.width = `${(compStats.braking / 10) * 100}%`;

                document.getElementById('compare-stat-handling-val').innerText = `${compStats.handling.toFixed(1)} / 10`;
                document.getElementById('compare-stat-handling-fill').style.width = `${(compStats.handling / 10) * 100}%`;

                // 2. DETALLES EXTRA
                document.getElementById('compare-detail-max-speed').innerText = compStats.maxSpeedText || '-- KM/H';
                document.getElementById('compare-detail-seats').innerText = compStats.seats || '--';
                document.getElementById('compare-detail-acceleration-time').innerText = compStats.accelTimeText || '-- s';

                const compLabelEl = document.getElementById('compare-detail-accel-label');
                if (compLabelEl && compStats.measurementUnit) {
                    compLabelEl.innerText = compStats.measurementUnit === 'mph' ? '0-60 MP/H' : '0-100 KM/H';
                }

                const compTuningBox = document.getElementById('compare-detail-tuning-box');
                const compTuningText = document.getElementById('compare-detail-tuning-text');
                if (compTuningBox && compTuningText) {
                    compTuningBox.classList.remove('tuning-available', 'tuning-unavailable');
                    if (compStats.hasTuning) {
                        compTuningBox.classList.add('tuning-available');
                        compTuningText.innerText = 'SÍ';
                    } else {
                        compTuningBox.classList.add('tuning-unavailable');
                        compTuningText.innerText = 'NO';
                    }
                }
                break;
            // Abre el nuevo UI del Configurador de Administradores
            case 'openAdminConfigMenu':
                isAdminMenuOpen = true;

                // Ocultamos otros menús por seguridad
                document.getElementById('boss-container').style.display = 'none';
                document.getElementById('showroom-container').style.display = 'none';

                const adminMenu = document.getElementById('admin-config-container');
                if (adminMenu) {
                    adminMenu.style.display = 'flex';
                }

                // Cargamos los datos reales que vienen desde el sv_main.lua -> cl_main.lua
                originalAdminDealersList = data.dealers || [];
                adminDealersWorkingList = [...originalAdminDealersList];
                adminDealersCurrentPage = 1;
                renderAdminDealersTable();
                break;
        }
    });

    // --- TECLA ESC ---
    const closeBossMenu = () => {
        isBossMenuOpen = false;
        document.getElementById('boss-container').style.display = 'none';
        fetch(`https://${GetParentResourceName()}/closeMenu`, { method: 'POST', body: JSON.stringify({}) });
    };

    const closeBuyMenu = () => {
        const buyContainer = document.getElementById('buy-container');
        if (buyContainer) buyContainer.style.display = 'none';

        // Avisar a Lua para liberar cámara y ratón
        fetch(`https://${GetParentResourceName()}/closeMenu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({})
        });
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.keyCode === 27) {

            // PRIORIDAD 0: Cerrar el modal escapable más alto abierto (último en el DOM / overlay más alto)
            const escapableModals = Array.from(document.querySelectorAll('[data-escapable="true"]'));
            let anyModalClosed = false;

            for (const modal of escapableModals.reverse()) {
                if (window.getComputedStyle(modal).display === 'flex') {
                    modal.style.display = 'none';
                    anyModalClosed = true;
                    break; // Solo cerramos uno por pulsación
                }
            }

            // Si hay un modal abierto, salimos aquí (no cerramos nada más)
            if (anyModalClosed) return;

            // PRIORIDAD 1: Si el Menú de Admin está abierto, cerrarlo
            if (isAdminMenuOpen) {
                closeAdminMenu();
                return;
            }

            // PRIORIDAD 2: Si el Showroom está abierto, cerrarlo
            if (isShowroomOpen) {
                closeShowroom(); // Usamos la función de limpieza total
                return;
            }

            // PRIORIDAD 3: Si el Boss Menu está abierto, cerrarlo
            if (isBossMenuOpen) {
                closeBossMenu();
                return;
            }

            // PRIORIDAD 4: Si el Menú de Compra (Dynasty 8) está abierto, cerrarlo
            if (document.getElementById('buy-container').style.display === 'flex') {
                closeBuyMenu();
                return;
            }

            // PRIORIDAD 5: Cerrar el menú de gestión
            closeMenu();
        }
    });

    // --- CARRUSEL (SHOWROOM) ---
    const carousel = document.getElementById('vehicle-carousel');
    const btnPrev = document.getElementById('carousel-prev');
    const btnNext = document.getElementById('carousel-next');

    carousel.addEventListener('scroll', updateCarouselMask);

    // --- NAVEGACIÓN 1: ARRASTRAR VS CLIC (Drag vs Click) ---
    let isDown = false;
    let isDraggingFlag = false; // Nos dirá si estamos arrastrando o haciendo clic
    let startX;
    let scrollLeft;

    carousel.addEventListener('mousedown', (e) => {
        isDown = true;
        isDraggingFlag = false; // Reseteamos al hacer clic
        carousel.style.scrollBehavior = 'auto';
        startX = e.pageX - carousel.offsetLeft;
        scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('mouseleave', () => {
        isDown = false;
        carousel.classList.remove('is-dragging');
        carousel.style.scrollBehavior = 'smooth';
    });

    carousel.addEventListener('mouseup', () => {
        isDown = false;
        carousel.classList.remove('is-dragging');
        carousel.style.scrollBehavior = 'smooth';
    });

    carousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - carousel.offsetLeft;
        const walk = (x - startX);

        // LA MAGIA: Si el ratón se mueve más de 5 píxeles, consideramos que es un "arrastre"
        if (Math.abs(walk) > 5) {
            isDraggingFlag = true;
            carousel.classList.add('is-dragging');
            carousel.scrollLeft = scrollLeft - walk;
        }
    });

    // --- LÓGICA DE SELECCIÓN DE TARJETA ---
    carousel.addEventListener('click', (e) => {
        if (isDraggingFlag) return;

        const card = e.target.closest('.vehicle-card');
        if (!card) return;

        const vehicleModel = card.getAttribute('data-model');

        // Encontramos los datos completos del vehículo
        const fullVehicleData = currentWorkingList.find(v => v.model === vehicleModel) || originalFullList.find(v => v.model === vehicleModel);

        if (fullVehicleData) {
            // Llamamos a nuestra función inteligente (que gestiona base vs comparativa y pinta los colores)
            selectShowroomVehicle(fullVehicleData);
        }
    });

    // --- NAVEGACIÓN 2: BOTONES LATERALES ---
    const getScrollAmount = () => {
        const cardWidth = carousel.querySelector('.vehicle-card').offsetWidth;
        const gap = window.innerWidth * 0.005; // 0.5vw de gap
        return (cardWidth + gap) * 3;
    };

    btnNext.addEventListener('click', () => { carousel.scrollBy({ left: getScrollAmount(), behavior: 'smooth' }); });
    btnPrev.addEventListener('click', () => { carousel.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' }); });

    // --- NAVEGACIÓN 3: FLECHAS DEL TECLADO ---
    const keys = {};
    const scrollSpeed = 16;

    document.addEventListener('keydown', (e) => {
        if (!isShowroomOpen) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            keys[e.key] = true;
            carousel.style.scrollBehavior = 'auto';
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            keys[e.key] = false;
            carousel.style.scrollBehavior = 'smooth';
            if (!carousel.isScrollingContinuously) {
                const cardWidth = carousel.querySelector('.vehicle-card').offsetWidth;
                const gap = window.innerWidth * 0.005;
                const singleScroll = cardWidth + gap;
                if (e.key === 'ArrowRight') carousel.scrollBy({ left: singleScroll, behavior: 'smooth' });
                if (e.key === 'ArrowLeft') carousel.scrollBy({ left: -singleScroll, behavior: 'smooth' });
            }
            carousel.isScrollingContinuously = false;
        }
    });

    function continuousScroll() {
        if (isShowroomOpen) {
            if (keys['ArrowRight']) { carousel.scrollLeft += scrollSpeed; carousel.isScrollingContinuously = true; }
            if (keys['ArrowLeft']) { carousel.scrollLeft -= scrollSpeed; carousel.isScrollingContinuously = true; }
        }
        requestAnimationFrame(continuousScroll);
    }

    continuousScroll();

    document.getElementById('confirm-buy-btn').addEventListener('click', () => {
        fetch(`https://${GetParentResourceName()}/confirmPurchase`, {
            method: 'POST',
            body: JSON.stringify({ dealerId: currentBuyDealer })
        });
        document.getElementById('buy-container').style.display = 'none';
    });

    // Efectos visuales del interruptor de Jefe (Escala de grises)
    document.getElementById('grade-isboss-input')?.addEventListener('change', (e) => {
        const container = document.getElementById('boss-toggle-container');
        const desc = document.getElementById('boss-toggle-desc');
        if (e.target.checked) {
            container.classList.add('active');
            desc.innerText = "¡Este rango controlará la empresa!";
            desc.style.color = "#fff";
        } else {
            container.classList.remove('active');
            desc.innerText = "Máximo 1 jefe por empresa";
            desc.style.color = "#aaa";
        }
    });

    // Botón Guardar Cambios (Ahora incluye permisos)
    document.getElementById('btn-save-grade')?.addEventListener('click', () => {
        const isNew = document.getElementById('grade-is-new-input').value === 'true';
        const level = document.getElementById('grade-level-input').value;
        const name = document.getElementById('grade-name-input').value.trim();
        const payment = document.getElementById('grade-payment-input').value;
        const isboss = document.getElementById('grade-isboss-input').checked;

        // Recopilamos el estado de TODAS las casillas de permisos
        const currentPermissions = {
            admin: document.getElementById('perm-admin').checked,
            funds: document.getElementById('perm-funds').checked,
            reservations: document.getElementById('perm-reservations').checked,
            discounts: document.getElementById('perm-discounts').checked,
            logs: document.getElementById('perm-logs').checked,
            bonus: document.getElementById('perm-bonus').checked,
            prices: document.getElementById('perm-prices').checked,
            fire: document.getElementById('perm-fire').checked,
            manage_staff: document.getElementById('perm-manage_staff').checked,
            hire: document.getElementById('perm-hire').checked
        };

        if (level === '' || name === '' || payment === '') return; // Validación básica

        // Enviamos los datos al Lua (Cliente)
        fetch(`https://${GetParentResourceName()}/saveJobGrade`, {
            method: 'POST',
            body: JSON.stringify({
                isNew: isNew,
                grade: parseInt(level),
                name: name,
                payment: parseInt(payment),
                isboss: isboss,
                permissions: currentPermissions
            })
        });
    });

    // 1. Botón "ELIMINAR RANGO" abre el modal de confirmación
    document.getElementById('btn-delete-grade')?.addEventListener('click', () => {
        const level = document.getElementById('grade-level-input').value;
        const name = document.getElementById('grade-name-input').value;

        if (level === '') return;

        // Actualizamos el texto del modal para que muestre qué rango va a borrar
        document.getElementById('delete-rank-modal-text').innerHTML = `¿Estás seguro de que deseas eliminar el rango <b>${name} (Nivel ${level})</b>?<small style="display:block; margin-top:0.5vw; color:#aaa;">Esta acción es irreversible.</small>`;

        toggleModal('delete-rank-confirm-modal', true);
    });

    // 2. Botón "SÍ, ELIMINAR" dentro del modal envía la orden al servidor
    document.getElementById('confirm-delete-rank-btn')?.addEventListener('click', () => {
        const level = document.getElementById('grade-level-input').value;
        if (level === '') return;

        fetch(`https://${GetParentResourceName()}/deleteJobGrade`, {
            method: 'POST',
            body: JSON.stringify({
                grade: parseInt(level)
            })
        });

        // Cerramos modal y formulario
        toggleModal('delete-rank-confirm-modal', false);
    });

    // --- RENDERS INICIALES ---
    renderSalesTable();
    renderSancTable();
    renderEmpTable();
    renderDiscTable();
    renderBossCatsTable();
    renderShowroomFilters();

    // NAVEGACIÓN HORIZONTAL PARA CATEGORÍAS (SCROLL CON RUEDA)
    const categoriesContainer = document.getElementById('categories-container');
    if (categoriesContainer) {
        categoriesContainer.addEventListener('wheel', (evt) => {
            // Si el usuario mueve la rueda (deltaY), lo aplicamos al scroll horizontal (scrollLeft)
            if (evt.deltaY !== 0) {
                evt.preventDefault();
                categoriesContainer.scrollLeft += evt.deltaY;
            }
        });
    }

    // FILTROS AVANZADOS — DOUBLE RANGE SLIDERS (OPTIMIZADO)
    function initRangeSlider(idMin, idMax, idFill, idBadge, stateObj, formatFn) {
        const elMin = document.getElementById(idMin);
        const elMax = document.getElementById(idMax);
        const elFill = document.getElementById(idFill);
        const badge = document.getElementById(idBadge);
        if (!elMin || !elMax || !elFill || !badge) return;

        // 1. Solo actualiza los colores y el texto al arrastrar (Sin laguear el menú)
        function updateVisuals(e) {
            const rangeMin = parseFloat(elMin.min);
            const rangeMax = parseFloat(elMin.max);
            let valMin = parseFloat(elMin.value);
            let valMax = parseFloat(elMax.value);

            // Evitar cruce de bolitas
            if (valMin > valMax) {
                if (e && e.target === elMin) { elMin.value = valMax; valMin = valMax; }
                else { elMax.value = valMin; valMax = valMin; }
            }

            // Z-index: si están pegados a la derecha, el min debe estar encima para poder cogerlo
            if (valMin === rangeMax) elMin.classList.add('on-top');
            else elMin.classList.remove('on-top');

            // Rellenar la barra blanca
            const pctMin = (valMin - rangeMin) / (rangeMax - rangeMin) * 100;
            const pctMax = (valMax - rangeMin) / (rangeMax - rangeMin) * 100;
            elFill.style.left = pctMin + '%';
            elFill.style.width = (pctMax - pctMin) + '%';

            badge.textContent = formatFn(valMin, valMax);
        }

        // 2. Aplica el filtro REAL a los vehículos (Solo cuando sueltas el ratón)
        function applyFilter() {
            stateObj.min = parseFloat(elMin.value);
            stateObj.max = parseFloat(elMax.value);
            applyShowroomFilter(currentShowroomCategory);
        }

        elMin.addEventListener('input', updateVisuals);
        elMax.addEventListener('input', updateVisuals);

        elMin.addEventListener('change', applyFilter);
        elMax.addEventListener('change', applyFilter);

        updateVisuals(); // Llamada inicial
    }

    // Formateadores de texto para los Badges
    function formatPrice(min, max) {
        const fmt = v => '$' + new Intl.NumberFormat('es-ES').format(Math.round(v / 1000) * 1000);
        return fmt(min) + ' — ' + fmt(max);
    }

    function formatSpeed(min, max) {
        return min + ' — ' + max + ' KM/H';
    }

    function formatSeats(min, max) {
        return min + ' — ' + max + ' Seats';
    }

    // Función para restaurar filtros al pulsar el botón
    function resetAdvancedFilters() {
        const sliders = [
            { idMin: 'filter-price-min', idMax: 'filter-price-max' },
            { idMin: 'filter-speed-min', idMax: 'filter-speed-max' },
            { idMin: 'filter-seats-min', idMax: 'filter-seats-max' },
        ];

        sliders.forEach(({ idMin, idMax }) => {
            const elMin = document.getElementById(idMin);
            const elMax = document.getElementById(idMax);
            if (elMin) elMin.value = elMin.min;
            if (elMax) elMax.value = elMax.max;
        });

        filterPrice = { min: 0, max: 10000000 };
        filterSpeed = { min: 0, max: 250 };
        filterSeats = { min: 1, max: 16 };

        initAdvancedFilters(); // Forzamos recálculo visual
        applyShowroomFilter(currentShowroomCategory); // Refrescamos los coches
    }

    function initAdvancedFilters() {
        initRangeSlider('filter-price-min', 'filter-price-max', 'filter-price-fill', 'filter-price-badge', filterPrice, formatPrice);
        initRangeSlider('filter-speed-min', 'filter-speed-max', 'filter-speed-fill', 'filter-speed-badge', filterSpeed, formatSpeed);
        initRangeSlider('filter-seats-min', 'filter-seats-max', 'filter-seats-fill', 'filter-seats-badge', filterSeats, formatSeats);
    }

    // DISPARADORES INICIALES (AQUÍ ESTÁ LA CORRECCIÓN CLAVE)
    initAdvancedFilters();
    document.getElementById('filter-reset-btn')?.addEventListener('click', resetAdvancedFilters);

    // ANIMACIÓN DE LOS MENÚS DESPLEGABLES (ESTILO HELP)
    const filterTriggers = document.querySelectorAll('.filter-trigger-btn');

    filterTriggers.forEach(btn => {
        btn.addEventListener('click', function (e) {
            // 1. Si hacemos clic DENTRO del panel ya expandido (para mover la barra), no queremos que se cierre
            if (e.target.closest('.help-expanded-content')) {
                // Excepto si hacemos clic en la 'X' de cerrar el panel
                if (e.target.closest('.filter-close')) {
                    this.classList.remove('expanded');
                }
                return; // Cortamos aquí para que el jugador pueda seguir moviendo el slider
            }

            e.stopPropagation(); // Evitamos que el clic se escape al fondo de la pantalla

            // 2. Cerramos cualquier OTRO botón de filtro que estuviera abierto para que no se superpongan
            document.querySelectorAll('.filter-trigger-btn.expanded').forEach(otherBtn => {
                if (otherBtn !== this) {
                    otherBtn.classList.remove('expanded');
                }
            });

            // 3. Abrimos o cerramos este botón (le aplica la clase que lo "hincha" como el de Ayuda)
            this.classList.toggle('expanded');
        });
    });

    // Cerrar los menús al hacer clic en cualquier lugar fuera de ellos (ej: en el suelo del concesionario)
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.filter-trigger-btn')) {
            document.querySelectorAll('.filter-trigger-btn.expanded').forEach(openBtn => {
                openBtn.classList.remove('expanded');
            });
        }
    });

    // =================================================================
    // EVENTOS DEL MENÚ DE ADMINISTRADOR (TABLA Y BUSCADOR)
    // =================================================================

    // Paginación: Anterior
    const btnAdminPrev = document.getElementById('admin-dealers-prev');
    if (btnAdminPrev) {
        btnAdminPrev.addEventListener('click', () => {
            if (adminDealersCurrentPage > 1) {
                adminDealersCurrentPage--;
                renderAdminDealersTable();
            }
        });
    }

    // Paginación: Siguiente
    const btnAdminNext = document.getElementById('admin-dealers-next');
    if (btnAdminNext) {
        btnAdminNext.addEventListener('click', () => {
            const totalPages = Math.ceil(adminDealersWorkingList.length / adminDealersItemsPerPage);
            if (adminDealersCurrentPage < totalPages) {
                adminDealersCurrentPage++;
                renderAdminDealersTable();
            }
        });
    }

    // Buscador en vivo de concesionarios
    const searchAdminDealersInput = document.getElementById('admin-dealers-search');
    if (searchAdminDealersInput) {
        searchAdminDealersInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();

            adminDealersWorkingList = originalAdminDealersList.filter(d =>
                (d.name && d.name.toLowerCase().includes(term)) ||
                (d.id && d.id.toLowerCase().includes(term)) ||
                (d.type && d.type.toLowerCase().includes(term))
            );

            adminDealersCurrentPage = 1; // Resetea a la página 1 al buscar
            renderAdminDealersTable();
        });
    }

    // =================================================================
    // MODAL: CREAR NUEVO CONCESIONARIO (LÓGICA Y DATOS)
    // =================================================================

    let selectedAdminBlip = 225; // Default Coche
    let selectedAdminColor = 0;  // Default Blanco
    let selectedEditBlip = 225;
    let selectedEditColor = 0;
    let editBlipRenderOffset = 0;

    // Lista de los iconos de blips (Ahora con FontAwesome para carga instantánea y estética premium)
    const commonGtaBlips = [
        { id: 1, slug: "level" },
        { id: 4, slug: "wanted_radius" }, { id: 5, slug: "area_blip" }, { id: 6, slug: "centre" }, { id: 7, slug: "north" },
        { id: 8, slug: "waypoint" }, { id: 9, slug: "radius_blip" }, { id: 10, slug: "radius_outline_blip" },
        { id: 16, slug: "police_plane_move" }, { id: 27, slug: "mp_crew" }, { id: 28, slug: "mp_friendlies" }, { id: 36, slug: "cable_car" },
        { id: 37, slug: "activities" }, { id: 38, slug: "raceflag" }, { id: 40, slug: "safehouse" },
        { id: 43, slug: "police_heli" }, { id: 47, slug: "snitch" },
        { id: 50, slug: "crim_carsteal" }, { id: 51, slug: "crim_drugs" }, { id: 52, slug: "crim_holdups" }, { id: 56, slug: "cop_patrol" },
        { id: 57, slug: "cop_player" }, { id: 58, slug: "crim_wanted" }, { id: 59, slug: "heist" }, { id: 60, slug: "police_station" },
        { id: 61, slug: "hospital" }, { id: 64, slug: "helicopter" },
        { id: 66, slug: "random_character" }, { id: 67, slug: "security_van" }, { id: 68, slug: "tow_truck" },
        { id: 71, slug: "barber" }, { id: 72, slug: "car_mod_shop" }, { id: 73, slug: "clothes_store" }, { id: 75, slug: "tattoo" },
        { id: 76, slug: "armenian_family" }, { id: 77, slug: "lester_family" }, { id: 78, slug: "michael_family" },
        { id: 79, slug: "trevor_family" }, { id: 80, slug: "jewelry_heist" }, { id: 84, slug: "rampage" },
        { id: 85, slug: "vinewood_tours" }, { id: 88, slug: "franklin_family" },
        { id: 89, slug: "chinese_strand" }, { id: 90, slug: "flight_school" },
        { id: 93, slug: "bar" }, { id: 94, slug: "base_jump" }, { id: 100, slug: "car_wash" },
        { id: 102, slug: "comedy_club" }, { id: 103, slug: "darts" },
        { id: 106, slug: "fbi_officers_strand" }, { id: 108, slug: "financier_strand" },
        { id: 109, slug: "golf" }, { id: 110, slug: "gun_shop" }, { id: 112, slug: "michael_family_exile" },
        { id: 119, slug: "shooting_range" },
        { id: 120, slug: "solomon_strand" }, { id: 121, slug: "strip_club" }, { id: 122, slug: "tennis" },
        { id: 123, slug: "trevor_family_exile" }, { id: 124, slug: "michael_trevor_family" }, { id: 126, slug: "triathlon" },
        { id: 127, slug: "off_road_racing" }, { id: 134, slug: "crim_cuff_keys" },
        { id: 135, slug: "cinema" }, { id: 136, slug: "music_venue" }, { id: 137, slug: "police_station_blue" },
        { id: 140, slug: "weed_stash" }, { id: 141, slug: "hunting" },
        { id: 147, slug: "arms_dealing" }, { id: 148, slug: "mp_friend" }, { id: 149, slug: "celebrity_theft" },
        { id: 150, slug: "weapon_assault_rifle" }, { id: 151, slug: "weapon_bat" }, { id: 152, slug: "weapon_grenade" },
        { id: 153, slug: "weapon_health" }, { id: 154, slug: "weapon_knife" }, { id: 155, slug: "weapon_molotov" },
        { id: 156, slug: "weapon_pistol" }, { id: 157, slug: "weapon_rocket" }, { id: 158, slug: "weapon_shotgun" },
        { id: 159, slug: "weapon_smg" }, { id: 160, slug: "weapon_sniper" }, { id: 162, slug: "poi" }, { id: 163, slug: "passive" },
        { id: 164, slug: "usingmenu" }, { id: 171, slug: "gang_cops_partner" }, { id: 173, slug: "weapon_minigun" },
        { id: 175, slug: "weapon_armour" }, { id: 176, slug: "property_takeover" }, { id: 184, slug: "camera" },
        { id: 185, slug: "centre_red" }, { id: 186, slug: "handcuff_keys_bikers" }, { id: 187, slug: "handcuff_keys_vagos" },
        { id: 188, slug: "handcuffs_closed_bikers" }, { id: 189, slug: "handcuffs_closed_vagos" }, { id: 197, slug: "yoga" },
        { id: 198, slug: "taxi" }, { id: 205, slug: "shrink" }, { id: 206, slug: "epsilon" }, { id: 207, slug: "financier_strand_grey" },
        { id: 208, slug: "trevor_family_grey" }, { id: 225, slug: "gang_vehicle" }, { id: 226, slug: "gang_vehicle_bikers" },
        { id: 229, slug: "guncar" }, { id: 237, slug: "custody_bikers" }, { id: 251, slug: "arms_dealing_air" },
        { id: 252, slug: "playerstate_arrested" }, { id: 255, slug: "playerstate_keyholder" }, { id: 256, slug: "playerstate_partner" },
        { id: 266, slug: "fairground" },
        { id: 267, slug: "property" }, { id: 268, slug: "gang_highlight" }, { id: 269, slug: "altruist" }, { id: 270, slug: "ai" },
        { id: 271, slug: "on_mission" }, { id: 272, slug: "cash_pickup" }, { id: 273, slug: "chop" }, { id: 274, slug: "dead" },
        { id: 277, slug: "cash_vagos" }, { id: 278, slug: "cash_cops" }, { id: 279, slug: "hooker" }, { id: 280, slug: "friend" },
        { id: 303, slug: "bounty_hit" }, { id: 304, slug: "ugc_mission" }, { id: 305, slug: "horde" },
        { id: 306, slug: "cratedrop" }, { id: 307, slug: "plane_drop" }, { id: 308, slug: "sub" },
        { id: 309, slug: "race" }, { id: 310, slug: "deathmatch" }, { id: 311, slug: "arm_wrestling" },
        { id: 313, slug: "shootingrange_gunshop" }, { id: 314, slug: "race_air" }, { id: 315, slug: "race_land" },
        { id: 316, slug: "race_sea" }, { id: 317, slug: "tow" }, { id: 318, slug: "garbage" }, { id: 326, slug: "getaway_car" },
        { id: 348, slug: "gang_bike" }, { id: 350, slug: "property_for_sale" },
        { id: 351, slug: "gang_attack_package" }, { id: 352, slug: "martin_madrazzo" },
        { id: 354, slug: "boost" }, { id: 355, slug: "devin" }, { id: 356, slug: "dock" }, { id: 357, slug: "garage" },
        { id: 358, slug: "golf_flag" }, { id: 359, slug: "hangar" }, { id: 360, slug: "helipad" }, { id: 361, slug: "jerry_can" },
        { id: 362, slug: "mask" }, { id: 363, slug: "heist_prep" }, { id: 364, slug: "incapacitated" },
        { id: 365, slug: "spawn_point_pickup" }, { id: 366, slug: "boilersuit" }, { id: 367, slug: "completed" },
        { id: 368, slug: "rockets" }, { id: 369, slug: "garage_for_sale" }, { id: 370, slug: "helipad_for_sale" },
        { id: 371, slug: "dock_for_sale" }, { id: 372, slug: "hangar_for_sale" }, { id: 373, slug: "placeholder_6" },
        { id: 374, slug: "business" }, { id: 375, slug: "business_for_sale" }, { id: 376, slug: "race_bike" },
        { id: 377, slug: "parachute" }, { id: 378, slug: "team_deathmatch" }, { id: 379, slug: "race_foot" },
        { id: 380, slug: "vehicle_deathmatch" }, { id: 381, slug: "barry" }, { id: 382, slug: "dom" }, { id: 383, slug: "maryann" },
        { id: 384, slug: "cletus" }, { id: 385, slug: "josh" }, { id: 386, slug: "minute" }, { id: 387, slug: "omega" },
        { id: 388, slug: "tonya" }, { id: 389, slug: "paparazzo" }, { id: 390, slug: "aim" }, { id: 391, slug: "cratedrop_background" },
        { id: 398, slug: "creator" }, { id: 399, slug: "creator_direction" },
        { id: 400, slug: "abigail" }, { id: 401, slug: "blimp" }, { id: 402, slug: "repair" }, { id: 403, slug: "testosterone" },
        { id: 404, slug: "dinghy" }, { id: 405, slug: "fanatic" }, { id: 407, slug: "info_icon" }, { id: 408, slug: "capture_the_flag" },
        { id: 409, slug: "last_team_standing" }, { id: 410, slug: "boat" }, { id: 411, slug: "capture_the_flag_base" },
        { id: 412, slug: "mp_crew" }, { id: 413, slug: "capture_the_flag_outline" }, { id: 414, slug: "capture_the_flag_base_nobag" },
        { id: 415, slug: "weapon_jerrycan" }, { id: 416, slug: "rp" }, { id: 417, slug: "level_inside" },
        { id: 418, slug: "bounty_hit_inside" }, { id: 419, slug: "capture_the_usaflag" }, { id: 420, slug: "capture_the_usaflag_outline" },
        { id: 421, slug: "tank" }, { id: 423, slug: "player_plane" }, { id: 424, slug: "player_jet" },
        { id: 425, slug: "centre_stroke" }, { id: 426, slug: "player_guncar" }, { id: 427, slug: "player_boat" },
        { id: 428, slug: "mp_heist" }, { id: 429, slug: "temp_1" }, { id: 430, slug: "temp_2" }, { id: 431, slug: "temp_3" },
        { id: 432, slug: "temp_4" }, { id: 433, slug: "temp_5" }, { id: 434, slug: "temp_6" }, { id: 435, slug: "race_stunt" },
        { id: 436, slug: "hot_property" }, { id: 437, slug: "urbanwarfare_versus" }, { id: 438, slug: "king_of_the_castle" },
        { id: 439, slug: "player_king" }, { id: 440, slug: "dead_drop" }, { id: 441, slug: "penned_in" }, { id: 442, slug: "beast" },
        { id: 443, slug: "edge_pointer" }, { id: 444, slug: "edge_crosstheline" }, { id: 445, slug: "mp_lamar" },
        { id: 446, slug: "bennys" }, { id: 447, slug: "corner_number_1" }, { id: 448, slug: "corner_number_2" },
        { id: 449, slug: "corner_number_3" }, { id: 450, slug: "corner_number_4" }, { id: 451, slug: "corner_number_5" },
        { id: 452, slug: "corner_number_6" }, { id: 453, slug: "corner_number_7" }, { id: 454, slug: "corner_number_8" },
        { id: 455, slug: "yacht" }, { id: 456, slug: "finders_keepers" }, { id: 457, slug: "assault_package" },
        { id: 458, slug: "hunt_the_boss" }, { id: 459, slug: "sightseer" }, { id: 460, slug: "turreted_limo" },
        { id: 461, slug: "belly_of_the_beast" }, { id: 462, slug: "yacht_location" }, { id: 463, slug: "pickup_beast" },
        { id: 464, slug: "pickup_zoned" }, { id: 465, slug: "pickup_random" }, { id: 466, slug: "pickup_slow_time" },
        { id: 467, slug: "pickup_swap" }, { id: 468, slug: "pickup_thermal" }, { id: 469, slug: "pickup_weed" },
        { id: 470, slug: "weapon_railgun" }, { id: 471, slug: "seashark" }, { id: 472, slug: "pickup_hidden" },
        { id: 473, slug: "warehouse" }, { id: 474, slug: "warehouse_for_sale" }, { id: 475, slug: "office" },
        { id: 476, slug: "office_for_sale" }, { id: 477, slug: "truck" }, { id: 478, slug: "contraband" }, { id: 479, slug: "trailer" },
        { id: 480, slug: "vip" }, { id: 481, slug: "cargobob" }, { id: 482, slug: "area_outline_blip" },
        { id: 483, slug: "pickup_accelerator" }, { id: 484, slug: "pickup_ghost" }, { id: 485, slug: "pickup_detonator" },
        { id: 486, slug: "pickup_bomb" }, { id: 487, slug: "pickup_armoured" }, { id: 488, slug: "stunt" },
        { id: 489, slug: "weapon_lives" }, { id: 490, slug: "stunt_premium" }, { id: 491, slug: "adversary" },
        { id: 492, slug: "biker_clubhouse" }, { id: 493, slug: "biker_caged_in" }, { id: 494, slug: "biker_turf_war" },
        { id: 495, slug: "biker_joust" }, { id: 496, slug: "production_weed" }, { id: 497, slug: "production_crack" },
        { id: 498, slug: "production_fake_id" }, { id: 499, slug: "production_meth" }, { id: 500, slug: "production_money" },
        { id: 501, slug: "package" }, { id: 512, slug: "quad" }, { id: 513, slug: "bus" }, { id: 514, slug: "drugs_package" },
        { id: 521, slug: "laptop" }, { id: 523, slug: "sports_car" }, { id: 524, slug: "warehouse_vehicle" }, { id: 527, slug: "junkyard" },
        { id: 543, slug: "jugg" }, { id: 545, slug: "steeringwheel" }, { id: 546, slug: "trophy" }, { id: 556, slug: "supplies" },
        { id: 557, slug: "property_bunker" }, { id: 568, slug: "sm_cargo" }, { id: 569, slug: "sm_hangar" },
        { id: 641, slug: "arena_series" }, { id: 642, slug: "arena_premium" }, { id: 643, slug: "arena_workshop" }, { id: 670, slug: "ap" },
        { id: 671, slug: "comic_store" }, { id: 672, slug: "cop_car" }, { id: 674, slug: "king_of_the_hill" }, { id: 679, slug: "casino" },
        { id: 680, slug: "casino_table_games" }, { id: 681, slug: "casino_wheel" }, { id: 682, slug: "casino_concierge" },
        { id: 683, slug: "casino_chips" }, { id: 684, slug: "casino_horse_racing" }, { id: 724, slug: "limo" },
        { id: 726, slug: "race_open_wheel" }, { id: 740, slug: "arcade" }, { id: 752, slug: "ufo" }, { id: 777, slug: "car_meet" },
        { id: 779, slug: "auto_shop_property" }, { id: 795, slug: "train" }, { id: 796, slug: "heist_diamond" },
        { id: 797, slug: "heist_doomsday" }, { id: 798, slug: "heist_island" }, { id: 810, slug: "vehicle_for_sale" },
        { id: 813, slug: "security_contract" }, { id: 819, slug: "music_studio" }, { id: 826, slug: "agency" },
        { id: 827, slug: "biker_bar" }, { id: 830, slug: "luxury_car_showroom" }, { id: 831, slug: "car_showroom" },
        { id: 840, slug: "acid_lab" }, { id: 843, slug: "downtown_cab" }, { id: 844, slug: "gun_van" }, { id: 845, slug: "stash_house" },
        { id: 856, slug: "multistorey_garage" }, { id: 859, slug: "bicycle" }, { id: 867, slug: "salvage_yard" },
        { id: 872, slug: "vinewood_garage" }, { id: 876, slug: "race_drag" }, { id: 877, slug: "race_drift" },
        { id: 886, slug: "daily_bounty" }, { id: 887, slug: "bounty_target" }, { id: 900, slug: "garment_factory" },
        { id: 923, slug: "dog" }, { id: 942, slug: "fire_station" }, { id: 943, slug: "fire_truck" }, { id: 954, slug: "cat" },
    ];

    // Lista completa de los colores de GTA V
    const commonGtaColors = [
        { id: 0, hex: "#FFFFFF", name: "White" }, { id: 1, hex: "#E03232", name: "Red" },
        { id: 2, hex: "#71CB71", name: "Green" }, { id: 3, hex: "#5DB6E5", name: "Blue" },
        { id: 4, hex: "#FFFFFF", name: "White" }, { id: 5, hex: "#F0C850", name: "Yellow" },
        { id: 6, hex: "#C25050", name: "Light Red" }, { id: 7, hex: "#9C669F", name: "Violet" },
        { id: 8, hex: "#F28A8A", name: "Pink" }, { id: 9, hex: "#F5A66E", name: "Light Orange" },
        { id: 10, hex: "#B48B69", name: "Light Brown" }, { id: 11, hex: "#8CBF8C", name: "Light Green" },
        { id: 12, hex: "#6EA3C2", name: "Light Blue" }, { id: 13, hex: "#B0B0DA", name: "Light Purple" },
        { id: 14, hex: "#775A96", name: "Dark Purple" }, { id: 15, hex: "#5ECCC9", name: "Cyan" },
        { id: 16, hex: "#D4C98A", name: "Light Yellow" }, { id: 17, hex: "#EB8E2D", name: "Orange" },
        { id: 19, hex: "#CF618C", name: "Dark Pink" }, { id: 20, hex: "#B2A066", name: "Dark Yellow" },
        { id: 21, hex: "#C47A5A", name: "Dark Orange" }, { id: 22, hex: "#A6A6A6", name: "Light Gray" },
        { id: 23, hex: "#E09BA5", name: "Light Pink" }, { id: 24, hex: "#B6D46A", name: "Lemon Green" },
        { id: 25, hex: "#3F7547", name: "Forest Green" }, { id: 26, hex: "#66A3D4", name: "Electric Blue" },
        { id: 27, hex: "#A352CC", name: "Bright Purple" }, { id: 29, hex: "#3B4D87", name: "Dark Blue" },
        { id: 30, hex: "#3E8282", name: "Dark Cyan" }, { id: 36, hex: "#EBE0B0", name: "Beige" },
        { id: 39, hex: "#B5B5B5", name: "Light Gray" }, { id: 40, hex: "#4D4D4D", name: "Dark Gray" },
        { id: 41, hex: "#EB7A8A", name: "Pink Red" }, { id: 46, hex: "#EBEB46", name: "Gold" },
        { id: 48, hex: "#F55A9C", name: "Brilliant Rose" }, { id: 50, hex: "#8A6EBA", name: "Medium Purple" },
        { id: 51, hex: "#EBA896", name: "Salmon" }, { id: 52, hex: "#426E42", name: "Dark Green" },
        { id: 53, hex: "#A0C8DE", name: "Blizzard Blue" }, { id: 54, hex: "#375F7A", name: "Oracle Blue" },
        { id: 55, hex: "#A3A3A3", name: "Silver" }, { id: 56, hex: "#6B4E38", name: "Brown" },
        { id: 58, hex: "#474D70", name: "East Bay" }, { id: 60, hex: "#EBA347", name: "Yellow Orange" },
        { id: 61, hex: "#BD527A", name: "Mulberry Pink" }, { id: 62, hex: "#A8A8A8", name: "Alto Gray" },
        { id: 63, hex: "#2E668F", name: "Jelly Bean Blue" }, { id: 65, hex: "#8C7873", name: "Mamba" },
        { id: 72, hex: "rgba(0, 0, 0, 0.5)", name: "Transparent Black" }, { id: 76, hex: "#8F1F1F", name: "Deep Red" },
        { id: 79, hex: "rgba(224, 50, 50, 0.5)", name: "Transparent Red" }, { id: 80, hex: "rgba(93, 182, 229, 0.5)", name: "Transparent Blue" },
        { id: 83, hex: "#8C24A3", name: "Purple" }
    ];

    const BLIP_PAGE_SIZE = 60;
    let blipRenderOffset = 0;
    const blipImgCache = new Set();

    function renderAdminBlips(reset = false) {
        const blipContainer = document.getElementById('dealer-blip-list');
        if (!blipContainer) return;

        if (reset) {
            blipContainer.innerHTML = '';
            blipRenderOffset = 0;
        }

        const slice = commonGtaBlips.slice(blipRenderOffset, blipRenderOffset + BLIP_PAGE_SIZE);
        if (slice.length === 0) return;

        const fragment = document.createDocumentFragment();

        slice.forEach(blip => {
            const isActive = blip.id === selectedAdminBlip ? 'active' : '';
            const imgUrl = `https://docs.fivem.net/blips/radar_${blip.slug}.png`;

            const div = document.createElement('div');
            div.className = `blip-item ${isActive}`;
            div.dataset.blipId = blip.id;
            div.title = `${blip.id}: ${blip.slug.replace(/_/g, ' ')}`;
            div.onclick = () => selectAdminBlip(blip.id);

            // Imagen con caché
            const img = document.createElement('img');
            img.alt = blip.slug;
            img.style.cssText = 'width:1.25vw;height:1.25vw;object-fit:contain;image-rendering:pixelated;';

            if (blipImgCache.has(imgUrl)) {
                img.src = imgUrl;
            } else {
                img.src = imgUrl;
                img.onload = () => blipImgCache.add(imgUrl);
                img.onerror = () => { img.style.opacity = '0.15'; };
            }

            div.appendChild(img);
            fragment.appendChild(div);
        });

        blipContainer.appendChild(fragment);
        blipRenderOffset += slice.length;

        // Sentinel de scroll infinito
        setupBlipScrollSentinel(blipContainer);
    }

    let _blipSentinel = null;
    function setupBlipScrollSentinel(container) {
        // Solo un sentinel activo a la vez
        if (_blipSentinel) _blipSentinel.disconnect();

        if (blipRenderOffset >= commonGtaBlips.length) return;

        const lastItem = container.lastElementChild;
        if (!lastItem) return;

        _blipSentinel = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                _blipSentinel.disconnect();
                _blipSentinel = null;
                renderAdminBlips(false); // cargar siguiente batch
            }
        }, { root: container, threshold: 0.1 });

        _blipSentinel.observe(lastItem);
    }

    // 2. DIBUJAR LOS COLORES
    function renderAdminColors() {
        const colorContainer = document.getElementById('dealer-color-list');
        if (!colorContainer) return;
        colorContainer.innerHTML = '';

        commonGtaColors.forEach(color => {
            const isActive = color.id === selectedAdminColor ? 'active' : '';
            colorContainer.innerHTML += `
                <div class="color-item ${isActive}" onclick="selectAdminColor(${color.id})">
                    <div class="color-item-inner" style="background-color: ${color.hex};"></div>
                    <span>${color.name}</span>
                </div>
            `;
        });
    }

    window.renderEditBlips = function (reset = false) {
        const container = document.getElementById('edit-dealer-blip-list');
        if (!container) return;

        if (reset) { container.innerHTML = ''; editBlipRenderOffset = 0; }

        const slice = commonGtaBlips.slice(editBlipRenderOffset, editBlipRenderOffset + BLIP_PAGE_SIZE);
        if (slice.length === 0) return;

        const fragment = document.createDocumentFragment();
        slice.forEach(blip => {
            const div = document.createElement('div');
            div.className = `blip-item ${blip.id === selectedEditBlip ? 'active' : ''}`;
            div.dataset.blipId = blip.id;
            div.title = `${blip.id}: ${blip.slug.replace(/_/g, ' ')}`;
            div.onclick = () => {
                selectedEditBlip = blip.id;
                container.querySelectorAll('.blip-item').forEach(el => {
                    el.classList.toggle('active', parseInt(el.dataset.blipId) === blip.id);
                });
            };
            const img = document.createElement('img');
            img.alt = blip.slug;
            img.style.cssText = 'width:1.25vw;height:1.25vw;object-fit:contain;image-rendering:pixelated;';
            img.src = `https://docs.fivem.net/blips/radar_${blip.slug}.png`;
            img.onerror = () => { img.style.opacity = '0.15'; };
            div.appendChild(img);
            fragment.appendChild(div);
        });
        container.appendChild(fragment);
        editBlipRenderOffset += slice.length;

        // Scroll infinito
        if (editBlipRenderOffset < commonGtaBlips.length) {
            const last = container.lastElementChild;
            if (last) {
                const obs = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        obs.disconnect();
                        renderEditBlips(false);
                    }
                }, { root: container, threshold: 0.1 });
                obs.observe(last);
            }
        }
    }

    window.renderEditColors = function () {
        const container = document.getElementById('edit-dealer-color-list');
        if (!container) return;
        container.innerHTML = '';
        commonGtaColors.forEach(color => {
            const div = document.createElement('div');
            div.className = `color-item ${color.id === selectedEditColor ? 'active' : ''}`;
            div.onclick = () => {
                selectedEditColor = color.id;
                container.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
            };
            div.innerHTML = `<div class="color-item-inner" style="background-color:${color.hex};"></div><span>${color.name}</span>`;
            container.appendChild(div);
        });
    }

    // Seleccionar Icono
    window.selectAdminBlip = function (id) {
        selectedAdminBlip = id;
        const container = document.getElementById('dealer-blip-list');
        if (!container) return;
        container.querySelectorAll('.blip-item').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.blipId) === id);
        });
    };

    // Seleccionar Color
    window.selectAdminColor = function (id) {
        selectedAdminColor = id;
        renderAdminColors();
    };

    // 3. EVENTOS DE BOTONES DEL MODAL

    // Abrir modal desde el menú admin
    const btnCreateDealer = document.getElementById('admin-create-btn');
    if (btnCreateDealer) {
        btnCreateDealer.addEventListener('click', () => {
            // Resetear valores
            document.getElementById('input-dealer-name').value = '';
            document.getElementById('input-dealer-job').value = '';
            document.getElementById('input-dealer-x').value = '';
            document.getElementById('input-dealer-y').value = '';
            document.getElementById('input-dealer-z').value = '';
            document.getElementById('input-dealer-scale').value = '0.55';

            // Resetear el nuevo campo ID a su estado automático
            const inputId = document.getElementById('input-dealer-id');
            if (inputId) {
                inputId.value = '';
                inputId.readOnly = true;
                inputId.dataset.manual = 'false';
                inputId.style.opacity = '0.6';
                inputId.style.border = '';
            }

            selectedAdminBlip = 225;
            selectedAdminColor = 0;

            renderAdminBlips(true);
            renderAdminColors();

            // Mostrar Modal
            const modal = document.getElementById('create-dealer-modal');
            modal.style.display = 'flex';
        });
    }

    // LÓGICA DE AUTOGENERACIÓN DEL ID (Nombre -> ID)
    const nameInput = document.getElementById('input-dealer-name');
    const idInput = document.getElementById('input-dealer-id');

    if (nameInput && idInput) {
        // Cuando el usuario escribe el nombre, generamos el ID (si no está en modo manual)
        nameInput.addEventListener('input', (e) => {
            if (idInput.dataset.manual !== 'true') {
                let generatedId = e.target.value.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita acentos
                    .replace(/[^a-z0-9\s_]/g, "") // Quita caracteres raros
                    .replace(/\s+/g, "_"); // Cambia espacios por barra baja

                idInput.value = generatedId;
            }
        });

        // Al hacer clic en el ID, lo "desbloqueamos" para edición manual
        idInput.addEventListener('click', () => {
            if (idInput.readOnly) {
                idInput.readOnly = false;
                idInput.dataset.manual = 'true';
                idInput.style.opacity = '1';
                idInput.style.border = '1px solid #00FA9A'; // Feedback visual de que está desbloqueado
                idInput.focus();
            }
        });

        // Si el usuario borra todo el ID manual, lo volvemos a poner automático
        idInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '') {
                idInput.dataset.manual = 'false';
                idInput.readOnly = true;
                idInput.style.opacity = '0.6';
                idInput.style.border = '';
                // Forzamos al input del nombre a reescribir el ID
                nameInput.dispatchEvent(new Event('input'));
            }
        });
    }

    // Botón: Obtener Coordenadas del Jugador
    const btnGetCoords = document.getElementById('btn-dealer-get-coords');
    if (btnGetCoords) {
        btnGetCoords.addEventListener('click', () => {
            // Le pedimos a Lua las coordenadas actuales del admin
            fetch(`https://${GetParentResourceName()}/adminGetCoords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }).then(resp => resp.json()).then(data => {
                if (data && data.x !== undefined) {
                    document.getElementById('input-dealer-x').value = data.x.toFixed(2);
                    document.getElementById('input-dealer-y').value = data.y.toFixed(2);
                    document.getElementById('input-dealer-z').value = data.z.toFixed(2);
                }
            }).catch(e => console.log('Error obteniendo coordenadas:', e));
        });
    }

    // Botón: Guardar Concesionario Nuevo (AHORA SOLO HAY UNO Y CORTA EL ID DE LA CAJA)
    const btnSaveDealer = document.getElementById('btn-save-dealer');
    if (btnSaveDealer) {
        btnSaveDealer.addEventListener('click', () => {
            const name = document.getElementById('input-dealer-name').value.trim();
            const job = document.getElementById('input-dealer-job').value.trim();
            const customId = idInput ? idInput.value.trim() : ''; // Cogemos el ID real
            const x = parseFloat(document.getElementById('input-dealer-x').value);
            const y = parseFloat(document.getElementById('input-dealer-y').value);
            const z = parseFloat(document.getElementById('input-dealer-z').value);
            const scale = parseFloat(document.getElementById('input-dealer-scale').value) || 0.55;

            // Validación simple
            if (!name) return alert("Por favor, introduce un nombre.");
            if (!job) return alert("Por favor, introduce el job del concesionario.");
            if (!customId) return alert("El concesionario necesita un ID válido.");
            if (isNaN(x) || isNaN(y) || isNaN(z)) return alert("Por favor, rellena las coordenadas o usa el botón de ubicación.");

            const newDealerData = {
                id: customId.toLowerCase(),
                name: name,
                job: job.toLowerCase(),
                coords: { x: x, y: y, z: z },
                blip: selectedAdminBlip,
                color: selectedAdminColor,
                scale: scale
            };

            // Enviar al cliente para procesar la base de datos
            fetch(`https://${GetParentResourceName()}/adminSaveNewDealer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDealerData)
            });

            // Cerrar el modal
            document.getElementById('create-dealer-modal').style.display = 'none';
        });
    }

    // Botón: Obtener coordenadas (edit modal)
    document.getElementById('btn-edit-dealer-get-coords')?.addEventListener('click', () => {
        fetch(`https://${GetParentResourceName()}/adminGetCoords`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
        }).then(r => r.json()).then(data => {
            if (data?.x !== undefined) {
                document.getElementById('edit-dealer-x').value = data.x.toFixed(2);
                document.getElementById('edit-dealer-y').value = data.y.toFixed(2);
                document.getElementById('edit-dealer-z').value = data.z.toFixed(2);
            }
        });
    });

    // Botón: Guardar cambios del concesionario editado
    document.getElementById('btn-update-dealer')?.addEventListener('click', () => {
        const id = document.getElementById('edit-dealer-id').value.trim();
        const name = document.getElementById('edit-dealer-name').value.trim();
        const job = document.getElementById('edit-dealer-job').value.trim();
        const x = parseFloat(document.getElementById('edit-dealer-x').value);
        const y = parseFloat(document.getElementById('edit-dealer-y').value);
        const z = parseFloat(document.getElementById('edit-dealer-z').value);
        const scale = parseFloat(document.getElementById('edit-dealer-scale').value) || 0.55;

        if (!name) return alert('Introduce un nombre.');
        if (!job) return alert('Introduce el job del concesionario.');
        if (isNaN(x) || isNaN(y) || isNaN(z)) return alert('Rellena las coordenadas.');

        fetch(`https://${GetParentResourceName()}/adminUpdateDealer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id, name, job: job.toLowerCase(),
                blip: selectedEditBlip,
                color: selectedEditColor,
                coords: { x, y, z },
                scale
            })
        });

        document.getElementById('edit-dealer-modal').style.display = 'none';
    });

    // =================================================================
    // DRAG TO PAN: MAPA INTERACTIVO (ADMIN)
    // =================================================================
    const mapContainer = document.getElementById('admin-map-container');
    if (mapContainer) {
        let isDraggingMap = false;
        let mapStartX, mapStartY, mapScrollLeft, mapScrollTop;

        mapContainer.addEventListener('mousedown', (e) => {
            isDraggingMap = true;
            mapContainer.style.cursor = 'grabbing'; // Cambia el cursor a "mano cerrada"
            mapStartX = e.pageX - mapContainer.offsetLeft;
            mapStartY = e.pageY - mapContainer.offsetTop;
            mapScrollLeft = mapContainer.scrollLeft;
            mapScrollTop = mapContainer.scrollTop;
        });

        mapContainer.addEventListener('mouseleave', () => {
            isDraggingMap = false;
            mapContainer.style.cursor = 'grab';
        });

        mapContainer.addEventListener('mouseup', () => {
            isDraggingMap = false;
            mapContainer.style.cursor = 'grab';
        });

        mapContainer.addEventListener('mousemove', (e) => {
            if (!isDraggingMap) return;
            e.preventDefault(); // Evita que se seleccione texto o imágenes por accidente

            const x = e.pageX - mapContainer.offsetLeft;
            const y = e.pageY - mapContainer.offsetTop;

            // Multiplicador 1.5 para que el movimiento sea un poco más rápido y natural
            const walkX = (x - mapStartX) * 1.5;
            const walkY = (y - mapStartY) * 1.5;

            mapContainer.scrollLeft = mapScrollLeft - walkX;
            mapContainer.scrollTop = mapScrollTop - walkY;
        });
    }

    // =================================================================
    // ACCIÓN DE LOS BOTONES DE ZOOM (+ / -) INDEPENDIENTES
    // =================================================================
    const zoomInBtn = document.getElementById('admin-map-zoom-in');
    const zoomOutBtn = document.getElementById('admin-map-zoom-out');
    const mapScrollContent = document.getElementById('admin-map-scroll-content');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita arrastrar el mapa al hacer clic
            if (currentMapZoomPercent < 450) { // Límite máximo de zoom (450%)
                currentMapZoomPercent += 40;
                if (mapScrollContent) mapScrollContent.style.width = `${currentMapZoomPercent}%`;
            }
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentMapZoomPercent > 120) { // Límite mínimo de zoom (120%)
                currentMapZoomPercent -= 40;
                if (mapScrollContent) mapScrollContent.style.width = `${currentMapZoomPercent}%`;
            }
        });
    }

    // =================================================================
    // LÓGICA DE IMPORTACIÓN Y EXPORTACIÓN (JSON)
    // =================================================================
    let currentIEMode = 'export'; // Estado global del modal ('export' o 'import')

    // 1. ABRIR MODAL: EXPORTAR (Desde un botón de la tabla)
    window.exportAdminDealer = function (dealerId) {
        const dealer = adminDealersWorkingList.find(d => d.id === dealerId);
        if (!dealer) return;

        currentIEMode = 'export';

        // Adaptar textos e iconos para EXPORTAR
        document.getElementById('ie-header-icon').className = 'fa-solid fa-file-export';
        document.getElementById('ie-header-title').innerText = 'EXPORTAR CONCESIONARIO';
        document.getElementById('ie-header-desc').innerText = 'Visualiza o copia los datos en bruto del concesionario en formato JSON.';

        document.getElementById('ie-panel-icon').className = 'fa-solid fa-file-code ie-animate-icon';
        document.getElementById('ie-panel-title').innerText = 'DATOS EN BRUTO';
        document.getElementById('ie-panel-title').style.color = 'white';
        document.getElementById('ie-panel-text').innerText = 'Guarda este código de forma segura para no perder la configuración de este concesionario o pasárselo a otro servidor.';
        document.getElementById('ie-panel-text').style.color = 'grey';

        const actionBtn = document.getElementById('btn-ie-action');
        document.getElementById('ie-btn-icon').className = 'fa-solid fa-copy';
        document.getElementById('ie-btn-text').innerText = 'COPIAR AL PORTAPAPELES';
        actionBtn.style.opacity = '1';
        actionBtn.style.pointerEvents = 'auto';

        // Rellenar textarea y bloquearlo
        const textarea = document.getElementById('ie-textarea');
        textarea.value = JSON.stringify(dealer, null, 4); // El '4' formatea el JSON bonito
        textarea.readOnly = true;
        textarea.className = 'modal-input disc-input'; // Reset de estilos

        document.getElementById('ie-status-badge').style.display = 'none';

        // Abrir Modal
        document.getElementById('import-export-modal').style.display = 'flex';
    };

    // 2. ABRIR MODAL: IMPORTAR (Desde el botón general de arriba)
    const btnImportDealer = document.getElementById('admin-import-btn');
    if (btnImportDealer) {
        btnImportDealer.addEventListener('click', () => {
            currentIEMode = 'import';

            // Adaptar textos e iconos para IMPORTAR
            document.getElementById('ie-header-icon').className = 'fa-solid fa-file-import';
            document.getElementById('ie-header-title').innerText = 'IMPORTAR CONCESIONARIO';
            document.getElementById('ie-header-desc').innerText = 'Pega el código JSON con la configuración de un concesionario para instalarlo.';

            document.getElementById('ie-panel-icon').className = 'fa-solid fa-file-import ie-animate-icon';
            document.getElementById('ie-panel-title').innerText = 'PEGAR CÓDIGO';
            document.getElementById('ie-panel-title').style.color = 'white';
            document.getElementById('ie-panel-text').innerText = 'Asegúrate de que el código pegado sea un JSON válido. El sistema comprobará la sintaxis automáticamente.';
            document.getElementById('ie-panel-text').style.color = 'grey';

            const actionBtn = document.getElementById('btn-ie-action');
            document.getElementById('ie-btn-icon').className = 'fa-solid fa-floppy-disk';
            document.getElementById('ie-btn-text').innerText = 'GUARDAR CONCESIONARIO';
            actionBtn.style.opacity = '0.5'; // Desactivado por defecto hasta que pegue algo válido
            actionBtn.style.pointerEvents = 'none';

            // Vaciar textarea y desbloquearlo
            const textarea = document.getElementById('ie-textarea');
            textarea.value = '';
            textarea.readOnly = false;
            textarea.className = 'modal-input disc-input'; // Reset de estilos

            document.getElementById('ie-status-badge').style.display = 'none';

            // Abrir Modal
            document.getElementById('import-export-modal').style.display = 'flex';
        });
    }

    // 3. DETECTOR EN TIEMPO REAL: Valida el JSON mientras escribes/pegas
    const ieTextarea = document.getElementById('ie-textarea');
    const ieBadge = document.getElementById('ie-status-badge');
    const ieActionBtn = document.getElementById('btn-ie-action');

    if (ieTextarea) {
        ieTextarea.addEventListener('input', () => {
            if (currentIEMode === 'import') {
                const val = ieTextarea.value.trim();

                if (val === '') {
                    ieTextarea.className = 'modal-input disc-input';
                    ieBadge.style.display = 'none';
                    ieActionBtn.style.opacity = '0.5';
                    ieActionBtn.style.pointerEvents = 'none';
                    return;
                }

                try {
                    JSON.parse(val);
                    // Si llegamos aquí, el JSON es VÁLIDO
                    ieTextarea.className = 'modal-input disc-input ie-valid-json';
                    ieBadge.style.display = 'block';
                    ieBadge.innerText = 'SINTAXIS VÁLIDA';
                    ieBadge.style.color = '#00FA9A';
                    ieBadge.style.borderColor = 'rgba(0, 250, 154, 0.5)';
                    ieBadge.style.background = 'rgba(0, 250, 154, 0.15)';

                    ieActionBtn.style.opacity = '1';
                    ieActionBtn.style.pointerEvents = 'auto';
                } catch (e) {
                    // Si da error, el JSON está ROTO
                    ieTextarea.className = 'modal-input disc-input ie-invalid-json';
                    ieBadge.style.display = 'block';
                    ieBadge.innerText = 'ERROR DE SINTAXIS';
                    ieBadge.style.color = '#ff4747';
                    ieBadge.style.borderColor = 'rgba(255, 71, 71, 0.5)';
                    ieBadge.style.background = 'rgba(255, 71, 71, 0.15)';

                    ieActionBtn.style.opacity = '0.5';
                    ieActionBtn.style.pointerEvents = 'none';
                }
            }
        });
    }

    // 4. ACCIÓN FINAL DEL BOTÓN INFERIOR (Copia o Guarda)
    if (ieActionBtn) {
        ieActionBtn.addEventListener('click', () => {
            if (currentIEMode === 'export') {
                // Acción: COPIAR
                ieTextarea.select();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(ieTextarea.value);
                } else {
                    document.execCommand("copy"); // Fallback
                }

                // Efecto visual de que se ha copiado correctamente
                const originalText = document.getElementById('ie-btn-text').innerText;
                document.getElementById('ie-btn-icon').className = 'fa-solid fa-check';
                document.getElementById('ie-btn-text').innerText = '¡COPIADO!';
                ieActionBtn.style.background = '#00FA9A';
                ieActionBtn.style.color = '#000';

                setTimeout(() => {
                    document.getElementById('ie-btn-icon').className = 'fa-solid fa-copy';
                    document.getElementById('ie-btn-text').innerText = originalText;
                    ieActionBtn.style.background = '';
                    ieActionBtn.style.color = '';
                }, 2000);

            } else if (currentIEMode === 'import') {
                // Acción: GUARDAR / ENVIAR AL LUA
                try {
                    const parsedData = JSON.parse(ieTextarea.value.trim());

                    // Enviar objeto al Cliente
                    fetch(`https://${GetParentResourceName()}/adminImportDealer`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(parsedData)
                    });

                    document.getElementById('import-export-modal').style.display = 'none';
                } catch (e) {
                    console.error("Error al enviar el JSON de importación al servidor", e);
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUNCIONES DE DEALERS - OPCIONES DE CONFIGURACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    window.currentConfigDealerId = null;
    window.currentShowroomPointIndex = null;
    let currentShowpointType = 'npc'; // npc, prop, marker

    const getDealerConfig = (dealerId) => {
        return adminDealersWorkingList.find(d => d.id === dealerId) || null;
    };

    const normalizeShowroomPoints = (dealer) => {
        if (!dealer || !dealer.config) return [];
        if (Array.isArray(dealer.config.showroomPoints)) {
            return dealer.config.showroomPoints;
        }
        return [];
    };

    // 1. Lógica dinámica de los botones (Marker, Prop, NPC)
    const selectShowpointType = (type) => {
        currentShowpointType = type;
        const btnTypeMarker = document.getElementById('btn-showpoint-type-marker');
        const btnTypeProp = document.getElementById('btn-showpoint-type-prop');
        const btnTypeNpc = document.getElementById('btn-showpoint-type-npc');
        const contMarker = document.getElementById('showpoint-container-marker');
        const contProp = document.getElementById('showpoint-container-prop');
        const contNpc = document.getElementById('showpoint-container-npc');

        if (btnTypeMarker) btnTypeMarker.classList.remove('active');
        if (btnTypeProp) btnTypeProp.classList.remove('active');
        if (btnTypeNpc) btnTypeNpc.classList.remove('active');

        if (contMarker) contMarker.style.display = 'none';
        if (contProp) contProp.style.display = 'none';
        if (contNpc) contNpc.style.display = 'none';

        if (type === 'marker') {
            if (btnTypeMarker) btnTypeMarker.classList.add('active');
            if (contMarker) contMarker.style.display = 'flex';
        } else if (type === 'prop') {
            if (btnTypeProp) btnTypeProp.classList.add('active');
            if (contProp) contProp.style.display = 'flex';
        } else if (type === 'npc') {
            if (btnTypeNpc) btnTypeNpc.classList.add('active');
            if (contNpc) contNpc.style.display = 'flex';
        }
    };

    // Asignar listeners a los 3 botones superiores
    document.getElementById('btn-showpoint-type-marker')?.addEventListener('click', (e) => { e.preventDefault(); selectShowpointType('marker'); });
    document.getElementById('btn-showpoint-type-prop')?.addEventListener('click', (e) => { e.preventDefault(); selectShowpointType('prop'); });
    document.getElementById('btn-showpoint-type-npc')?.addEventListener('click', (e) => { e.preventDefault(); selectShowpointType('npc'); });


    const closeShowroomPointModal = () => {
        const modal = document.getElementById('dealer-showpoint-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        window.currentShowroomPointIndex = null;
    };

    const openShowroomPointModal = (dealerId, pointIndex) => {
        const dealer = getDealerConfig(dealerId);
        if (!dealer) return;

        window.currentConfigDealerId = dealerId;
        window.currentShowroomPointIndex = pointIndex;

        const points = normalizeShowroomPoints(dealer);
        const point = (pointIndex !== null && pointIndex >= 0 && pointIndex < points.length) ? points[pointIndex] : null;

        document.getElementById('showpoint-modal-title').innerText = point ? `EDITAR PUNTO ${pointIndex + 1}` : `NUEVO PUNTO DE SHOWROOM`;
        document.getElementById('showpoint-modal-desc').innerText = point ? `Modifica la ubicación y propiedades.` : `Define el punto y elige qué tipo de entidad se mostrará.`;

        // Resetear Campos Base (NUEVO INPUT INCLUIDO)
        document.getElementById('input-showpoint-label').value = '';
        document.getElementById('input-showpoint-x').value = '';
        document.getElementById('input-showpoint-y').value = '';
        document.getElementById('input-showpoint-z').value = '';
        document.getElementById('input-showpoint-h').value = '';

        // Resetear Prop y NPC
        document.getElementById('input-showpoint-prop-model').value = '';
        document.getElementById('input-showpoint-npc-model').value = '';
        document.getElementById('input-showpoint-npc-scenario').value = '';

        // Resetear Marker
        document.getElementById('input-marker-type').value = '1';
        document.getElementById('input-marker-sx').value = '1.5';
        document.getElementById('input-marker-sy').value = '1.5';
        document.getElementById('input-marker-sz').value = '0.5';
        document.getElementById('input-marker-dx').value = '0.0';
        document.getElementById('input-marker-dy').value = '0.0';
        document.getElementById('input-marker-dz').value = '0.0';
        document.getElementById('input-marker-r').value = '255';
        document.getElementById('input-marker-g').value = '255';
        document.getElementById('input-marker-b').value = '255';
        document.getElementById('input-marker-a').value = '150';
        document.getElementById('input-marker-rx').value = '0.0';
        document.getElementById('input-marker-ry').value = '0.0';
        document.getElementById('input-marker-rz').value = '0.0';
        document.getElementById('input-marker-tdict').value = '';
        document.getElementById('input-marker-tname').value = '';
        document.getElementById('input-marker-bob').checked = false;
        document.getElementById('input-marker-face').checked = false;
        document.getElementById('input-marker-rotate').checked = false;
        document.getElementById('input-marker-drawents').checked = false;

        // Rellenar si estamos EDITANDO
        if (point) {
            // Cargar el texto personalizado si lo tiene
            document.getElementById('input-showpoint-label').value = point.label || '';

            if (point.coords_npc) {
                document.getElementById('input-showpoint-x').value = point.coords_npc.x ?? '';
                document.getElementById('input-showpoint-y').value = point.coords_npc.y ?? '';
                document.getElementById('input-showpoint-z').value = point.coords_npc.z ?? '';
                document.getElementById('input-showpoint-h').value = point.coords_npc.h ?? '';
            }

            const pType = point.type || 'npc';
            selectShowpointType(pType);

            if (pType === 'npc') {
                document.getElementById('input-showpoint-npc-model').value = point.npc_model || '';
                document.getElementById('input-showpoint-npc-scenario').value = point.npc_scenario || '';
            } else if (pType === 'prop') {
                document.getElementById('input-showpoint-prop-model').value = point.prop_model || '';
            } else if (pType === 'marker' && point.marker) {
                document.getElementById('input-marker-type').value = point.marker.type ?? '1';
                document.getElementById('input-marker-sx').value = point.marker.scale?.x ?? '1.5';
                document.getElementById('input-marker-sy').value = point.marker.scale?.y ?? '1.5';
                document.getElementById('input-marker-sz').value = point.marker.scale?.z ?? '0.5';
                document.getElementById('input-marker-dx').value = point.marker.dir?.x ?? '0.0';
                document.getElementById('input-marker-dy').value = point.marker.dir?.y ?? '0.0';
                document.getElementById('input-marker-dz').value = point.marker.dir?.z ?? '0.0';
                document.getElementById('input-marker-r').value = point.marker.color?.r ?? '255';
                document.getElementById('input-marker-g').value = point.marker.color?.g ?? '255';
                document.getElementById('input-marker-b').value = point.marker.color?.b ?? '255';
                document.getElementById('input-marker-a').value = point.marker.color?.a ?? '150';
                document.getElementById('input-marker-rx').value = point.marker.rot?.x ?? '0.0';
                document.getElementById('input-marker-ry').value = point.marker.rot?.y ?? '0.0';
                document.getElementById('input-marker-rz').value = point.marker.rot?.z ?? '0.0';
                document.getElementById('input-marker-tdict').value = point.marker.textureDict || '';
                document.getElementById('input-marker-tname').value = point.marker.textureName || '';
                document.getElementById('input-marker-bob').checked = point.marker.bob || false;
                document.getElementById('input-marker-face').checked = point.marker.faceCamera || false;
                document.getElementById('input-marker-rotate').checked = point.marker.rotate || false;
                document.getElementById('input-marker-drawents').checked = point.marker.drawOnEnts || false;
            }
        } else {
            selectShowpointType('npc');
        }

        const modal = document.getElementById('dealer-showpoint-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    const renderDealerShowroomPoints = () => {
        const container = document.getElementById('dealer-showroom-list');
        if (!container) return;

        const dealer = getDealerConfig(window.currentConfigDealerId);
        if (!dealer) {
            container.innerHTML = '<div class="dealer-showroom-placeholder" style="padding:1vw; border:1px dashed rgba(255,255,255,0.12); border-radius:8px; color:rgba(255,255,255,0.35); font-style:italic;">Selecciona un concesionario para ver sus puntos.</div>';
            return;
        }

        const points = normalizeShowroomPoints(dealer);
        container.innerHTML = '';

        if (points.length === 0) {
            const emptyBlock = document.createElement('div');
            emptyBlock.className = 'dealer-showroom-placeholder';
            emptyBlock.style.cssText = 'padding:1vw; border:1px dashed rgba(255,255,255,0.12); border-radius:8px; color:rgba(255,255,255,0.35); font-style:italic;';
            emptyBlock.innerText = 'No hay puntos de SHOWROOM configurados todavía.';
            container.appendChild(emptyBlock);
        }

        points.forEach((point, index) => {
            const block = document.createElement('div');
            block.className = 'showroom-point-card';

            const cx = point.coords_npc?.x ?? '--';
            const cy = point.coords_npc?.y ?? '--';
            const cz = point.coords_npc?.z ?? '--';

            const pType = point.type || 'npc';
            let detailHtml = '';
            let typeBadge = '';

            // Añadimos indicador del texto personalizado si existe
            const customLabelHtml = point.label ? `<span style="font-size: 0.6vw; color: #f39c12; margin-left: 0.5vw;"><i class="fa-solid fa-font"></i> "${point.label}"</span>` : '';

            if (pType === 'npc') {
                typeBadge = 'NPC';
                detailHtml = `<div class="showroom-point-card-subtitle">Modelo: ${point.npc_model || 'Sin modelo'}</div>
                              <div class="showroom-point-card-subtitle">Animación: ${point.npc_scenario || 'Sin animación'}</div>`;
            } else if (pType === 'prop') {
                typeBadge = 'OBJETO';
                detailHtml = `<div class="showroom-point-card-subtitle">Objeto: ${point.prop_model || 'Desconocido'}</div>`;
            } else if (pType === 'marker') {
                typeBadge = 'MARCADOR';
                detailHtml = `<div class="showroom-point-card-subtitle">Tipo: ${point.marker?.type || 1} | Color: ${point.marker?.color?.r},${point.marker?.color?.g},${point.marker?.color?.b}</div>`;
            }

            block.innerHTML = `
                <div class="showroom-point-card-left">
                    <div class="showroom-point-card-title">Punto ${index + 1} ${customLabelHtml}</div>
                    ${detailHtml}
                    <div class="showroom-point-card-coords">
                        <span class="showroom-point-type-badge">${typeBadge}</span>
                        <span class="showroom-point-card-coords-text">X: ${cx} | Y: ${cy} | Z: ${cz}</span>
                    </div>
                </div>
                <div class="showroom-point-card-actions">
                    <button class="btn-icon" title="Editar punto" id="edit-pt-${index}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon btn-danger" title="Eliminar punto" id="del-pt-${index}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            block.querySelector(`#edit-pt-${index}`).addEventListener('click', () => {
                openShowroomPointModal(window.currentConfigDealerId, index);
            });

            block.querySelector(`#del-pt-${index}`).addEventListener('click', () => {
                customConfirm(`¿Eliminar el punto ${index + 1} del showroom?`, "ELIMINAR PUNTO").then((confirmed) => {
                    if (confirmed) {
                        const pointsList = normalizeShowroomPoints(dealer);
                        pointsList.splice(index, 1);
                        dealer.config.showroomPoints = pointsList;
                        fetch(`https://${GetParentResourceName()}/adminUpdateDealer`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: dealer.id, showroomPoints: pointsList })
                        }).then(() => renderDealerShowroomPoints()).catch(() => renderDealerShowroomPoints());
                    }
                });
            });

            container.appendChild(block);
        });

        const addButton = document.getElementById('btn-add-showroom-point');
        if (addButton) {
            addButton.style.display = points.length < 5 ? 'inline-flex' : 'none';
            addButton.innerText = '+';
            addButton.title = points.length < 5 ? 'Agregar punto de SHOWROOM' : 'Máximo 5 puntos alcanzado';
        }
    };

    const saveShowroomPoint = () => {
        const dealerId = window.currentConfigDealerId;
        if (!dealerId) return;

        const x = parseFloat(document.getElementById('input-showpoint-x').value);
        const y = parseFloat(document.getElementById('input-showpoint-y').value);
        const z = parseFloat(document.getElementById('input-showpoint-z').value);
        const h = parseFloat(document.getElementById('input-showpoint-h').value);

        // CAPTURAR EL TEXTO DEL TEXTUI
        const customLabel = document.getElementById('input-showpoint-label').value.trim();

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            return alert('Las coordenadas X, Y, Z son obligatorias.');
        }

        const dealer = getDealerConfig(dealerId);
        if (!dealer) return;

        // Construir la base del punto, AÑADIENDO EL LABEL
        const pt = {
            type: currentShowpointType,
            label: customLabel !== "" ? customLabel : null,
            coords_npc: { x, y, z, h: isNaN(h) ? 0 : h }
        };

        // Empaquetar datos según el tipo
        if (currentShowpointType === 'npc') {
            const npcModel = document.getElementById('input-showpoint-npc-model').value.trim();
            if (!npcModel) { alert('El modelo del NPC es obligatorio.'); return; }
            pt.npc_model = npcModel;
            pt.npc_scenario = document.getElementById('input-showpoint-npc-scenario').value.trim();

        } else if (currentShowpointType === 'prop') {
            const propModel = document.getElementById('input-showpoint-prop-model').value.trim();
            if (!propModel) { alert('El modelo del OBJETO es obligatorio.'); return; }
            pt.prop_model = propModel;

        } else if (currentShowpointType === 'marker') {
            pt.marker = {
                type: parseInt(document.getElementById('input-marker-type').value) || 1,
                scale: {
                    x: parseFloat(document.getElementById('input-marker-sx').value) || 1.5,
                    y: parseFloat(document.getElementById('input-marker-sy').value) || 1.5,
                    z: parseFloat(document.getElementById('input-marker-sz').value) || 0.5
                },
                dir: {
                    x: parseFloat(document.getElementById('input-marker-dx').value) || 0.0,
                    y: parseFloat(document.getElementById('input-marker-dy').value) || 0.0,
                    z: parseFloat(document.getElementById('input-marker-dz').value) || 0.0
                },
                color: {
                    r: parseInt(document.getElementById('input-marker-r').value) || 255,
                    g: parseInt(document.getElementById('input-marker-g').value) || 255,
                    b: parseInt(document.getElementById('input-marker-b').value) || 255,
                    a: parseInt(document.getElementById('input-marker-a').value) || 150
                },
                rot: {
                    x: parseFloat(document.getElementById('input-marker-rx').value) || 0.0,
                    y: parseFloat(document.getElementById('input-marker-ry').value) || 0.0,
                    z: parseFloat(document.getElementById('input-marker-rz').value) || 0.0
                },
                textureDict: document.getElementById('input-marker-tdict').value.trim(),
                textureName: document.getElementById('input-marker-tname').value.trim(),
                bob: document.getElementById('input-marker-bob').checked,
                faceCamera: document.getElementById('input-marker-face').checked,
                rotate: document.getElementById('input-marker-rotate').checked,
                drawOnEnts: document.getElementById('input-marker-drawents').checked
            };
        }

        const points = normalizeShowroomPoints(dealer);

        if (window.currentShowroomPointIndex !== null && window.currentShowroomPointIndex >= 0 && window.currentShowroomPointIndex < points.length) {
            points[window.currentShowroomPointIndex] = pt;
        } else {
            if (points.length >= 5) {
                return alert('Ya has alcanzado el máximo de 5 puntos de showroom.');
            }
            points.push(pt);
        }

        dealer.config = dealer.config || {};
        dealer.config.showroomPoints = points;

        fetch(`https://${GetParentResourceName()}/adminUpdateDealer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: dealerId, showroomPoints: points })
        }).then(() => {
            closeShowroomPointModal();
            renderDealerShowroomPoints();
        }).catch((error) => {
            console.error('Error guardando punto de showroom:', error);
            closeShowroomPointModal();
            renderDealerShowroomPoints();
        });
    };

    const getShowroomCoordsFromServer = () => {
        fetch(`https://${GetParentResourceName()}/adminGetCoords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).then(resp => resp.json()).then(data => {
            if (data && data.x !== undefined) {
                document.getElementById('input-showpoint-x').value = data.x.toFixed(2);
                document.getElementById('input-showpoint-y').value = data.y.toFixed(2);
                document.getElementById('input-showpoint-z').value = data.z.toFixed(2);
                if (data.h !== undefined) {
                    document.getElementById('input-showpoint-h').value = data.h.toFixed(2);
                }
            }
        }).catch(e => console.log('Error obteniendo coordenadas:', e));
    };

    document.getElementById('btn-add-showroom-point')?.addEventListener('click', () => {
        openShowroomPointModal(window.currentConfigDealerId, null);
    });

    document.getElementById('btn-showpoint-get-coords')?.addEventListener('click', (e) => {
        e.preventDefault();
        getShowroomCoordsFromServer();
    });

    document.getElementById('btn-showpoint-cancel')?.addEventListener('click', () => {
        closeShowroomPointModal();
    });

    document.getElementById('btn-showpoint-save')?.addEventListener('click', () => {
        saveShowroomPoint();
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // LÓGICA DE OPCIONES AVANZADAS (MÉTODOS DE PAGO, STOCK Y PUNTO DE VENTA)
    // ═══════════════════════════════════════════════════════════════════════════
    let currentAdvBuyType = 'npc';

    const selectAdvBuyType = (type) => {
        currentAdvBuyType = type;
        const btnMarker = document.getElementById('btn-advbuy-type-marker');
        const btnProp = document.getElementById('btn-advbuy-type-prop');
        const btnNpc = document.getElementById('btn-advbuy-type-npc');

        const contMarker = document.getElementById('advbuy-container-marker');
        const contProp = document.getElementById('advbuy-container-prop');
        const contNpc = document.getElementById('advbuy-container-npc');

        if (btnMarker) btnMarker.classList.remove('active');
        if (btnProp) btnProp.classList.remove('active');
        if (btnNpc) btnNpc.classList.remove('active');

        if (contMarker) contMarker.style.display = 'none';
        if (contProp) contProp.style.display = 'none';
        if (contNpc) contNpc.style.display = 'none';

        if (type === 'marker') {
            if (btnMarker) btnMarker.classList.add('active');
            if (contMarker) contMarker.style.display = 'flex';
        } else if (type === 'prop') {
            if (btnProp) btnProp.classList.add('active');
            if (contProp) contProp.style.display = 'flex';
        } else if (type === 'npc') {
            if (btnNpc) btnNpc.classList.add('active');
            if (contNpc) contNpc.style.display = 'grid'; // Grid por las 2 columnas
        }
    };

    // Listeners del selector de tipos
    document.getElementById('btn-advbuy-type-marker')?.addEventListener('click', (e) => { e.preventDefault(); selectAdvBuyType('marker'); });
    document.getElementById('btn-advbuy-type-prop')?.addEventListener('click', (e) => { e.preventDefault(); selectAdvBuyType('prop'); });
    document.getElementById('btn-advbuy-type-npc')?.addEventListener('click', (e) => { e.preventDefault(); selectAdvBuyType('npc'); });

    // Mostrar/Ocultar la caja de configuración cuando se marca la casilla "Permitir Comprar Empresa"
    document.getElementById('check-advanced-buyable')?.addEventListener('change', (e) => {
        const box = document.getElementById('advanced-buyable-config-box');
        if (box) box.style.display = e.target.checked ? 'flex' : 'none';
    });

    // Obtener Coordenadas para el punto de compra
    document.getElementById('btn-advbuy-get-coords')?.addEventListener('click', (e) => {
        e.preventDefault();
        fetch(`https://${GetParentResourceName()}/adminGetCoords`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
        }).then(resp => resp.json()).then(data => {
            if (data && data.x !== undefined) {
                document.getElementById('input-advbuy-x').value = data.x.toFixed(2);
                document.getElementById('input-advbuy-y').value = data.y.toFixed(2);
                document.getElementById('input-advbuy-z').value = data.z.toFixed(2);
                if (data.h !== undefined) document.getElementById('input-advbuy-h').value = data.h.toFixed(2);
            }
        });
    });

    // Cargar datos al abrir el menú de configuración de un concesionario
    const loadAdvancedOptions = (dealerId) => {
        const dealer = getDealerConfig(dealerId);
        if (!dealer) return;
        const cfg = dealer.config || {};

        // Por defecto asumimos TRUE a menos que esté explícitamente en false en la base de datos
        document.getElementById('check-advanced-cash').checked = cfg.payment_cash !== false;
        document.getElementById('check-advanced-bank').checked = cfg.payment_bank !== false;
        document.getElementById('check-advanced-finance').checked = cfg.payment_finance !== false;
        document.getElementById('check-advanced-stock').checked = cfg.stock_enabled !== false;
        document.getElementById('check-advanced-reservations').checked = cfg.reservations_enabled !== false;
        document.getElementById('check-advanced-management').checked = cfg.management_enabled !== false;

        // El punto de compra si es null, asumimos que no es comprable
        const isBuyable = cfg.npc_buy !== undefined && cfg.npc_buy !== null;
        document.getElementById('check-advanced-buyable').checked = isBuyable;

        const box = document.getElementById('advanced-buyable-config-box');
        if (box) box.style.display = isBuyable ? 'flex' : 'none';

        if (isBuyable) {
            const bp = cfg.npc_buy;
            document.getElementById('input-advbuy-label').value = bp.label || '';
            document.getElementById('input-advbuy-x').value = bp.x || '';
            document.getElementById('input-advbuy-y').value = bp.y || '';
            document.getElementById('input-advbuy-z').value = bp.z || '';
            document.getElementById('input-advbuy-h').value = bp.w || '';

            const bType = bp.type || 'npc';
            selectAdvBuyType(bType);

            if (bType === 'npc') {
                document.getElementById('input-advbuy-npc-model').value = bp.npc_model || '';
                document.getElementById('input-advbuy-npc-scenario').value = bp.npc_scenario || '';
            } else if (bType === 'prop') {
                document.getElementById('input-advbuy-prop-model').value = bp.prop_model || '';
            } else if (bType === 'marker' && bp.marker) {
                document.getElementById('input-advbuy-marker-type').value = bp.marker.type || '2';
                document.getElementById('input-advbuy-marker-sx').value = bp.marker.scale?.x || '0.2';
                document.getElementById('input-advbuy-marker-sy').value = bp.marker.scale?.y || '0.2';
                document.getElementById('input-advbuy-marker-sz').value = bp.marker.scale?.z || '0.2';
                document.getElementById('input-advbuy-marker-r').value = bp.marker.color?.r || '0';
                document.getElementById('input-advbuy-marker-g').value = bp.marker.color?.g || '255';
                document.getElementById('input-advbuy-marker-b').value = bp.marker.color?.b || '0';
                document.getElementById('input-advbuy-marker-a').value = bp.marker.color?.a || '200';
                document.getElementById('input-advbuy-marker-bob').checked = bp.marker.bob !== false;
                document.getElementById('input-advbuy-marker-rotate').checked = bp.marker.rotate !== false;
            }
        } else {
            // Resetear por defecto si no existía
            document.getElementById('input-advbuy-label').value = '';
            document.getElementById('input-advbuy-x').value = '';
            document.getElementById('input-advbuy-y').value = '';
            document.getElementById('input-advbuy-z').value = '';
            document.getElementById('input-advbuy-h').value = '';
            selectAdvBuyType('npc');
        }
    };

    // Guardar Opciones Avanzadas
    const saveAdvancedOptions = () => {
        const dealerId = window.currentConfigDealerId;
        if (!dealerId) return;
        const dealer = getDealerConfig(dealerId);
        if (!dealer) return;

        dealer.config = dealer.config || {};

        // Recogemos todos los checks
        dealer.config.payment_cash = document.getElementById('check-advanced-cash').checked;
        dealer.config.payment_bank = document.getElementById('check-advanced-bank').checked;
        dealer.config.payment_finance = document.getElementById('check-advanced-finance').checked;
        dealer.config.stock_enabled = document.getElementById('check-advanced-stock').checked;
        dealer.config.reservations_enabled = document.getElementById('check-advanced-reservations').checked;
        dealer.config.management_enabled = document.getElementById('check-advanced-management').checked;

        // Recogemos los datos del punto de compra si está habilitado
        const isBuyable = document.getElementById('check-advanced-buyable').checked;

        if (isBuyable) {
            const x = parseFloat(document.getElementById('input-advbuy-x').value);
            const y = parseFloat(document.getElementById('input-advbuy-y').value);
            const z = parseFloat(document.getElementById('input-advbuy-z').value);
            const h = parseFloat(document.getElementById('input-advbuy-h').value);

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                return alert('Si activas la compra de empresa, debes indicar las coordenadas X, Y, Z del punto de venta.');
            }

            let buyPoint = {
                type: currentAdvBuyType,
                label: document.getElementById('input-advbuy-label').value.trim(),
                x: x, y: y, z: z, w: isNaN(h) ? 0 : h
            };

            if (currentAdvBuyType === 'npc') {
                buyPoint.npc_model = document.getElementById('input-advbuy-npc-model').value.trim() || 'a_m_y_business_03';
                buyPoint.npc_scenario = document.getElementById('input-advbuy-npc-scenario').value.trim() || 'WORLD_HUMAN_CLIPBOARD';
            } else if (currentAdvBuyType === 'prop') {
                buyPoint.prop_model = document.getElementById('input-advbuy-prop-model').value.trim();
                if (!buyPoint.prop_model) return alert('Debes indicar el modelo del objeto/cartel.');
            } else if (currentAdvBuyType === 'marker') {
                buyPoint.marker = {
                    type: parseInt(document.getElementById('input-advbuy-marker-type').value) || 2,
                    scale: {
                        x: parseFloat(document.getElementById('input-advbuy-marker-sx').value) || 0.2,
                        y: parseFloat(document.getElementById('input-advbuy-marker-sy').value) || 0.2,
                        z: parseFloat(document.getElementById('input-advbuy-marker-sz').value) || 0.2
                    },
                    color: {
                        r: parseInt(document.getElementById('input-advbuy-marker-r').value) || 0,
                        g: parseInt(document.getElementById('input-advbuy-marker-g').value) || 255,
                        b: parseInt(document.getElementById('input-advbuy-marker-b').value) || 0,
                        a: parseInt(document.getElementById('input-advbuy-marker-a').value) || 200
                    },
                    bob: document.getElementById('input-advbuy-marker-bob').checked,
                    rotate: document.getElementById('input-advbuy-marker-rotate').checked
                };
            }
            // Mantenemos el nombre "npc_buy" para que sea retrocompatible con la BD antigua, pero ahora soporta más tipos.
            dealer.config.npc_buy = buyPoint;
        } else {
            dealer.config.npc_buy = null;
        }

        // Enviamos todo el configObj modificado al servidor
        fetch(`https://${GetParentResourceName()}/adminUpdateDealer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: dealerId,
                config_update_only: true, // Avisamos al Lua que es una actualización directa de JSON
                configData: dealer.config
            })
        }).then(() => {
            alert('Opciones Avanzadas guardadas correctamente.');
        }).catch(() => {
            console.error('Error al guardar opciones avanzadas');
        });
    };

    // Inyectar el botón de Guardar dinámicamente si no existe
    setTimeout(() => {
        const advContainer = document.getElementById('dealer-advanced');
        if (advContainer && !document.getElementById('btn-save-advanced')) {
            advContainer.insertAdjacentHTML('beforeend', `
                <div class="disc-modal-footer" style="display:flex;justify-content: center;">
                    <button id="btn-save-advanced" class="action-btn confirm-btn" style="flex:0.5;">
                        GUARDAR OPCIONES AVANZADAS
                    </button>
                </div>
            `);
            document.getElementById('btn-save-advanced').addEventListener('click', saveAdvancedOptions);
        }
    }, 500);

    function setDealerOptionsPage(page) {
        const pointsTab = document.querySelector('.dealer-options-tab[data-page="points"]');
        const advancedTab = document.querySelector('.dealer-options-tab[data-page="advanced"]');
        const sectionLabel = document.getElementById('dealer-options-section-label');
        const addButton = document.getElementById('btn-add-showroom-point');
        const showroomContainer = document.getElementById('dealer-showroom');
        const advancedContainer = document.getElementById('dealer-advanced');
        const defaultPanel = document.getElementById('dealer-options-default');
        const sectionArea = document.getElementById('dealer-options-section-area');

        if (!pointsTab || !advancedTab || !sectionLabel || !showroomContainer || !advancedContainer || !defaultPanel || !sectionArea) {
            return;
        }

        pointsTab.classList.toggle('active', page === 'points');
        advancedTab.classList.toggle('active', page === 'advanced');
        window.currentDealerOptionsPage = page || null;

        if (page === 'points') {
            defaultPanel.style.display = 'none';
            sectionArea.style.display = 'flex';
            sectionLabel.innerHTML = '<i class="fa-solid fa-list-check"></i> PUNTOS DE VENTA';
            addButton.style.display = 'inline-flex';
            showroomContainer.style.display = 'flex';
            advancedContainer.style.display = 'none';
        } else if (page === 'advanced') {
            defaultPanel.style.display = 'none';
            sectionArea.style.display = 'flex';
            sectionLabel.innerHTML = '<i class="fa-solid fa-list-check"></i> OPCIONES DISPONIBLES';
            addButton.style.display = 'none';
            showroomContainer.style.display = 'none';
            advancedContainer.style.display = 'flex';
        } else {
            defaultPanel.style.display = 'flex';
            sectionArea.style.display = 'none';
            addButton.style.display = 'none';
            showroomContainer.style.display = 'none';
            advancedContainer.style.display = 'none';
        }
    }

    document.querySelectorAll('.dealer-options-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const page = tab.dataset.page;
            if (page) {
                setDealerOptionsPage(page);
            }
        });
    });

    window.configureAdminDealer = function (dealerId) {
        const dealer = adminDealersWorkingList.find(d => d.id === dealerId);
        if (!dealer) {
            console.error(`[configureAdminDealer] Dealer con ID ${dealerId} no encontrado`);
            return;
        }

        // Actualizar los textos dinámicos del modal
        document.getElementById('dealer-options-title').innerText = `OPCIONES DEL CONCESIONARIO`;
        document.getElementById('dealer-options-desc').innerText = `Gestiona la configuración avanzada de ${dealer.name || 'este concesionario'}.`;
        const panelText = document.getElementById('dealer-options-panel-text');
        if (panelText) {
            panelText.innerText = `Ajusta las opciones específicas de ${dealer.name || 'este concesionario'}.`;
        }

        // Guardar el ID actual del dealer siendo configurado (por si lo necesitas luego)
        window.currentConfigDealerId = dealerId;
        closeShowroomPointModal();
        renderDealerShowroomPoints();
        
        // CARGAMOS LOS DATOS DEL PANEL AVANZADO
        loadAdvancedOptions(dealerId);

        // Por defecto no hay sección seleccionada
        window.currentDealerOptionsPage = null;
        setDealerOptionsPage(null);

        // Abrir el modal
        const modal = document.getElementById('dealer-options-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };
}); // <--- RECUERDA: ESTA ES LA LLAVE DE CIERRE FINAL DE TU MÓDULO 16, NO LA BORRES.