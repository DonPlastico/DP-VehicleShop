-- =================================================================
-- OPTIMIZACIÓN: CACHÉ DE NATIVAS (Esto mejora el rendimiento drásticamente)
-- =================================================================
local isMenuOpen = false
local spawnedShowroomVehicles = {}
local nearbyVehicles = {}
local isHudActive = false
local spawnedNPCs = {}
local showroomCam = nil
local previewVehicleEntity = nil
local DealerOwners = {}
local spawnedAgencyNPCs = {}
local currentActiveZone = nil
local currentActiveText = nil
local currentBossDealerId = nil
local currentShowroomDealerId = nil
local ShowroomVehicleData = {}
local currentPreviewRequestId = 0

-- =================================================================
-- INICIALIZACIÓN DEL FRAMEWORK (AÑADIR ESTO AQUÍ)
-- =================================================================
local Framework = {}
if Config.Framework == 'qbcore' then
    Framework.Core = exports['qb-core']:GetCoreObject()
elseif Config.Framework == 'esx' then
    TriggerEvent('esx:getSharedObject', function(obj)
        Framework.Core = obj
    end)
elseif Config.Framework == 'new_esx' then
    Framework.Core = exports.es_extended:getSharedObject()
elseif Config.Framework == 'ox' then
    Framework.Core = exports.ox_core:GetCoreObject()
end

-- =================================================================
-- SECCIÓN 1: FUNCIONES AUXILIARES Y DATOS DEL JUGADOR (CACHÉ)
-- =================================================================

local PlayerData = {}
local PlayerJob = {}

-- Guardamos los datos del jugador una sola vez para evitar 0.99 ms de lag
local function UpdateLocalPlayerData()
    if Config.Framework == 'qbcore' and Framework.Core then
        PlayerData = Framework.Core.Functions.GetPlayerData()
        if PlayerData then
            PlayerJob = PlayerData.job
        end
    elseif (Config.Framework == 'esx' or Config.Framework == 'new_esx') and Framework.Core then
        PlayerData = Framework.Core.GetPlayerData()
        if PlayerData then
            PlayerJob = PlayerData.job
        end
    end
end

local function GetPlayerCoords()
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    return {
        x = pos.x,
        y = pos.y,
        z = pos.z,
        h = GetEntityHeading(ped)
    }
end

-- Valida si el jugador es DUEÑO o JEFE tirando de la memoria Caché (0 lag)
local function IsPlayerAuthorized(dealerName, dealerConfig)
    local isOwner = false
    local isBoss = false

    if Config.Framework == 'qbcore' then
        if PlayerData and PlayerData.citizenid and DealerOwners[dealerName] == PlayerData.citizenid then
            isOwner = true
        end
        if PlayerJob and PlayerJob.name == dealerConfig.job and PlayerJob.isboss then
            isBoss = true
        end
    elseif Config.Framework == 'esx' or Config.Framework == 'new_esx' then
        if PlayerData and PlayerData.identifier and DealerOwners[dealerName] == PlayerData.identifier then
            isOwner = true
        end
        if PlayerJob and PlayerJob.name == dealerConfig.job and PlayerJob.grade_name == 'boss' then
            isBoss = true
        end
    end
    return isOwner or isBoss
end

-- =================================================================
-- SECCIÓN 2: LÓGICA DEL MENÚ NUI
-- =================================================================

local function SetMenuState(state)
    if isMenuOpen == state then
        return
    end
    isMenuOpen = state

    SendNUIMessage({
        action = 'setVisible',
        status = state
    })

    if state then
        SendNUIMessage({
            action = 'loadTranslations',
            translations = Config.Locales[Config.Language],
            itemsPerPage = Config.ItemsPerPage
        })
    end
    SetNuiFocus(state, state)
end

-- =================================================================
-- SECCIÓN 3: GESTIÓN DE ENTIDADES
-- =================================================================

local function SpawnShowroomVehicle(vehicleData)
    if not vehicleData.spawn_x or not vehicleData.spawn_y then
        return
    end

    local modelHash = GetHashKey(vehicleData.model)
    if not IsModelInCdimage(modelHash) then
        return
    end

    RequestModel(modelHash)
    while not HasModelLoaded(modelHash) do
        Wait(10)
    end

    local x, y, z, h = tonumber(vehicleData.spawn_x), tonumber(vehicleData.spawn_y), tonumber(vehicleData.spawn_z),
        tonumber(vehicleData.spawn_h)

    -- 1. Spawneamos el coche un pelín elevado (z + 0.5) para que no se entierre al aparecer
    local vehicle = CreateVehicle(modelHash, x, y, z + 0.5, h, false, false)

    while not DoesEntityExist(vehicle) do
        Wait(10)
    end

    SetEntityAsMissionEntity(vehicle, true, true)

    -- 2. OBLIGAMOS a GTA V a cargar el suelo sólido debajo del coche
    RequestCollisionAtCoord(x, y, z)
    local timeout = 0
    while not HasCollisionLoadedAroundEntity(vehicle) and timeout < 200 do
        Wait(10)
        timeout = timeout + 1
    end

    -- 3. Posamos el coche mágicamente y perfecto sobre sus 4 ruedas
    SetVehicleOnGroundProperly(vehicle)

    -- 4. AHORA SÍ, con las físicas de la suspensión relajadas, lo congelamos
    FreezeEntityPosition(vehicle, true)
    SetEntityInvincible(vehicle, true)
    SetVehicleEngineOn(vehicle, false, true, true)
    SetVehicleDoorsLocked(vehicle, 4)
    SetVehicleTyresCanBurst(vehicle, false)
    SetVehicleUndriveable(vehicle, true)

    -- 5. Pintamos de negro SIN usar ModKit (el ModKit causa Scene Node Index en addons)
    SetVehicleColours(vehicle, 0, 0)
    SetVehicleExtraColours(vehicle, 0, 0)
    SetVehicleDirtLevel(vehicle, 0.0)

    spawnedShowroomVehicles[vehicleData.id] = {
        entity = vehicle,
        info = vehicleData
    }

    SetModelAsNoLongerNeeded(modelHash)
end

local function ClearShowroomVehicles()
    for id, data in pairs(spawnedShowroomVehicles) do
        if DoesEntityExist(data.entity) then
            DeleteEntity(data.entity)
        end
    end
    spawnedShowroomVehicles = {}
    nearbyVehicles = {}
end

local function DeleteSpecificShowroomVehicle(vehicleId)
    local data = spawnedShowroomVehicles[vehicleId]
    if data and data.entity and DoesEntityExist(data.entity) then
        DeleteEntity(data.entity)
    end
    spawnedShowroomVehicles[vehicleId] = nil
end

-- =================================================================
-- SECCIÓN 3.5: GESTIÓN DE NPCs (VENDEDORES)
-- =================================================================

local function SpawnDealershipNPCs()
    for dealerKey, data in pairs(Config.Dealerships) do
        -- 1. NPC Vendedor (Solo si no existe ya)
        if not spawnedNPCs[dealerKey] then
            local model = GetHashKey(data.npc_model)
            RequestModel(model)
            while not HasModelLoaded(model) do
                Wait(10)
            end

            local ped = CreatePed(0, model, data.coords_npc.x, data.coords_npc.y, data.coords_npc.z - 1.0,
                data.coords_npc.w, false, false)
            FreezeEntityPosition(ped, true)
            SetEntityInvincible(ped, true)
            SetBlockingOfNonTemporaryEvents(ped, true)
            if data.npc_scenario then
                TaskStartScenarioInPlace(ped, data.npc_scenario, 0, true)
            end

            spawnedNPCs[dealerKey] = ped -- Guardamos con su clave (ej: 'cars')
        end

        -- 2. NPC Agencia (Agente inmobiliario para COMPRAR la empresa. Solo si NO hay dueño)
        if not DealerOwners[dealerKey] and data.npc_buy then
            if not spawnedAgencyNPCs[dealerKey] then
                local model = GetHashKey(Config.RealEstateNPC or 'a_m_y_business_03')
                RequestModel(model)
                while not HasModelLoaded(model) do
                    Wait(10)
                end

                -- AHORA USA LAS COORDENADAS 'npc_buy' (Y su rotación 'w')
                local ped = CreatePed(0, model, data.npc_buy.x, data.npc_buy.y, data.npc_buy.z - 1.0, data.npc_buy.w,
                    false, false)

                FreezeEntityPosition(ped, true)
                SetEntityInvincible(ped, true)
                SetBlockingOfNonTemporaryEvents(ped, true)
                TaskStartScenarioInPlace(ped, "WORLD_HUMAN_CLIPBOARD", 0, true)

                spawnedAgencyNPCs[dealerKey] = ped -- Guardamos con su clave
            end
        end
    end
end

-- Función para borrar NPCs de forma segura
local function DeleteDealershipNPCs()
    -- Usamos pairs porque ahora son tablas asociativas (con nombres, no solo números)
    for k, ped in pairs(spawnedNPCs) do
        if DoesEntityExist(ped) then
            DeleteEntity(ped)
        end
    end
    spawnedNPCs = {}

    for k, ped in pairs(spawnedAgencyNPCs) do
        if DoesEntityExist(ped) then
            DeleteEntity(ped)
        end
    end
    spawnedAgencyNPCs = {}
end

-- =================================================================
-- SECCIÓN 4: INICIALIZACIÓN Y SISTEMA ANTI-BUGS
-- =================================================================

local function InitializeClientLoad()
    UpdateLocalPlayerData() -- Cargamos tus datos en la caché al iniciar
    TriggerServerEvent('DP-VehicleShop:server:getVehicles')
    TriggerServerEvent('DP-VehicleShop:server:getSpawns')
    TriggerServerEvent('DP-VehicleShop:server:requestOwners')
end

-- AÑADE ESTOS EVENTOS JUSTO AQUÍ (Para actualizar si cambias de trabajo en vivo)
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(JobInfo)
    PlayerJob = JobInfo
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(val)
    PlayerData = val
end)

RegisterNetEvent('esx:setJob', function(job)
    PlayerJob = job
end)

-- Cuando el script se reinicia en vivo
AddEventHandler('onResourceStart', function(resourceName)
    if GetCurrentResourceName() == resourceName then
        CreateThread(function()
            Wait(1000)
            InitializeClientLoad()
        end)
    end
end)

-- Cuando un jugador entra al servidor
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    CreateThread(function()
        -- 1. Esperamos pacientemente a que la pantalla deje de estar en negro
        while not IsScreenFadedIn() do
            Wait(100)
        end

        -- 2. Le damos 3.5 segundos de cortesía para que las texturas y colisiones del mapa se asienten
        Wait(3500)

        -- 3. AHORA SÍ, le pedimos al servidor que spawnee los coches
        InitializeClientLoad()
    end)
end)

-- Cuando el script se detiene/reinicia (SISTEMA ANTI-BUGS / FAILSAFE)
AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() == resourceName then
        -- 1. Limpiamos NPCs y coches de exposición del mundo
        ClearShowroomVehicles()
        DeleteDealershipNPCs()

        -- ==========================================
        -- 2. SALVAVIDAS: Si el jugador estaba en el Showroom
        -- ==========================================
        if previousCoords then
            local ped = PlayerPedId()

            -- A. Liberar el ratón y la UI
            SetNuiFocus(false, false)

            -- B. Destruir la cámara cinematográfica
            if showroomCam then
                RenderScriptCams(false, false, 0, true, true)
                DestroyCam(showroomCam, false)
                showroomCam = nil
            end

            -- C. Borrar el vehículo de previsualización que estaba mirando
            if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
                DeleteEntity(previewVehicleEntity)
                previewVehicleEntity = nil
            end

            -- D. Teletransportarlo de vuelta a la superficie
            SetEntityCoords(ped, previousCoords.x, previousCoords.y, previousCoords.z, false, false, false, false)
            SetEntityHeading(ped, previousCoords.w)

            -- E. Devolverle su estado físico (visibilidad, gravedad, colisiones)
            FreezeEntityPosition(ped, false)
            SetEntityVisible(ped, true, true)
            SetEntityCollision(ped, true, true)
            SetPedCanRagdoll(ped, true)

            -- F. Devolverle el Chat y el Minimapa
            TriggerEvent('chat:client:showChat', true)
            DisplayRadar(true)

            -- Limpiamos la variable
            previousCoords = nil
        end
    end
end)

-- =================================================================
-- SECCIÓN 5: EVENTOS
-- =================================================================

RegisterNetEvent('DP-VehicleShop:client:openMenu', function()
    SetMenuState(true)
end)

RegisterNetEvent('DP-VehicleShop:client:enterShowroomMode', function(dealerName)
    local ped = PlayerPedId()

    -- 1. Capturamos sus coordenadas EXACTAS actuales con su heading (vector4)
    local pos = GetEntityCoords(ped)
    local head = GetEntityHeading(ped)
    previousCoords = vector4(pos.x, pos.y, pos.z, head)

    -- LÓGICA DE SPAWNS DINÁMICOS (MAR/AIRE VS INTERIOR)
    local dealerConfig = Config.Dealerships[currentShowroomDealerId]

    -- Coordenadas por defecto (Habitación Subterránea)
    local showroomCoords = vector4(1187.23, -3252.78, -49.0, 90.67)
    local camCoords = vector3(1187.23, -3252.78, -47.5) -- z + 1.5
    local camHeading = 90.67 -- Rotación por defecto
    local camRotX = -12.0

    -- Si el concesionario tiene coords personalizadas de cámara, las usamos
    if dealerConfig and dealerConfig.preview_cam then
        -- Escondemos tu personaje debajo de la cámara para que no salga en pantalla
        showroomCoords = vector4(dealerConfig.preview_cam.x, dealerConfig.preview_cam.y,
            dealerConfig.preview_cam.z - 5.0, 0.0)

        camCoords = vector3(dealerConfig.preview_cam.x, dealerConfig.preview_cam.y, dealerConfig.preview_cam.z)
        camHeading = dealerConfig.preview_cam.w or 0.0 -- Extraemos la rotación Z (Heading) de la cámara
        camRotX = -5.0 -- Inclinación más suave para exteriores grandes
    end

    -- 3. Teletransportar, congelar, invisibilizar y desactivar colisiones
    SetEntityCoords(ped, showroomCoords.x, showroomCoords.y, showroomCoords.z, false, false, false, false)
    SetEntityHeading(ped, showroomCoords.w)

    FreezeEntityPosition(ped, true)
    SetEntityVisible(ped, false, false)
    SetEntityCollision(ped, false, false)
    SetPedCanRagdoll(ped, false)

    -- 4. CONGELAR LA CÁMARA EXACTA (Scripted Camera)
    showroomCam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    SetCamCoord(showroomCam, camCoords.x, camCoords.y, camCoords.z)

    -- Usamos 'camHeading' para rotar la cámara a la izquierda/derecha
    SetCamRot(showroomCam, camRotX, 0.0, camHeading, 2)

    SetCamActive(showroomCam, true)
    RenderScriptCams(true, false, 0, true, true)

    -- 5. Ocultar el Chat y el Minimapa
    TriggerEvent('chat:client:showChat', false)
    DisplayRadar(false)

    -- 6. Abrimos el NUI del catálogo
    SendNUIMessage({
        action = 'openDealershipUI'
    })

    SetNuiFocus(true, true)
end)

-- Dejamos preparada la función para cuando cierre el NUI
RegisterNetEvent('DP-VehicleShop:client:exitShowroomMode', function()
    local ped = PlayerPedId()

    -- 1. Deshabilitamos el foco NUI
    SetNuiFocus(false, false)

    -- 1.5. Borramos el coche de prueba al salir
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        DeleteEntity(previewVehicleEntity)
        previewVehicleEntity = nil
    end

    -- 2. DESTRUIR LA CÁMARA y devolver la vista normal al jugador
    if showroomCam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(showroomCam, false)
        showroomCam = nil
    end

    -- 3. Lo devolvemos a sus coordenadas EXACTAS originales
    if previousCoords then
        SetEntityCoords(ped, previousCoords.x, previousCoords.y, previousCoords.z, false, false, false, false)
        SetEntityHeading(ped, previousCoords.w)
        previousCoords = nil
    end

    -- 4. Lo descongelamos, lo hacemos visible y tangible de nuevo
    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, true)
    SetEntityCollision(ped, true, true)
    SetPedCanRagdoll(ped, true)

    -- 5. Mostrar el Chat y el Minimapa de vuelta
    TriggerEvent('chat:client:showChat', true)
    DisplayRadar(true)
end)

RegisterNetEvent('DP-VehicleShop:client:sendVehicles', function(vehicleList)
    ClearShowroomVehicles()
    ShowroomVehicleData = vehicleList -- Guardamos la información
    local nuiList = {}

    for _, vehicleData in pairs(vehicleList) do
        -- ¡YA NO SPAWNEAMOS AQUÍ DE GOLPE! (Lo hará el hilo de proximidad)
        table.insert(nuiList, {
            id = vehicleData.id,
            model = vehicleData.model,
            display_name = vehicleData.display_name,
            setter_name = vehicleData.setter_name,
            price = vehicleData.price,
            date_added = tostring(vehicleData.date_added),
            spawn_name = vehicleData.spawn_name,
            spawn_x = vehicleData.spawn_x,
            spawn_y = vehicleData.spawn_y,
            spawn_z = vehicleData.spawn_z
        })
    end

    SendNUIMessage({
        action = 'sendVehicles',
        vehicleList = nuiList
    })
end)

RegisterNetEvent('DP-VehicleShop:client:sendSpawns', function(spawnList)
    SendNUIMessage({
        action = 'sendSpawns',
        spawnList = spawnList
    })
end)

RegisterNetEvent('DP-VehicleShop:client:deleteVehicleEntity', function(vehicleId)
    DeleteSpecificShowroomVehicle(vehicleId)
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    InitializeClientLoad()
end)

-- =================================================================
-- EVENTOS DEL MENÚ NUI (RECEPCIÓN DE DATOS Y APERTURA)
-- =================================================================

-- 1. Apertura del Jefe
RegisterNetEvent('DP-VehicleShop:client:openBossMenu', function(dealerId, dealerLabel, categories, jobGrades, vehicles)
    currentBossDealerId = dealerId

    SendNUIMessage({
        action = 'loadCategories',
        categories = categories
    })

    SendNUIMessage({
        action = 'loadJobGrades',
        grades = jobGrades
    })

    -- Enviamos la lista de vehículos reales a la UI
    SendNUIMessage({
        action = 'loadBossStock',
        vehicles = vehicles
    })

    SendNUIMessage({
        action = 'openBossMenu',
        dealerName = dealerLabel
    })
    SetNuiFocus(true, true)
end)

-- 2. Apertura del Showroom
RegisterNetEvent('DP-VehicleShop:client:openShowroom', function(dealerId, categories, vehicles, myReservations)
    -- Guardamos el ID del concesionario actual
    currentShowroomDealerId = dealerId

    -- Enviamos tus reservas activas al Javascript para bloquear los botones correspondientes
    SendNUIMessage({
        action = 'loadMyReservations',
        myReservations = myReservations or {}
    })

    -- 1. Pasamos las categorías al Javascript
    SendNUIMessage({
        action = 'loadCategories',
        categories = categories
    })

    -- 1.5. Pasamos los coches reales al catálogo
    SendNUIMessage({
        action = 'loadBossStock',
        vehicles = vehicles
    })

    -- 2. Recuperamos el nombre del concesionario
    local dealerLabel = (Config.Dealerships[dealerId] and Config.Dealerships[dealerId].label) or dealerId

    -- 3. Iniciamos el modo Showroom (Cámaras y posición)
    TriggerEvent('DP-VehicleShop:client:enterShowroomMode', dealerLabel)
end)

RegisterNetEvent('DP-VehicleShop:client:updateBossData', function(balance, logs, sales)
    SendNUIMessage({
        action = 'updateBossData',
        balance = balance,
        transactions = logs,
        sales = sales
    })
end)

RegisterNetEvent('DP-VehicleShop:client:updateOwners', function(data)
    -- Lógica para que el NPC se vaya caminando
    for dealerKey, ped in pairs(spawnedAgencyNPCs) do
        if data[dealerKey] and not DealerOwners[dealerKey] then
            FreezeEntityPosition(ped, false)
            SetEntityInvincible(ped, false)
            SetBlockingOfNonTemporaryEvents(ped, false)
            ClearPedTasksImmediately(ped)
            TaskWanderStandard(ped, 10.0, 10)
            spawnedAgencyNPCs[dealerKey] = nil
            local pedToLeave = ped
            SetTimeout(8000, function()
                if DoesEntityExist(pedToLeave) then
                    DeleteEntity(pedToLeave)
                end
            end)
        end
    end

    -- Actualizamos la tabla de dueños
    DealerOwners = data

    -- Volvemos a generar NPCs por si acaso
    SpawnDealershipNPCs()
end)

-- Este evento recibe las categorías actualizadas del servidor y refresca el UI al instante
RegisterNetEvent('DP-VehicleShop:client:refreshCategories', function(categories)
    SendNUIMessage({
        action = 'loadCategories',
        categories = categories
    })
end)

-- Este evento recibe las reservas del servidor y las manda al JS para pintar el Boss Menu
RegisterNetEvent('DP-VehicleShop:client:updateReservations', function(reservations)
    SendNUIMessage({
        action = 'updateReservations',
        reservations = reservations
    })
end)

-- Este evento recibe los rangos de trabajo actualizados del servidor y refresca el UI al instante
RegisterNetEvent('DP-VehicleShop:client:refreshJobGrades', function(grades)
    SendNUIMessage({
        action = 'loadJobGrades',
        grades = grades
    })

    -- Ocultamos el formulario derecho después de guardar/borrar
    SendNUIMessage({
        action = 'closeGradeForm' -- Usaremos un truco sucio: si le pasamos una key falsa, el JS lo ignora pero igual le pasamos los rangos. JS ya tiene la función `closeGradeForm` vinculada al HTML.
    })
end)

-- Recibe la orden del servidor cuando un coche pierde stock tras una compra
RegisterNetEvent('DP-VehicleShop:client:updateStockCount', function(model, newStock)
    -- Le decimos al NUI (Javascript) que el stock de este coche ha cambiado en tiempo real
    SendNUIMessage({
        action = 'updateStockLive',
        model = model,
        stock = newStock
    })
end)

-- =================================================================
-- ENTREGA DE VEHÍCULO FÍSICO (SACAR DEL CONCESIONARIO)
-- =================================================================
-- Añadido el parámetro 'extras' al final
RegisterNetEvent('DP-VehicleShop:client:spawnPurchasedVehicle', function(modelName, plate, colorId, dealerId, extras)
    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig or not dealerConfig.ExitSpawnPoints then
        return
    end

    local spawnPoint = nil

    -- 1. SISTEMA ANTI-COLISIONES: Buscamos qué punto está completamente libre
    for _, point in ipairs(dealerConfig.ExitSpawnPoints) do
        local isOccupied = IsAnyVehicleNearPoint(point.x, point.y, point.z, 3.0)
        if not isOccupied then
            spawnPoint = point
            break
        end
    end

    if not spawnPoint then
        spawnPoint = dealerConfig.ExitSpawnPoints[1]
        if Config.Framework == 'qbcore' then
            Framework.Core.Functions.Notify('La zona de entrega estaba ocupada. ¡Cuidado con las colisiones!',
                'warning', 5000)
        end
    end

    -- 2. CARGA DEL MODELO
    local modelHash = GetHashKey(modelName)
    RequestModel(modelHash)
    local timeout = 0
    while not HasModelLoaded(modelHash) and timeout < 2000 do
        Wait(10)
        timeout = timeout + 10
    end

    if not HasModelLoaded(modelHash) then
        return
    end

    -- 3. CREACIÓN DEL VEHÍCULO
    local veh = CreateVehicle(modelHash, spawnPoint.x, spawnPoint.y, spawnPoint.z, spawnPoint.w, true, false)

    -- 4. PERSONALIZACIÓN BÁSICA (Matrícula y Color)
    SetEntityHeading(veh, spawnPoint.w)
    SetVehicleNumberPlateText(veh, plate)
    SetVehicleColours(veh, colorId, colorId)
    SetVehicleExtraColours(veh, colorId, colorId)

    SetVehicleModKit(veh, 0)
    SetVehicleLivery(veh, -1)

    -- A) Apagamos absolutamente todos los extras para evitar la aleatoriedad de GTA
    for i = 1, 20 do
        if DoesExtraExist(veh, i) then
            SetVehicleExtra(veh, i, 1) -- 1 = APAGAR
        end
    end

    -- B) Encendemos SOLO los extras que el servidor nos ha mandado
    if extras and type(extras) == "table" then
        for _, extraId in ipairs(extras) do
            if DoesExtraExist(veh, extraId) then
                SetVehicleExtra(veh, extraId, 0) -- 0 = ENCENDER
            end
        end
    end

    SetVehicleOnGroundProperly(veh)

    -- 5. ENTREGA AL JUGADOR
    TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)

    if Config.Framework == 'qbcore' then
        TriggerEvent("vehiclekeys:client:SetOwner", plate)
        TriggerServerEvent('qb-vehiclekeys:server:AcquireVehicleKeys', plate)
        Framework.Core.Functions.Notify('¡Disfruta de tu nuevo vehículo!', 'success', 5000)
    end

    SetModelAsNoLongerNeeded(modelHash)
end)

-- =================================================================
-- SECCIÓN 6: NUI CALLBACKS
-- =================================================================

-- Callback que llama JS cuando se pulsa Escape en el NUI
RegisterNUICallback('closeShowroomMenu', function(data, cb)
    TriggerEvent('DP-VehicleShop:client:exitShowroomMode')
    cb('ok')
end)

-- Callback para cerrar cualquier menú genérico y liberar el ratón
RegisterNUICallback('closeMenu', function(data, cb)
    isMenuOpen = false -- Forzamos el estado a cerrado
    SendNUIMessage({
        action = 'setVisible',
        status = false
    })
    SetNuiFocus(false, false) -- QUITAMOS EL CURSOR SÍ O SÍ
    cb('ok')
end)

-- Callback específico para confirmar la compra del concesionario
RegisterNUICallback('confirmPurchase', function(data, cb)
    local dealerId = data.dealerId
    if dealerId then
        TriggerServerEvent('DP-VehicleShop:server:buyDealership', dealerId)
    end
    SetMenuState(false) -- Cerramos la UI y liberamos el ratón
    cb('ok')
end)

RegisterNUICallback('requestSpawnCoords', function(data, cb)
    SendNUIMessage({
        action = 'updateCoords',
        coords = GetPlayerCoords()
    });
    cb('ok')
end)

RegisterNUICallback('notifyClient', function(data, cb)
    local msg = _L(data.messageKey or 'unknown_error')
    TriggerEvent('QBCore:Notify', msg, data.type or 'error', 5000)
    cb('ok')
end)

RegisterNUICallback('setSpawnPosition', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:setSpawn', data);
    cb('ok')
end)

RegisterNUICallback('assignVehicle', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:assignVehicle', data);
    cb('ok')
end)

RegisterNUICallback('deleteVehicle', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:deleteVehicle', data.id);
    cb('ok')
end)

RegisterNUICallback('editVehicle', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:editVehicle', data);
    cb('ok')
end)

-- Variable de control para evitar coches solapados (Fantasmas)
local currentPreviewRequestId = 0

RegisterNUICallback('previewVehicle', function(data, cb)
    local modelName = data.model
    local modelHash = GetHashKey(modelName)

    -- 1. CAPTURAR EL COLOR QUE ENVÍA JS (Si no envía nada, será 0 / Negro)
    local colorId = tonumber(data.color) or 0

    currentPreviewRequestId = currentPreviewRequestId + 1
    local myRequestId = currentPreviewRequestId

    -- 2. Si ya había un coche de prueba, lo borramos al instante
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        DeleteEntity(previewVehicleEntity)
        previewVehicleEntity = nil
    end

    -- Si el modelo no existe en el juego, no hacemos nada
    if not IsModelInCdimage(modelHash) then
        return cb('ok')
    end

    -- 3. Cargar modelo (ESTO ES LO QUE TARDA CON COCHES CUSTOM)
    RequestModel(modelHash)
    local timeout = 0
    while not HasModelLoaded(modelHash) and timeout < 1500 do
        Wait(10)
        timeout = timeout + 10
    end

    -- Si mientras FiveM estaba "pensando", el jugador hizo clic en otro coche, el ID habrá cambiado.
    -- Así que ABORTAMOS la creación de este vehículo viejo.
    if myRequestId ~= currentPreviewRequestId then
        return cb('ok')
    end

    if not HasModelLoaded(modelHash) then
        return cb('ok')
    end

    -- Por extrema seguridad, antes de dibujarlo, nos cercioramos de nuevo de que no hay nada ahí
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        DeleteEntity(previewVehicleEntity)
    end

    -- LÓGICA DE SPAWNS DINÁMICOS PARA EL VEHÍCULO
    local spawnCoords = vector4(1181.54, -3252.64, -49.5, 225.0) -- Por defecto
    local dealerConfig = Config.Dealerships[currentShowroomDealerId]

    -- Usamos preview_spawn para posicionar el vehículo
    if dealerConfig and dealerConfig.preview_spawn then
        local sp = dealerConfig.preview_spawn
        -- Nos aseguramos de capturar la rotación (w) o poner 0.0 si se olvidó ponerla
        spawnCoords = vector4(sp.x, sp.y, sp.z, sp.w or 0.0)
    end

    -- 4. Spawnear el coche SOLO EN LOCAL (isNetwork = false) usando spawnCoords.w
    previewVehicleEntity = CreateVehicle(modelHash, spawnCoords.x, spawnCoords.y, spawnCoords.z, spawnCoords.w, false,
        false)

    -- [INICIO BLOQUE DE ESTANDARIZACIÓN]
    -- 1. Aplicamos el color seleccionado (o el negro por defecto)
    SetVehicleColours(previewVehicleEntity, colorId, colorId)
    SetVehicleExtraColours(previewVehicleEntity, colorId, colorId)

    -- 2. Limpiamos cualquier librea (pegatinas/vinilos) aleatoria
    SetVehicleLivery(previewVehicleEntity, -1)

    -- 3. Reseteamos el ModKit para asegurarnos de que no hay piezas custom
    SetVehicleModKit(previewVehicleEntity, 0)

    -- 4. Desactivamos modificaciones visuales que puedan causar cambios de color en el interior o salpicadero
    SetVehicleModColor_1(previewVehicleEntity, 0, 0, 0)
    SetVehicleModColor_2(previewVehicleEntity, 0, 0)

    -- 5. Opcional pero recomendado: Forzar el color del interior y del salpicadero a negro (o el color por defecto)
    -- El color 0 suele ser negro en la mayoría de paletas
    SetVehicleInteriorColour(previewVehicleEntity, 0)
    SetVehicleDashboardColour(previewVehicleEntity, 0)

    -- 6. Limpiamos la suciedad para que siempre brille
    SetVehicleDirtLevel(previewVehicleEntity, 0.0)

    -- 7. Aseguramos que los extras estén en su estado por defecto (opcional, pero ayuda a la consistencia)
    for i = 1, 14 do
        if DoesExtraExist(previewVehicleEntity, i) then
            SetVehicleExtra(previewVehicleEntity, i, true)
        end
    end
    -- [FIN BLOQUE DE ESTANDARIZACIÓN]

    FreezeEntityPosition(previewVehicleEntity, true)

    SetModelAsNoLongerNeeded(modelHash)
    cb('ok')
end)

RegisterNUICallback('closeBossMenu', function(data, cb)
    SetNuiFocus(false, false)
    currentBossDealerId = nil
    cb('ok')
end)

RegisterNUICallback('bossAction', function(data, cb)
    if currentBossDealerId and data.action and data.amount then
        local amountNum = tonumber(data.amount)
        if amountNum and amountNum > 0 then
            TriggerServerEvent('DP-VehicleShop:server:bossAction', currentBossDealerId, data.action, amountNum)
        end
    end
    cb('ok')
end)

RegisterNUICallback('saveCategory', function(data, cb)
    if currentBossDealerId then
        TriggerServerEvent('DP-VehicleShop:server:saveCategory', currentBossDealerId, data)
    end
    cb('ok')
end)

RegisterNUICallback('deleteCategory', function(data, cb)
    if currentBossDealerId and data.id then
        -- Le decimos al servidor qué categoría hay que eliminar pasando su ID y el ID del concesionario
        TriggerServerEvent('DP-VehicleShop:server:deleteCategory', currentBossDealerId, data.id, data.name)
    end
    cb('ok')
end)

RegisterNUICallback('saveJobGrade', function(data, cb)
    if currentBossDealerId then
        -- Pasamos los datos del rango y el ID del concesionario al servidor
        TriggerServerEvent('DP-VehicleShop:server:saveJobGrade', currentBossDealerId, data)
    end
    cb('ok')
end)

RegisterNUICallback('deleteJobGrade', function(data, cb)
    if currentBossDealerId and data.grade then
        -- Le decimos al servidor qué número de rango hay que eliminar
        TriggerServerEvent('DP-VehicleShop:server:deleteJobGrade', currentBossDealerId, data.grade)
    end
    cb('ok')
end)

RegisterNUICallback('orderStock', function(data, cb)
    -- currentBossDealerId ya lo tenemos guardado en el cliente desde que abrió el menú
    if currentBossDealerId then
        TriggerServerEvent('DP-VehicleShop:server:orderStock', currentBossDealerId, data)
    end
    cb('ok')
end)

RegisterNUICallback('updateVehicleColor', function(data, cb)
    local colorId = tonumber(data.color) or 0

    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        -- Aplicamos el color primario y secundario
        SetVehicleColours(previewVehicleEntity, colorId, colorId)
        -- También el perlado para que el brillo sea coherente
        SetVehicleExtraColours(previewVehicleEntity, colorId, colorId)
    end

    cb('ok')
end)

RegisterNUICallback('reserveVehicle', function(data, cb)
    if currentShowroomDealerId then
        TriggerServerEvent('DP-VehicleShop:server:reserveVehicle', currentShowroomDealerId, data)
    end
    cb('ok')
end)

RegisterNUICallback('acceptReservation', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:acceptReservation', data.id)
    cb('ok')
end)

RegisterNUICallback('cancelReservation', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:cancelReservation', data.id)
    cb('ok')
end)

RegisterNUICallback('buyVehicle', function(data, cb)
    if currentShowroomDealerId then
        -- =================================================================
        -- ESCANEO DE EXTRAS ANTES DE COMPRAR
        -- =================================================================
        local appliedExtras = {}
        if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
            for i = 1, 20 do
                if DoesExtraExist(previewVehicleEntity, i) then
                    -- Si la pieza existe y está encendida (0 o true según la build), la guardamos
                    if IsVehicleExtraTurnedOn(previewVehicleEntity, i) == 1 or
                        IsVehicleExtraTurnedOn(previewVehicleEntity, i) == true then
                        table.insert(appliedExtras, i)
                    end
                end
            end
        end

        -- Le inyectamos la lista de extras al paquete de datos que va al servidor
        data.extras = appliedExtras
        -- =================================================================

        -- 1. Enviamos la orden de compra al servidor (con el método de pago, plazos y ahora EXTRAS)
        TriggerServerEvent('DP-VehicleShop:server:buyShowroomVehicle', currentShowroomDealerId, data)

        -- 2. Cerramos el modo Showroom (restaura la cámara, quita la invisibilidad, etc.)
        TriggerEvent('DP-VehicleShop:client:exitShowroomMode')

        -- 3. Forzamos el cierre de la interfaz NUI y quitamos el cursor
        isMenuOpen = false
        SendNUIMessage({
            action = 'setVisible',
            status = false
        })
    end
    cb('ok')
end)

RegisterNUICallback('requestVehicleExtras', function(_, cb)
    local vehicle = previewVehicleEntity -- Usamos tu variable global de la entidad

    if not vehicle or not DoesEntityExist(vehicle) then
        cb('ok')
        return
    end

    local availableExtras = {}

    -- Escaneamos los IDs del 1 al 20 (rango amplio para coches custom)
    for i = 1, 20 do
        if DoesExtraExist(vehicle, i) then
            table.insert(availableExtras, {
                id = i,
                enabled = IsVehicleExtraTurnedOn(vehicle, i) == 1 or IsVehicleExtraTurnedOn(vehicle, i) == true
            })
        end
    end

    -- Enviamos la lista de vuelta al Javascript
    SendNUIMessage({
        action = 'loadVehicleExtras',
        extras = availableExtras
    })

    cb('ok')
end)

RegisterNUICallback('toggleVehicleExtra', function(data, cb)
    local vehicle = previewVehicleEntity

    if not vehicle or not DoesEntityExist(vehicle) then
        cb('ok')
        return
    end

    local extraId = tonumber(data.extraId)
    local state = data.state -- Viene como true (encender) o false (apagar)

    if extraId then
        -- La nativa SetVehicleExtra usa: 0 para ACTIVAR y 1 para DESACTIVAR
        -- O en algunas versiones de FiveM: false para encender, true para apagar
        if state then
            SetVehicleExtra(vehicle, extraId, 0)
        else
            SetVehicleExtra(vehicle, extraId, 1)
        end
    end

    cb('ok')
end)

-- =================================================================
-- SECCIÓN 7: HILOS DE EJECUCIÓN OPTIMIZADOS
-- =================================================================

CreateThread(function()
    while true do
        Wait(0)
        if isMenuOpen and IsControlJustReleased(0, 200) then
            SetMenuState(false)
        end
    end
end)

-- [HILO 1: SELECTOR LENTO]
-- Ajustado a 8.0 metros para reducir candidatos.
CreateThread(function()
    while true do
        local myCoords = GetEntityCoords(PlayerPedId())
        nearbyVehicles = {}
        local count = 0

        for id, data in pairs(spawnedShowroomVehicles) do
            if DoesEntityExist(data.entity) then
                local dist = #(myCoords - GetEntityCoords(data.entity))
                -- [OPTIMIZACIÓN] Reducido de 15.0 a 8.0 para procesar menos
                if dist < 8.0 then
                    count = count + 1
                    nearbyVehicles[count] = {
                        id = id,
                        entity = data.entity,
                        info = data.info
                    }
                end
            end
        end

        Wait(400) -- Ejecutar menos veces por segundo (aprox 2.5 veces)
    end
end)

-- [HILO 2: RENDERIZADOR RÁPIDO]
CreateThread(function()
    while true do
        local sleep = 1000

        -- Solo si hay vehículos en el "pool" cercano
        if #nearbyVehicles > 0 then
            local myCoords = GetEntityCoords(PlayerPedId())
            local visibleVehicles = {}
            local shouldSendUpdate = false
            local index = 0

            for i = 1, #nearbyVehicles do
                local data = nearbyVehicles[i]
                local vehCoords = GetEntityCoords(data.entity)
                local dist = #(myCoords - vehCoords)

                -- Si estamos cerca, activamos modo frame
                if dist < 5.0 then
                    sleep = 0

                    -- Solo calculamos pantalla si estamos en rango visual
                    if dist < 3.5 then
                        local tagHeight = vehCoords.z + 1.2
                        local onScreen, screenX, screenY = GetScreenCoordFromWorldCoord(vehCoords.x, vehCoords.y,
                            tagHeight)

                        if onScreen then
                            index = index + 1
                            visibleVehicles[index] = {
                                id = data.id,
                                display_name = data.info.display_name,
                                spawn_name = data.info.spawn_name,
                                setter_name = data.info.setter_name,
                                price = data.info.price,
                                x = screenX,
                                y = screenY
                            }
                            shouldSendUpdate = true
                        end
                    end
                end
            end

            if shouldSendUpdate then
                SendNUIMessage({
                    action = 'updateHUD',
                    vehicles = visibleVehicles
                })
                isHudActive = true
            elseif isHudActive then
                -- Limpieza si nos alejamos
                SendNUIMessage({
                    action = 'updateHUD',
                    vehicles = {}
                })
                isHudActive = false
            end
        else
            -- Limpieza si la lista de cercanos se vacía
            if isHudActive then
                SendNUIMessage({
                    action = 'updateHUD',
                    vehicles = {}
                })
                isHudActive = false
            end
        end

        Wait(sleep)
    end
end)

-- [HILO 3: SPAWNER POR PROXIMIDAD]
-- Solo spawnea los coches físicos si estás a menos de 100 metros
CreateThread(function()
    while true do
        local myCoords = GetEntityCoords(PlayerPedId())

        for _, vData in pairs(ShowroomVehicleData) do
            if vData.spawn_x then
                local vehCoords = vector3(tonumber(vData.spawn_x), tonumber(vData.spawn_y), tonumber(vData.spawn_z))
                local dist = #(myCoords - vehCoords)

                -- Si estamos a menos de 100 metros del concesionario
                if dist < 100.0 then
                    -- Si NO está spawneado en el mundo, lo creamos
                    if not spawnedShowroomVehicles[vData.id] then
                        SpawnShowroomVehicle(vData)
                    end
                else
                    -- Si nos alejamos y SÍ está spawneado, lo borramos para liberar memoria
                    if spawnedShowroomVehicles[vData.id] then
                        DeleteSpecificShowroomVehicle(vData.id)
                    end
                end
            end
        end
        Wait(2000) -- Revisa las distancias cada 2 segundos (0 lag)
    end
end)

-- =================================================================
-- SECCIÓN 8: ZONAS DE INTERACCIÓN (TEXTUI Y TECLAS) - OPTIMIZADA
-- =================================================================

CreateThread(function()
    while true do
        local sleep = 1000
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        local inZone = false
        local zoneId = nil
        local zoneText = ""

        -- Recorremos todos los concesionarios configurados
        for dealerName, data in pairs(Config.Dealerships) do

            -- 1. Comprobar distancia al NPC (Para gestionar los coches)
            if data.coords_npc then
                -- Usamos .xyz directo para no crear vectores nuevos cada frame (0 lag)
                local distNPC = #(pos - data.coords_npc.xyz)

                if distNPC < 2.5 then
                    sleep = 0
                    inZone = true
                    zoneId = "npc_" .. dealerName
                    zoneText = "Hablar con el Vendedor"

                    -- Si presiona la E
                    if IsControlJustReleased(0, 38) then
                        TriggerServerEvent('DP-VehicleShop:server:requestShowroom', dealerName)
                    end
                    break -- Salimos del bucle para no procesar más zonas si ya estamos en una
                end
            end

            -- 2. Comprobar Boss Menu (SE OCULTA TOTALMENTE SI NO ERES DUEÑO O JEFE)
            if data.bossMenu then
                -- Calculamos distancia PRIMERO
                local distBoss = #(pos - data.bossMenu.xyz)

                -- SOLO si estamos a menos de 10 metros, comprobamos si eres jefe
                if distBoss < 10.0 then
                    if IsPlayerAuthorized(dealerName, data) then
                        sleep = 0
                        -- Marker Verde
                        DrawMarker(2, data.bossMenu.x, data.bossMenu.y, data.bossMenu.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                            0.2, 0.2, 0.2, 0, 0, 0, 255, false, false, 2, true, nil, nil, false)

                        if distBoss < 1.5 then
                            inZone = true
                            zoneId = "boss_" .. dealerName
                            zoneText = "Gestión de Empresa"

                            if IsControlJustReleased(0, 38) then
                                TriggerServerEvent('DP-VehicleShop:server:requestBossMenu', dealerName)
                            end
                            break
                        end
                    end
                end
            end

            -- 3. Comprobar NPC de Compra (SOLO APARECE TEXTUI SI NO TIENE DUEÑO)
            if data.npc_buy and not DealerOwners[dealerName] then
                local distBuy = #(pos - data.npc_buy.xyz)

                if distBuy < 2.5 then
                    sleep = 0
                    inZone = true
                    zoneId = "buy_" .. dealerName
                    zoneText = "Comprar Empresa (" .. data.label .. ")"

                    if IsControlJustReleased(0, 38) then
                        isMenuOpen = true
                        SendNUIMessage({
                            action = 'openBuyMenu',
                            dealerId = dealerName,
                            dealerLabel = data.label,
                            price = Config.DefaultDealershipPrice
                        })
                        SetNuiFocus(true, true)
                    end
                    break
                end
            end
        end

        -- =================================================================
        -- LÓGICA DE MOSTRAR/OCULTAR DP-TextUI (SIN BUCLES)
        -- =================================================================
        if inZone then
            -- Si la zona ha cambiado O el texto ha cambiado (por una compra)
            if currentActiveZone ~= zoneId or currentActiveText ~= zoneText then

                -- Si ya había algo mostrándose, lo borramos primero
                if currentActiveZone then
                    exports['DP-TextUI']:OcultarUI(currentActiveZone)
                end

                -- Guardamos el nuevo estado y mostramos
                currentActiveZone = zoneId
                currentActiveText = zoneText
                exports['DP-TextUI']:MostrarUI(zoneId, zoneText, 'E', false)
            end
        elseif not inZone and currentActiveZone then
            -- Si salimos de la zona, limpiamos todo
            exports['DP-TextUI']:OcultarUI(currentActiveZone)
            currentActiveZone = nil
            currentActiveText = nil
        end

        Wait(sleep)
    end
end)
