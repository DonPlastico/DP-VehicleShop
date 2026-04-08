// =================================================================
// SECCIÓN 1: ESTADO GLOBAL Y VARIABLES
// =================================================================

// Almacena las traducciones enviadas desde Lua (config.lua)
let globalTranslations = {};

// [IMPORTANTE] Lista MAESTRA con todos los datos. Nunca se filtra, sirve de respaldo.
let originalFullList = [];

// Lista de TRABAJO. Es la que se ordena, filtra y recorta para la paginación.
let currentWorkingList = [];

// Configuración de visualización
let currentPage = 1;           // Página actual
let itemsPerPage = 7;          // Elementos por página (se actualiza desde Lua)
let sortColumn = 'date_added'; // Columna activa de ordenación
let sortDirection = 'desc';    // 'asc' o 'desc'
let currentFilter = '';        // Texto del buscador
let isShowroomOpen = false;    // Controla si el catálogo de clientes está abierto
let isBossMenuOpen = false;    // Controla si el Boss Menu está abierto
let currentBossDealerName = ""; // Guarda el nombre de la empresa para los títulos

// =================================================================
// SECCIÓN 2: SISTEMA DE TRADUCCIÓN Y FORMATO
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
// SECCIÓN 3: GESTIÓN VISUAL (MENÚ Y MODALES)
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
// SECCIÓN 3.5: GESTIÓN DEL HUD (ETIQUETAS FLOTANTES)
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
// SECCIÓN 4: LÓGICA DE DATOS (TABLA Y PAGINACIÓN)
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

// =================================================================
// SECCIÓN 5: FILTROS Y ORDENACIÓN
// =================================================================

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

// =================================================================
// SECCIÓN 6: FORMULARIOS (EDITAR / SELECTORES)
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
// SECCIÓN 7: LISTENERS E INICIALIZACIÓN (DOM READY)
// =================================================================

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

// ---- EVENTO PRINCIPAL: CARGA DEL DOM ----
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');

    // 1. Listeners de Botones Principales
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

    // 2. Buscador
    document.getElementById('vehicle-search-input').addEventListener('input', filterVehicleList);

    // 3. Acciones de Formularios (Fetch a Lua)

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

    // 4. Listener de Mensajes NUI (Lua -> JS)
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
                isShowroomOpen = true;
                document.getElementById('showroom-container').style.display = 'block';
                break;
            // Abre el menú de gestión (Boss Menu)
            case 'openBossMenu':
                isBossMenuOpen = true;
                currentBossDealerName = data.dealerName;
                document.getElementById('boss-dealer-title').innerText = currentBossDealerName;
                document.getElementById('boss-back-btn').style.display = 'none'; // Ocultamos el volver al abrir
                document.getElementById('boss-container').style.display = 'flex';
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

                transWorkingList = data.transactions || [];
                originalTransList = [...transWorkingList];
                transCurrentPage = 1;
                renderTransactionsTable();
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
        }
    });

    // 5. Tecla ESC
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

    generateTestCards();

    const carousel = document.getElementById('vehicle-carousel');
    const btnPrev = document.getElementById('carousel-prev');
    const btnNext = document.getElementById('carousel-next');

    carousel.addEventListener('scroll', updateCarouselMask);
    updateCarouselMask();

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
});

// =================================================================
// SECCIÓN 8: LÓGICA DEL CARRUSEL (SHOWROOM)
// =================================================================

// 1. Generar 20 cards de prueba
function generateTestCards() {
    const carousel = document.getElementById('vehicle-carousel');
    if (!carousel) return;

    carousel.innerHTML = ''; // Limpiar

    const brands = ['Pegassi', 'Grotti', 'Truffade', 'Annis', 'Pfister'];
    // He puesto modelos reales de GTA para que la prueba de spawn en Lua funcione
    const models = ['zentorno', 'turismo2', 'adder', 'elegy', 'comet2'];

    for (let i = 1; i <= 20; i++) {
        const randomBrand = brands[Math.floor(Math.random() * brands.length)];
        const randomModel = models[Math.floor(Math.random() * models.length)];

        const card = document.createElement('div');
        card.className = 'vehicle-card';
        // Guardamos el modelo del coche en un atributo para leerlo al hacer clic
        card.setAttribute('data-model', randomModel);

        card.innerHTML = `
            <div class="card-header-info">
                <div class="card-brand-logo"><i class="fa-solid fa-car"></i></div>
                <div class="card-text-info">
                    <span class="card-brand-name">${randomBrand}</span>
                    <span class="card-model-name">${randomModel}</span>
                </div>
            </div>
            <div class="card-vehicle-image">
                IMG ${i}
            </div>
        `;
        carousel.appendChild(card);
    }
}

// 2. Control dinámico del difuminado (Máscaras CSS)
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

// =================================================================
// SECCIÓN 9: LÓGICA DEL BOSS MENU (DASHBOARD)
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
    });
});

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

// 3. Tabla de Ventas (Datos simulados para prueba)
let dummySales = [
    { buyer: 'Alex Casacas', modelLabel: 'Vigero ZX Convertible', modelId: 'vigero3', price: '10,540', date: '08-04-2026 | 02:45' },
    { buyer: 'Juan Perez', modelLabel: 'Zentorno', modelId: 'zentorno', price: '725,000', date: '07-04-2026 | 18:30' },
    { buyer: 'Maria Lopez', modelLabel: 'Adder', modelId: 'adder', price: '1,000,000', date: '06-04-2026 | 12:15' },
    { buyer: 'Carlos Sainz', modelLabel: 'Futo GTX', modelId: 'futo2', price: '35,000', date: '05-04-2026 | 20:00' },
    { buyer: 'Alex Casacas', modelLabel: 'Sanchez', modelId: 'sanchez', price: '8,000', date: '04-04-2026 | 09:10' },
    { buyer: 'Lucia Gomez', modelLabel: 'Elegy Retro', modelId: 'elegy', price: '115,000', date: '03-04-2026 | 16:45' },
    { buyer: 'Pedro Picapiedra', modelLabel: 'Brawler', modelId: 'brawler', price: '85,000', date: '02-04-2026 | 14:20' },
];

let salesWorkingList = [...dummySales];
let salesCurrentPage = 1;
const salesItemsPerPage = 19; // Ajustado para que quepan 8 ventas en la misma vista

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
                <td style="color:#2ecc71; font-weight:bold;">$ ${sale.price}</td>
                <td style="font-size:0.8vw;">${sale.date}</td>
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
document.getElementById('boss-sales-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    salesWorkingList = dummySales.filter(s =>
        s.buyer.toLowerCase().includes(term) ||
        s.modelLabel.toLowerCase().includes(term)
    );
    salesCurrentPage = 1; // Volver a la pag 1 al buscar
    renderSalesTable();
});

// Iniciar tabla al cargar
document.addEventListener('DOMContentLoaded', () => {
    renderSalesTable();
});

// =================================================================
// SECCIÓN 10: LÓGICA DE COMPAÑÍA (TRANSACCIONES Y BALANCE)
// =================================================================

// Ahora arranca vacío, esperando la información de SQL
let transWorkingList = [];
let originalTransList = [];
let transCurrentPage = 1;
const transItemsPerPage = 18;

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
        const isDeposit = tx.action === 'DEPOSITO';
        const actionClass = isDeposit ? 'text-deposit' : 'text-withdraw';
        // Formateamos la cantidad para que se vea bonita con comas
        const formattedAmount = new Intl.NumberFormat('es-ES').format(tx.amount);

        tbody.innerHTML += `
            <tr>
                <td><strong>${tx.employee}</strong></td>
                <td class=\"${actionClass}\">${tx.action}</td>
                <td style=\"color:#aaa;\">${tx.rank}</td>
                <td class=\"${actionClass}\">$ ${formattedAmount}</td>
                <td style=\"font-size:0.8vw;\">${tx.date}</td>
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

// =================================================================
// SECCIÓN 11: LÓGICA DE SUB-PÁGINAS (PERSONAL Y AJUSTES)
// =================================================================

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
// SECCIÓN 12: RENDERIZADO DE TABLAS SECUNDARIAS Y PAGINACIÓN
// =================================================================

// --- 1. SANCIONADOS ---
let dummySanc = [
    { name: 'Paco Fiestas', sanctions: 2, date: '08-04-2026' },
    { name: 'Juan Nieve', sanctions: 1, date: '07-04-2026' }
];
let sancWorkingList = [...dummySanc];
let sancCurrentPage = 1;
const sancItemsPerPage = 16; // <-- AJUSTA ESTE NÚMERO A TU GUSTO

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
        tbody.innerHTML += `<tr><td><strong>${s.name}</strong></td><td style="color:#e74c3c;">${s.sanctions}</td><td style="font-size:0.7vw;">${s.date}</td></tr>`;
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
let dummyEmp = [
    { name: 'Alex Casacas', rank: 'Jefe', salary: '2000' },
    { name: 'Paca Sancada', rank: 'Vendedor', salary: '500' }
];
let empWorkingList = [...dummyEmp];
let empCurrentPage = 1;
const empItemsPerPage = 9; // <-- AJUSTA ESTE NÚMERO A TU GUSTO

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
            <td style="color:#2ecc71;">$ ${e.salary}</td>
            <td class="centro"><button class="btn-icon"><i class="fa-solid fa-pen"></i></button></td>
        </tr>`;
    });
}

document.getElementById('emp-prev')?.addEventListener('click', () => { if (empCurrentPage > 1) { empCurrentPage--; renderEmpTable(); } });
document.getElementById('emp-next')?.addEventListener('click', () => { if (empCurrentPage < Math.ceil(empWorkingList.length / empItemsPerPage)) { empCurrentPage++; renderEmpTable(); } });
document.getElementById('emp-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    empWorkingList = dummyEmp.filter(emp => emp.name.toLowerCase().includes(term) || emp.rank.toLowerCase().includes(term));
    empCurrentPage = 1; renderEmpTable();
});


// --- 3. DESCUENTOS ---
let dummyDisc = [
    { code: 'VERANO26', author: 'Alex', vehicles: 'TODOS', perc: 15, uses: 10, expires: 'ILIMITADO' },
    { code: 'VIPZENT', author: 'Paca', vehicles: 'Zentorno', perc: 5, uses: 1, expires: '15-04-2026' }
];
let discWorkingList = [...dummyDisc];
let discCurrentPage = 1;
const discItemsPerPage = 13; // <-- AJUSTA ESTE NÚMERO A TU GUSTO (La tabla es más alta)

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
            <td>${d.vehicles}</td>
            <td style="color:#2ecc71; font-weight:bold;">${d.perc}%</td>
            <td>${d.uses}</td>
            <td><span class="expires-text">${d.expires}</span></td>
            <td class="centro"><button class="btn-icon" style="color:#e74c3c;"><i class="fa-solid fa-trash-can"></i></button></td>
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

// Llamar renders al cargar
document.addEventListener('DOMContentLoaded', () => {
    renderSancTable();
    renderEmpTable();
    renderDiscTable();
});

// =================================================================
// SECCIÓN 13: LÓGICA DE CATEGORÍAS Y FILTROS DEL SHOWROOM
// =================================================================

// Ahora arranca vacío, esperando la información de la Base de Datos (Lua)
let activeCategories = [];

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
                <span style="color: #2ecc71; font-size: 0.6vw; text-transform: lowercase;">${c.name}</span>
            </td>
            <td class="centro" style="white-space: nowrap;">
                <button class="btn-icon" style="color:#2ecc71;" onclick="viewCategory(${c.id})" title="Mostrar Vehículos"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-icon" style="color:#3498db;" onclick="editDummyCat(${c.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon" style="color:#e74c3c;" onclick="deleteCategory(${c.id})" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>`;
    });
}

function renderShowroomFilters() {
    const filterContainer = document.querySelector('.toolbar-filters');
    if (!filterContainer) return;

    filterContainer.innerHTML = '';

    const sortedCats = activeCategories.sort((a, b) => a.order - b.order);

    filterContainer.innerHTML += `<span class="filter-text active" data-cat="all">TODOS</span>`;

    sortedCats.forEach(cat => {
        filterContainer.innerHTML += `<span class="filter-text" data-cat="${cat.name}">· ${cat.label.toUpperCase()}</span>`;
    });

    document.querySelectorAll('.filter-text').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-text').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

// Abrir Modal para EDITAR Categoría
function editDummyCat(id) {
    const cat = activeCategories.find(c => c.id === id);
    if (cat) {
        document.getElementById('cat-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Categoría';
        document.getElementById('cat-modal-desc').innerText = 'Modifica el nombre visible. El ID interno NO se puede cambiar.';
        document.getElementById('cat-id-input').value = cat.id;

        // Desactivar input del ID interno por seguridad
        const nameInput = document.getElementById('cat-name-input');
        nameInput.value = cat.name;
        nameInput.disabled = true;
        nameInput.style.opacity = '0.5';

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
    const name = document.getElementById('cat-name-input').value.trim().toLowerCase();
    const label = document.getElementById('cat-label-input').value.trim();

    if (name.length === 0 || label.length === 0) return;

    fetch(`https://${GetParentResourceName()}/saveCategory`, {
        method: 'POST',
        body: JSON.stringify({
            id: id ? parseInt(id) : null,
            name: name,
            label: label
        })
    });

    toggleModal('category-modal', false); // Cierra el modal
});

// Eliminar Categoría (Sigue igual)
function deleteCategory(id) {
    fetch(`https://${GetParentResourceName()}/deleteCategory`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

// Añadimos estas funciones al inicio
document.addEventListener('DOMContentLoaded', () => {
    renderBossCatsTable();
    renderShowroomFilters();
});

// Función para el botón del "Ojito" (Próximamente)
function viewCategory(id) {
    console.log("Mostrando vehículos de la categoría " + id + " (Aún no implementado)");
    // Aquí cargaremos los coches de esa categoría en el grid derecho en el futuro
}

// Abrir Modal para NUEVA Categoría
function openNewCategoryModal() {
    document.getElementById('cat-modal-title').innerHTML = '<i class="fa-solid fa-folder-plus"></i> Nueva Categoría';
    document.getElementById('cat-modal-desc').innerText = 'Crea una nueva categoría para organizar los vehículos.';
    document.getElementById('cat-id-input').value = '';

    // Activar input del ID interno
    const nameInput = document.getElementById('cat-name-input');
    nameInput.value = '';
    nameInput.disabled = false;
    nameInput.style.opacity = '1';

    document.getElementById('cat-label-input').value = '';

    toggleModal('category-modal', true);
}