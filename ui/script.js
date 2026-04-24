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
let isShowroomOpen = false;     // Controla si el catálogo de clientes está abierto
let isBossMenuOpen = false;     // Controla si el Boss Menu está abierto
let currentBossDealerName = ""; // Guarda el nombre de la empresa para los títulos
let activeJobGrades = [];       // Guardará los rangos del trabajo del jugador para mostrar/ocultar categorías en el Boss Menu
let currentPreviewColor = 0;    // 0 = Negro (Default de GTA)
let currentPreviewVehicle = null;
let currentActiveExtras = null; // Guardará la lista de extras activos
let myPendingReservations = []; // Guarda los modelos que este jugador ya ha reservado

// Variables del Showroom (Carrusel)
let currentShowroomCategory = 'all';
let currentShowroomSearch = '';
let filteredShowroomStock = [];
let showroomLoadedCount = 0;
const SHOWROOM_BATCH_SIZE = 65;

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
let dummyDisc = [
    { code: 'VERANO26', author: 'Alex', vehicles: 'TODOS', perc: 15, uses: 10, expires: 'ILIMITADO' },
    { code: 'VIPZENT', author: 'Paca', vehicles: 'Zentorno', perc: 5, uses: 1, expires: '15-04-2026' },
];
let discWorkingList = [...dummyDisc];
let discCurrentPage = 1;
const discItemsPerPage = 15;

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
    // Si intentan arrastrar una imagen, un enlace o cualquier elemento, lo bloqueamos
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

        return matchCategory && matchSearch;
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
                <span class="empty-state-text" style="color: #888; font-size: 1vw; margin-top: 1vw;">No se encontraron vehículos</span>
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
    currentPreviewVehicle = vehicle.model;
    currentActiveExtras = null;
    const panel = document.getElementById('vehicle-info-panel');
    if (!panel) return;

    // =================================================================
    // OCULTAR PANELES LATERALES AL CAMBIAR DE VEHÍCULO
    // =================================================================
    const paymentPanel = document.getElementById('payment-selection-panel');
    if (paymentPanel) paymentPanel.style.display = 'none';

    const extrasPanel = document.getElementById('extras-selection-panel');
    if (extrasPanel) extrasPanel.style.display = 'none';
    // =================================================================

    // 1. Mostramos el panel si estaba oculto
    panel.style.display = 'flex';

    // 2. Actualizamos los textos
    document.getElementById('info-brand-name').innerText = vehicle.brand || 'CUSTOM';
    document.getElementById('info-model-name').innerText = vehicle.name || vehicle.model;

    const formattedPrice = new Intl.NumberFormat('es-ES').format(vehicle.price || 0);
    document.getElementById('info-vehicle-price').innerText = `$ ${formattedPrice}`;
    document.getElementById('info-vehicle-stock').innerText = vehicle.stock || 0;

    // =================================================================
    // 2.5 LÓGICA DE STOCK Y RESERVAS
    // =================================================================
    const buyBtn = document.getElementById('buy-vehicle');
    const extrasPlateRow = document.getElementById('row-extras-plate');

    // Guardamos los datos completos del vehículo DENTRO del botón
    buyBtn.dataset.model = vehicle.model;
    buyBtn.dataset.price = vehicle.price || 0;
    buyBtn.dataset.brand = vehicle.brand || 'CUSTOM';
    buyBtn.dataset.name = vehicle.name || vehicle.model;

    // Reseteamos estilos por defecto del botón
    buyBtn.disabled = false;
    buyBtn.style.background = '';
    buyBtn.style.color = '';

    if ((vehicle.stock || 0) <= 0) {
        // NO HAY STOCK: Modo Reserva
        if (extrasPlateRow) extrasPlateRow.style.display = 'none';

        // Verificamos si YA lo tiene reservado
        if (myPendingReservations.includes(vehicle.model)) {
            buyBtn.innerText = 'YA RESERVADO';
            buyBtn.dataset.action = 'none';
            buyBtn.disabled = true; // Bloqueamos el botón
            buyBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            buyBtn.style.color = 'rgba(255, 255, 255, 0.3)';
            buyBtn.style.cursor = 'not-allowed';
        } else {
            buyBtn.innerText = '¡RESERVAR AHORA!';
            buyBtn.dataset.action = 'reserve';
            buyBtn.style.cursor = 'pointer';
        }
    } else {
        // SÍ HAY STOCK: Modo Compra normal
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

        // Si este es el color que tenemos seleccionado actualmente, le ponemos la clase
        if (currentPreviewColor === colorData.id) {
            colorDiv.classList.add('selected');
        }

        colorDiv.addEventListener('click', () => {
            // Quitamos la clase 'selected' a todos y se la ponemos al que hemos clickeado
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            colorDiv.classList.add('selected');

            // Guardamos el color en memoria para el próximo coche
            currentPreviewColor = colorData.id;

            // Enviamos el aviso al cliente para pintar el coche en vivo (Sin respawnearlo)
            fetch(`https://${GetParentResourceName()}/updateVehicleColor`, {
                method: 'POST',
                body: JSON.stringify({ color: currentPreviewColor })
            });
        });

        colorGrid.appendChild(colorDiv);
    });

    // 4. Llamamos a la previsualización del vehículo pasándole también el color actual
    fetch(`https://${GetParentResourceName()}/previewVehicle`, {
        method: 'POST',
        body: JSON.stringify({
            model: vehicle.model,
            color: currentPreviewColor
        })
    });
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

    currentPreviewVehicle = null;
}

// =================================================================
// SISTEMA DE EXTRAS Y ALTERNANCIA DE PANELES (COMPRAR VS EXTRAS)
// =================================================================

// 1. ALTERNANCIA: Cuando le damos a "COMPRAR"
const btnBuyShowroom = document.getElementById('buy-vehicle');
if (btnBuyShowroom) {
    btnBuyShowroom.addEventListener('click', () => {
        // OCULTAMOS EL PANEL DE EXTRAS
        const extrasPanel = document.getElementById('extras-selection-panel');
        if (extrasPanel) extrasPanel.style.display = 'none';

        // Mostramos/Ocultamos el de pago
        const paymentPanel = document.getElementById('payment-selection-panel');
        if (paymentPanel) {
            paymentPanel.style.display = paymentPanel.style.display === 'none' ? 'flex' : 'none';
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
// FUNCIÓN DE CIERRE DEL SHOWROOM
// =================================================================
function closeShowroom() {
    isShowroomOpen = false;
    document.getElementById('showroom-container').style.display = 'none';

    // [AQUÍ VA LO QUE PREGUNTABAS]
    hideVehicleInfo();      // Ocultamos el panel de la izquierda
    currentPreviewColor = 0; // Reseteamos el color a Negro para la próxima vez

    // Avisamos al cl_main.lua para que destruya la cámara y el coche
    fetch(`https://${GetParentResourceName()}/closeShowroomMenu`, {
        method: 'POST'
    });
}

// Escuchar la tecla ESCAPE para cerrar
document.onkeyup = function (data) {
    if (data.which == 27) { // 27 es la tecla ESC
        if (isShowroomOpen) {
            closeShowroom();
        }
    }
};

// =================================================================
// EVENTO DE COMPRA / RESERVA DE VEHÍCULO
// =================================================================
const mainBuyBtn = document.getElementById('buy-vehicle');

if (mainBuyBtn) {
    mainBuyBtn.addEventListener('click', function () {
        const action = this.dataset.action;

        // Preparamos el paquete de datos para mandarlo al servidor
        const vehicleData = {
            model: this.dataset.model,
            price: parseInt(this.dataset.price),
            brand: this.dataset.brand,
            name: this.dataset.name,
            color: currentPreviewColor // Mandamos también el color que el jugador haya elegido en la paleta
        };

        if (action === 'buy') {
            // LÓGICA PARA COMPRAR (Stock > 0)
            // En vez de comprar directo, abrimos el panel de método de pago
            const paymentPanel = document.getElementById('payment-selection-panel');
            if (paymentPanel) {
                paymentPanel.style.display = 'flex';

                // Reseteamos el input de días por si tenía algo escrito de antes
                const installmentsInput = document.getElementById('payment-installments');
                if (installmentsInput) installmentsInput.value = '';
            }

        } else if (action === 'reserve') {
            // LÓGICA PARA RESERVAR (Stock = 0)
            fetch(`https://${GetParentResourceName()}/reserveVehicle`, {
                method: 'POST',
                body: JSON.stringify(vehicleData)
            });

            // 1. Lo añadimos a la memoria local para que no pueda volver a reservarlo
            myPendingReservations.push(this.dataset.model);

            // 2. Feedback visual rápido (Animación Verde)
            this.innerText = '¡RESERVA ENVIADA!';
            this.style.background = 'rgba(255, 255, 255, 0.05)';
            this.style.color = 'rgba(255, 255, 255, 0.3)';
            this.disabled = true; // Lo desactivamos al instante para evitar doble-clic

            // 3. Después de 2.5s, lo dejamos en estado "YA RESERVADO" (Gris)
            setTimeout(() => {
                this.innerText = 'YA RESERVADO';
                this.style.background = 'rgba(255, 255, 255, 0.05)';
                this.style.color = 'rgba(255, 255, 255, 0.3)';
                this.style.cursor = 'not-allowed';
            }, 2500);
        }
    });
}

// =================================================================
// LÓGICA DEL NUEVO PANEL DE PAGO Y ENTREGA (REDISEÑADO)
// =================================================================

// 1. Botones de Efectivo / Banco
document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        // Quitamos la clase 'active' a todos (el CSS se encarga del color)
        document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));

        // Se la ponemos solo al que hemos clickeado
        this.classList.add('active');
    });
});

// 2. Botones de Entrega (Concesionario / Garaje)
document.querySelectorAll('.delivery-method-btn').forEach(btn => {
    btn.addEventListener('click', function () {
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

// 4. Botón CONFIRMAR COMPRA DEFINITIVA
const confirmFinalBuyBtn = document.getElementById('confirm-final-buy');
if (confirmFinalBuyBtn) {
    confirmFinalBuyBtn.addEventListener('click', () => {
        const buyBtn = document.getElementById('buy-vehicle');
        const activeMethodBtn = document.querySelector('.payment-method-btn.active');
        const paymentMethod = activeMethodBtn ? activeMethodBtn.dataset.method : 'cash';
        const activeDeliveryBtn = document.querySelector('.delivery-method-btn.active');
        const deliveryMethod = activeDeliveryBtn ? activeDeliveryBtn.dataset.delivery : 'drive';
        const installmentsVal = document.getElementById('payment-installments').value;
        const installments = parseInt(installmentsVal) || 0;

        // Escaneamos qué extras están encendidos en el panel
        const activeExtrasList = [];
        document.querySelectorAll('#extras-list-container .extra-item.active').forEach(extraItem => {
            activeExtrasList.push(parseInt(extraItem.dataset.id));
        });

        const finalVehicleData = {
            model: buyBtn.dataset.model,
            price: parseInt(buyBtn.dataset.price),
            brand: buyBtn.dataset.brand,
            name: buyBtn.dataset.name,
            color: currentPreviewColor,
            paymentType: paymentMethod,
            installments: installments,
            deliveryType: deliveryMethod,
            extras: currentActiveExtras
        };

        // =========================================================
        // CIERRE TOTAL Y ABSOLUTO DE LA INTERFAZ
        // =========================================================
        hideVehicleInfo();

        const paymentPanel = document.getElementById('payment-selection-panel');
        if (paymentPanel) paymentPanel.style.display = 'none';

        // Apagamos el carrusel de abajo
        document.getElementById('showroom-container').style.display = 'none';
        isShowroomOpen = false;

        // Ahora SÍ, mandamos la orden final a Lua
        fetch(`https://${GetParentResourceName()}/buyVehicle`, {
            method: 'POST',
            body: JSON.stringify(finalVehicleData)
        });
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
        const badgeBg = stockNum > 0 ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        const badgeColor = stockNum > 0 ? '#2ecc71' : '#888';
        const badgeBorder = stockNum > 0 ? 'rgba(46, 204, 113, 0.4)' : 'rgba(255, 255, 255, 0.1)';

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
            // Botón en estado de carga
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            this.disabled = true;

            setTimeout(() => {
                this.closest('.reservation-card').remove();
                checkEmptyReservations(container);
            }, 500);

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
        const isDeposit = tx.action === 'DEPOSITO' || tx.action === 'VENTA_VEHICULO';
        const actionClass = isDeposit ? 'text-deposit' : 'text-withdraw';

        // Si es una venta, cambiamos el texto feo por el nombre del modelo
        let displayText = tx.action;
        if (tx.action === 'VENTA_VEHICULO') {
            displayText = `VENTA: ${tx.model || 'Vehículo'}`;
        }

        // Formateamos la cantidad para que se vea bonita con comas
        const formattedAmount = new Intl.NumberFormat('es-ES').format(tx.amount);

        tbody.innerHTML += `
            <tr>
                <td><strong>${tx.employee}</strong></td>
                <td class="${actionClass}">${displayText}</td>
                <td style="color:#aaa;">${tx.rank}</td>
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
        tbody.innerHTML += `<tr>
            <td><span class="discount-code-pill" data-code="${d.code}">${d.code}</span></td>
            <td style="color:#aaa;">${d.author}</td>
            <td style="color:#ccc;">${d.vehicles}</td>
            <td style="color:#fff; font-weight:bold;">${d.perc}%</td>
            <td style="color:#aaa;">${d.uses}</td>
            <td><span class="expires-text">${d.expires}</span></td>
            <td class="centro"><button class="btn-icon" style="color:#aaa;"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`;
    });
}

document.getElementById('disc-prev')?.addEventListener('click', () => { if (discCurrentPage > 1) { discCurrentPage--; renderDiscTable(); } });
document.getElementById('disc-next')?.addEventListener('click', () => { if (discCurrentPage < Math.ceil(discWorkingList.length / discItemsPerPage)) { discCurrentPage++; renderDiscTable(); } });
document.getElementById('disc-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    discWorkingList = dummyDisc.filter(d =>
        d.code.toLowerCase().includes(term) ||
        d.author.toLowerCase().includes(term) ||
        d.vehicles.toLowerCase().includes(term)
    );
    discCurrentPage = 1; renderDiscTable();
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
    const tbody = document.getElementById('cats-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (activeCategories.length === 0) return tbody.innerHTML = `<tr><td colspan="3" style="border:none;"><div class="empty-state"><iconify-icon icon="solar:folder-error-bold-duotone" class="empty-state-icon"></iconify-icon><span class="empty-state-text">No hay categorías creadas</span></div></td></tr>`;

    activeCategories.sort((a, b) => a.order - b.order).forEach((c) => {
        tbody.innerHTML += `<tr>
            <td style="color:#aaa;">
                <span style="margin: 0 0.3vw; font-weight:bold; color:rgb(200 200 200);">${c.order}</span>
            </td>
            <td style="text-align: left; padding-left: 1vw;">
                <strong style="color: rgb(200 200 200); font-size: 0.8vw;">${c.label}</strong><br>
                <span style="color: #888; font-size: 0.6vw; text-transform: lowercase;">${c.name}</span>
            </td>
            <td class="centro" style="white-space: nowrap;">
                <button class="btn-icon" style="color:#fff;" onclick="viewCategory(${c.id})" title="Mostrar Vehículos"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-icon" style="color:#ccc;" onclick="editDummyCat(${c.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon" style="color:#888;" onclick="deleteCategory(${c.id})" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>`;
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

// Eliminar Categoría (Con chequeo inteligente de Stock)
function deleteCategory(id) {
    const cat = activeCategories.find(c => c.id === id);
    if (!cat) return;

    // Miramos en nuestra variable global si hay coches usando esta categoría
    const vehiclesInCat = globalStock.filter(v => v.category === cat.name);

    if (vehiclesInCat.length > 0) {
        // TIENE COCHES: Mostramos la advertencia de peligro
        document.getElementById('delete-cat-modal-text').innerHTML = `La categoría <b>${cat.label.toUpperCase()}</b> contiene <b>${vehiclesInCat.length} modelos</b> en stock.<br><br>Si la eliminas, <b>SE BORRARÁN TODOS</b> y la empresa perderá el dinero invertido. ¿Continuar?`;
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

    const grid = document.querySelector('.category-vehicles-grid');
    const rightWidget = grid.parentElement;
    const titleEl = rightWidget.querySelector('.widget-title');

    titleEl.innerHTML = `<i class="fa-solid fa-car-side"></i> Vehículos en: <span style="color: #2ecc71;">${cat.label.toUpperCase()}</span>`;

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
        const badgeBg = stockNum > 0 ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        const badgeColor = stockNum > 0 ? '#2ecc71' : '#888';
        const badgeBorder = stockNum > 0 ? 'rgba(46, 204, 113, 0.4)' : 'rgba(255, 255, 255, 0.1)';

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
// MÓDULO 16: INICIALIZACIÓN - DOMContentLoaded
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');

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

                // Cargar Últimas Ventas
                salesWorkingList = data.sales || [];
                originalSalesList = [...salesWorkingList];
                salesCurrentPage = 1;
                renderSalesTable();
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

            // PRIORIDAD 1: Si el Showroom está abierto, cerrarlo
            if (isShowroomOpen) {
                isShowroomOpen = false;
                document.getElementById('showroom-container').style.display = 'none';
                fetch(`https://${GetParentResourceName()}/closeShowroomMenu`, { method: 'POST', body: JSON.stringify({}) });
                return;
            }

            // PRIORIDAD 2: Si el Boss Menu está abierto, cerrarlo
            if (isBossMenuOpen) {
                closeBossMenu();
                return;
            }

            // PRIORIDAD 3: Si el Menú de Compra (Dynasty 8) está abierto, cerrarlo
            if (document.getElementById('buy-container').style.display === 'flex') {
                closeBuyMenu();
                return;
            }

            // PRIORIDAD 4: Lógica normal del menú de gestión
            const modals = ['set-spawn-modal', 'assign-vehicle-modal', 'delete-confirm-modal', 'edit-vehicle-modal', 'deposit-modal', 'withdraw-modal'];
            const activeModal = modals.find(id => document.getElementById(id).style.display === 'flex');

            if (activeModal) toggleModal(activeModal, false);
            else closeMenu();
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
        // Si detectamos que ha sido un arrastre, anulamos el clic
        if (isDraggingFlag) return;

        // Buscamos si hemos hecho clic en una card
        const card = e.target.closest('.vehicle-card');
        if (!card) return;

        // 1. Quitar la clase 'selected' de todas las cards
        document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));

        // 2. Añadir la clase 'selected' a la clickeada
        card.classList.add('selected');

        // 3. Obtener el modelo y mandarlo a Lua para que lo spawnee
        const vehicleModel = card.getAttribute('data-model');
        fetch(`https://${GetParentResourceName()}/previewVehicle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: vehicleModel })
        });
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

    // --- LISTENERS DE LOS BOTONES GUARDAR/ELIMINAR RANGOS ---

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
});
