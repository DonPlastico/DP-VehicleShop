-- =================================================================
-- MÓDULO 1: VARIABLES GLOBALES Y ESTADO
-- =================================================================
-- OPTIMIZACIÓN: CACHÉ DE NATIVAS (Esto mejora el rendimiento drásticamente)
local isMenuOpen = false
local spawnedShowroomVehicles = {}
local nearbyVehicles = {}
local isHudActive = false
local spawnedNPCs = {}
local spawnedProps = {} -- Para almacenar los Objetos (Props) que se spawneen
local showroomCam = nil
local previewVehicleEntity = nil
local DealerOwners = {}
local spawnedAgencyNPCs = {}
local currentActiveZone = nil
local currentActiveText = nil
local allShowroomZoneIds = {} -- Tracking de TODOS los zoneIds de showroom mostrados
local currentBossDealerId = nil
local currentShowroomDealerId = nil
local ShowroomVehicleData = {}
local currentPreviewRequestId = 0
local currentPreviewCameraMode = 'exterior'
local currentInteriorCamHeading = 0.0
local currentPreviewFOV = 50.0
local PlayerData = {}
local PlayerJob = {}
local Framework = {}
local currentPreviewRequestId = 0
local baseCamCoords = nil
local baseCamRot = nil
local baseCamFOV = nil
local prePlateHeading = nil
local testDriveReturnCoords = nil -- Coordenadas del NPC para volver al terminar
local testDriveVehicle = nil -- Entidad del coche de prueba
local testDriveActive = false -- Flag para el hilo de vigilancia
local testDriveTimer = 0 -- Segundos restantes
local dealerBlips = {} -- Guardamos los blips en memoria para borrarlos al reiniciar
local dealersFromDB = {} -- Concesionarios cargados desde la base de datos (para los blips)
local dealerConfigsFromDB = {} -- Configuración completa de concesionarios desde la BD

-- Posiciones relativas en el remolque tr2 (Capacidad 6 coches)
local trailerOffsets = { -- PLANTA BAJA
vector3(0.0, 4.2, 1.1), -- 1. Abajo Frontal
vector3(0.0, 0.0, 1.35), -- 2. Abajo Medio
vector3(0.0, -4.5, 1.1), -- 3. Abajo Trasero
-- PLANTA ALTA
vector3(0.0, 4.2, 3.0), -- 4. Arriba Frontal
vector3(0.0, 0.0, 3.1), -- 5. Arriba Medio
vector3(0.0, -4.5, 3.0) -- 6. Arriba Trasero
}

-- =================================================================
-- MÓDULO 2: CARGA DINÁMICA DEL FRAMEWORK (SOLO QB-CORE)
-- =================================================================
Framework.Core = exports['qb-core']:GetCoreObject()

-- =================================================================
-- MÓDULO 3: FUNCIONES AUXILIARES Y DATOS DEL JUGADOR (CACHÉ)
-- =================================================================

-- Guardamos los datos del jugador una sola vez para evitar 0.99 ms de lag
local function UpdateLocalPlayerData()
    if Framework.Core then
        PlayerData = Framework.Core.Functions.GetPlayerData()
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

    if PlayerData and PlayerData.citizenid and DealerOwners[dealerName] == PlayerData.citizenid then
        isOwner = true
    end

    local jobName = dealerConfig.job
    if not jobName and dealerConfigsFromDB and dealerConfigsFromDB[dealerName] then
        jobName = dealerConfigsFromDB[dealerName].job
    end
    if PlayerJob and jobName and PlayerJob.name == jobName and PlayerJob.isboss then
        isBoss = true
    end

    return isOwner or isBoss
end

-- =================================================================
-- MÓDULO 4: GESTIÓN DEL MENÚ NUI
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
-- MÓDULO 5: GESTIÓN DE ENTIDADES (VEHÍCULOS DEL ESCAPARATE)
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
-- MÓDULO 6: GESTIÓN DE ENTIDADES ESTATÍCAS (NPCs Y OBJETOS)
-- =================================================================

local function SpawnDealershipEntities()
    -- 1. Spawn dinámico desde la configuración de la BD para puntos de showroom
    for dealerId, config in pairs(dealerConfigsFromDB) do
        if config and type(config.showroomPoints) == 'table' and #config.showroomPoints > 0 then
            for index, point in ipairs(config.showroomPoints) do
                local key = dealerId .. '_showroom_' .. index
                local pType = point.type or 'npc'

                if point.coords_npc then
                    local x = tonumber(point.coords_npc.x) or 0.0
                    local y = tonumber(point.coords_npc.y) or 0.0
                    local z = tonumber(point.coords_npc.z) or 0.0
                    local h = tonumber(point.coords_npc.h) or 0.0

                    -- TIPO: NPC
                    if pType == 'npc' and point.npc_model and not spawnedNPCs[key] then
                        local model = GetHashKey(point.npc_model)
                        if IsModelInCdimage(model) and IsModelValid(model) then
                            RequestModel(model)
                            local timeout = 0
                            while not HasModelLoaded(model) and timeout < 1500 do
                                Wait(10)
                                timeout = timeout + 1
                            end
                            if HasModelLoaded(model) then
                                local ped = CreatePed(0, model, x, y, z - 1.0, h, false, false)
                                SetEntityHeading(ped, h)
                                FreezeEntityPosition(ped, true)
                                SetEntityInvincible(ped, true)
                                SetBlockingOfNonTemporaryEvents(ped, true)
                                if point.npc_scenario and point.npc_scenario ~= "" then
                                    TaskStartScenarioInPlace(ped, point.npc_scenario, 0, true)
                                end
                                spawnedNPCs[key] = ped
                                SetModelAsNoLongerNeeded(model)
                            end
                        end
                        -- TIPO: OBJETO (PROP)
                    elseif pType == 'prop' and point.prop_model and not spawnedProps[key] then
                        local model = GetHashKey(point.prop_model)
                        if IsModelInCdimage(model) and IsModelValid(model) then
                            RequestModel(model)
                            local timeout = 0
                            while not HasModelLoaded(model) and timeout < 1500 do
                                Wait(10)
                                timeout = timeout + 1
                            end
                            if HasModelLoaded(model) then
                                local prop = CreateObject(model, x, y, z, false, false, false)
                                SetEntityHeading(prop, h)
                                FreezeEntityPosition(prop, true)
                                spawnedProps[key] = prop
                                SetModelAsNoLongerNeeded(model)
                            end
                        end
                    end
                end
            end
        end
    end

    -- 2. Entidad Agencia (Agente inmobiliario o Prop para COMPRAR la empresa)
    for dealerKey, config in pairs(dealerConfigsFromDB) do
        -- Si no tiene dueño y en la DB está configurado el npc_buy
        if not DealerOwners[dealerKey] and config.npc_buy then
            local bp = config.npc_buy
            local bType = bp.type or 'npc'
            local x = tonumber(bp.x) or 0.0
            local y = tonumber(bp.y) or 0.0
            local z = tonumber(bp.z) or 0.0
            local h = tonumber(bp.w) or 0.0

            if bType == 'npc' and not spawnedAgencyNPCs[dealerKey] then
                local model = GetHashKey(bp.npc_model or 'a_m_y_business_03')
                if IsModelInCdimage(model) and IsModelValid(model) then
                    RequestModel(model)
                    local timeout = 0
                    while not HasModelLoaded(model) and timeout < 1500 do
                        Wait(10)
                        timeout = timeout + 1
                    end
                    if HasModelLoaded(model) then
                        local ped = CreatePed(0, model, x, y, z - 1.0, h, false, false)
                        SetEntityHeading(ped, h)
                        FreezeEntityPosition(ped, true)
                        SetEntityInvincible(ped, true)
                        SetBlockingOfNonTemporaryEvents(ped, true)
                        TaskStartScenarioInPlace(ped, bp.npc_scenario or "WORLD_HUMAN_CLIPBOARD", 0, true)
                        spawnedAgencyNPCs[dealerKey] = ped
                        SetModelAsNoLongerNeeded(model)
                    end
                end
            elseif bType == 'prop' and bp.prop_model and not spawnedProps[dealerKey .. '_buy'] then
                local model = GetHashKey(bp.prop_model)
                if IsModelInCdimage(model) and IsModelValid(model) then
                    RequestModel(model)
                    local timeout = 0
                    while not HasModelLoaded(model) and timeout < 1500 do
                        Wait(10)
                        timeout = timeout + 1
                    end
                    if HasModelLoaded(model) then
                        local prop = CreateObject(model, x, y, z, false, false, false)
                        SetEntityHeading(prop, h)
                        FreezeEntityPosition(prop, true)
                        spawnedProps[dealerKey .. '_buy'] = prop
                        SetModelAsNoLongerNeeded(model)
                    end
                end
            end
        end
    end
end

-- Función para borrar entidades de forma segura
local function DeleteDealershipEntities()
    for k, ped in pairs(spawnedNPCs) do
        if DoesEntityExist(ped) then
            DeleteEntity(ped)
        end
    end
    spawnedNPCs = {}

    for k, prop in pairs(spawnedProps) do
        if DoesEntityExist(prop) then
            DeleteEntity(prop)
        end
    end
    spawnedProps = {}

    for k, ped in pairs(spawnedAgencyNPCs) do
        if DoesEntityExist(ped) then
            DeleteEntity(ped)
        end
    end
    spawnedAgencyNPCs = {}
end

-- =================================================================
-- Función para cargar modelos de forma segura (usada para NPCs y vehículos de exposición)
-- =================================================================
local function LoadModel(modelName)
    local hash = GetHashKey(modelName)
    RequestModel(hash)
    while not HasModelLoaded(hash) do
        Wait(10)
    end
    return hash
end

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() == resourceName then

        -- 1. Borrar los blips fantasma del mapa
        for _, blip in ipairs(dealerBlips) do
            if DoesBlipExist(blip) then
                RemoveBlip(blip)
            end
        end

        -- 2. Restaurar HUD, Chat y Voz a la normalidad
        exports['DP-Hud']:ToggleVisibility(true)
        TriggerEvent('chat:client:showChat', true)
        TriggerEvent('bcs-voice-ui:client:showVoice', true)

        -- 3. Liberar el ratón y el teclado del jugador por si estaba en un menú
        SetNuiFocus(false, false)

        -- 4. Ocultar el TextUI activo si lo hay
        if currentActiveZone then
            exports['DP-TextUI']:OcultarUI(currentActiveZone)
            currentActiveZone = nil
            currentActiveText = nil
        end
    end
end)

-- =================================================================
-- PRUEBA DE MANEJO (TEST DRIVE)
-- =================================================================

-- Función para limpiar y volver al showroom
local function EndTestDrive()
    if not testDriveActive then
        return
    end
    testDriveActive = false

    local ped = PlayerPedId()

    -- Restaurar vulnerabilidad del jugador al estado normal
    SetPlayerInvincible(PlayerId(), false)
    SetPedCanBeKnockedOffVehicle(ped, 0) -- 0 = Default (Se puede caer)

    -- 1. Ocultar HUD
    SendNUIMessage({
        action = 'hideTestDriveHUD'
    })

    -- 2. Borrar coche de prueba al instante (Sin delays)
    if testDriveVehicle and DoesEntityExist(testDriveVehicle) then
        ClearPedTasksImmediately(ped) -- Cortamos en seco la animación de bajarse
        DeleteEntity(testDriveVehicle)
        testDriveVehicle = nil
    end

    -- 3. Avisar al servidor para que devuelva al jugador al bucket 0
    TriggerServerEvent('DP-VehicleShop:server:endTestDrive')
end

-- =================================================================
-- MÓDULO 7: INICIALIZACIÓN Y SISTEMA ANTI-BUGS
-- =================================================================

local function InitializeClientLoad()
    -- Forzar reset del TextUI para que el loop lo redibuje desde cero
    currentActiveZone = nil
    currentActiveText = nil

    UpdateLocalPlayerData()
    TriggerServerEvent('DP-VehicleShop:server:getVehicles')
    TriggerServerEvent('DP-VehicleShop:server:getSpawns')
    TriggerServerEvent('DP-VehicleShop:server:requestOwners')
    TriggerServerEvent('DP-VehicleShop:server:requestBlips')
end

-- AÑADE ESTOS EVENTOS JUSTO AQUÍ (Para actualizar si cambias de trabajo en vivo)
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(JobInfo)
    PlayerJob = JobInfo
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(val)
    PlayerData = val
end)

-- Cuando el script se reinicia en vivo
AddEventHandler('onResourceStart', function(resourceName)
    if GetCurrentResourceName() == resourceName then
        CreateThread(function()
            Wait(2000) -- Esperamos a que la base de datos responda
            InitializeClientLoad()
            -- Forzamos spawn si el servidor ya envió los datos
            SpawnDealershipEntities()
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
        DeleteDealershipEntities()

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
-- MÓDULO 8: EVENTOS DE RED - MENÚ DE GESTIÓN Y ESCAPARATE
-- =================================================================

RegisterNetEvent('DP-VehicleShop:client:openMenu', function()
    SetMenuState(true)
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

-- =================================================================
-- MÓDULO 9: EVENTOS DE RED - SHOWROOM (CATÁLOGO DE CLIENTES)
-- =================================================================

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

    -- OCULTAR HUD Y VOZ (El chat ya se oculta arriba en la línea 335)
    exports['DP-Hud']:ToggleVisibility(false)
    TriggerEvent('bcs-voice-ui:client:showVoice', false)
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

    -- MOSTRAR HUD Y VOZ DE NUEVO
    exports['DP-Hud']:ToggleVisibility(true)
    TriggerEvent('bcs-voice-ui:client:showVoice', true)
end)

-- 2. Apertura del Showroom (CON ESCANEO TÉCNICO)
RegisterNetEvent('DP-VehicleShop:client:openShowroom', function(dealerId, categories, vehicles, myReservations)
    -- Guardamos el ID del concesionario actual
    currentShowroomDealerId = dealerId

    -- Guardamos coords AHORA, antes de cualquier TP, para el test drive
    local p = PlayerPedId()
    local pos = GetEntityCoords(p)
    testDriveReturnCoords = vector4(pos.x, pos.y, pos.z, GetEntityHeading(p))

    -- Recorremos el stock y pedimos al motor del juego los datos de cada modelo
    for i = 1, #vehicles do
        local modelHash = GetHashKey(vehicles[i].model)

        -- 1. Velocidad Máxima (Convertimos de m/s a KM/H)
        -- Usamos la velocidad teórica del handling del modelo
        local maxSpeedMS = GetVehicleModelMaxSpeed(modelHash)
        vehicles[i].maxSpeed = math.ceil(maxSpeedMS * 3.6)

        -- 2. Cantidad de Asientos
        vehicles[i].seats = GetVehicleModelNumberOfSeats(modelHash)
    end

    -- Enviamos tus reservas activas al Javascript
    SendNUIMessage({
        action = 'loadMyReservations',
        myReservations = myReservations or {}
    })

    -- 1. Pasamos las categorías al Javascript
    SendNUIMessage({
        action = 'loadCategories',
        categories = categories
    })

    -- 1.5. Pasamos los coches reales al catálogo (AHORA CON DATOS TÉCNICOS)
    SendNUIMessage({
        action = 'loadBossStock',
        vehicles = vehicles
    })

    -- 2. Recuperamos el nombre del concesionario
    local dealerLabel = (Config.Dealerships[dealerId] and Config.Dealerships[dealerId].label) or dealerId

    -- 3. Iniciamos el modo Showroom (Cámaras y posición)
    TriggerEvent('DP-VehicleShop:client:enterShowroomMode', dealerLabel)
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
RegisterNetEvent('DP-VehicleShop:client:spawnPurchasedVehicle', function(modelName, plate, colorData, dealerId, extras)
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
        Framework.Core.Functions.Notify('La zona de entrega estaba ocupada. ¡Cuidado con las colisiones!', 'warning',
            5000)
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

    if type(colorData) == 'table' then
        local r, g, b = tonumber(colorData.r), tonumber(colorData.g), tonumber(colorData.b)
        SetVehicleCustomPrimaryColour(veh, r, g, b)
        SetVehicleCustomSecondaryColour(veh, r, g, b)
    else
        local cId = tonumber(colorData) or 0
        SetVehicleColours(veh, cId, cId)
        SetVehicleExtraColours(veh, cId, cId)
    end

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

    -- 5. ENTREGA AL JUGADOR (MODIFICADO PARA NO ROMPER EL UI)
    -- TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1) -- <-- BLOQUEAMOS EL TP

    -- Hacemos que el vehículo sea persistente para que no desaparezca si miras a otro lado
    SetEntityAsMissionEntity(veh, true, true)

    TriggerEvent("vehiclekeys:client:SetOwner", plate)
    TriggerServerEvent('qb-vehiclekeys:server:AcquireVehicleKeys', plate)

    -- Notificación adaptada
    Framework.Core.Functions.Notify('Vehículo entregado en la puerta con matrícula: ' .. plate, 'success', 7500)

    SetModelAsNoLongerNeeded(modelHash)
end)

-- =================================================================
-- MÓDULO 10: EVENTOS DE RED - BOSS MENU
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

    -- OCULTAR HUD, CHAT Y VOZ
    exports['DP-Hud']:ToggleVisibility(false)
    TriggerEvent('chat:client:showChat', false)
    TriggerEvent('bcs-voice-ui:client:showVoice', false)
end)

RegisterNetEvent('DP-VehicleShop:client:updateBossData', function(balance, transactions, sales, discounts)
    SendNUIMessage({
        action = 'updateBossData',
        balance = balance,
        transactions = transactions,
        sales = sales,
        discounts = discounts -- <-- ESTO ES VITAL PARA QUE LLEGUE AL JS
    })
end)

-- Actualiza únicamente la tabla de descuentos en la UI
RegisterNetEvent('DP-VehicleShop:client:updateDiscounts')
AddEventHandler('DP-VehicleShop:client:updateDiscounts', function(discountsData)
    SendNUIMessage({
        action = 'updateDiscounts',
        discounts = discountsData
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
    SpawnDealershipEntities()
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

-- Evento que recibe la orden del servidor para desplegar la interfaz (Con datos de la BD)
RegisterNetEvent('DP-VehicleShop:client:openAdminMenu', function(dealers)
    -- Activamos el foco del NUI (ratón y teclado) en el juego
    SetNuiFocus(true, true)

    -- Enviamos la acción al archivo de JavaScript (script.js) pasando la tabla de concesionarios
    SendNUIMessage({
        action = 'openAdminConfigMenu',
        dealers = dealers
    })
end)

-- Evento que inicia la ruta de entrega de vehículos por NPC (Logística)
RegisterNetEvent('DP-VehicleShop:client:StartNPCDelivery', function(dealerId, vehiclesBatch)
    print('=================================================================')
    print('^2[DP-LOGISTICA]^7 INICIANDO RUTA COMPLETA DE ENTREGA.')
    print('^2[DP-LOGISTICA]^7 Vehículos en cola: ' .. tostring(#vehiclesBatch))
    print('=================================================================')

    CreateThread(function()
        local dealerConfig = Config.Dealerships[dealerId]
        if not dealerConfig or not dealerConfig.Logistics then
            return
        end
        local logis = dealerConfig.Logistics

        local pedModel = LoadModel('mp_f_bennymech_01')
        local truckModel = LoadModel('packer')
        local trailerModel = LoadModel('tr2')

        -- 1. SPAWN CAMIÓN Y REMOLQUE
        local truck = CreateVehicle(truckModel, logis.truckSpawn.x, logis.truckSpawn.y, logis.truckSpawn.z,
            logis.truckSpawn.w, true, false)
        local trailer = CreateVehicle(trailerModel, logis.truckSpawn.x - 10.0, logis.truckSpawn.y, logis.truckSpawn.z,
            logis.truckSpawn.w, true, false)

        SetEntityAsMissionEntity(truck, true, true)
        SetEntityAsMissionEntity(trailer, true, true)

        -- Fijar el remolque al camión con físicas REALES de camión articulado
        AttachVehicleToTrailer(truck, trailer, 10.0)

        -- Bucle vigía: Si el remolque se suelta por un choque o bache, lo re-enganchamos al instante
        local isRouteActive = true
        CreateThread(function()
            while isRouteActive and DoesEntityExist(trailer) and DoesEntityExist(truck) do
                local hasTrailer, attachedTrailer = GetVehicleTrailerVehicle(truck)
                if not hasTrailer or attachedTrailer ~= trailer then
                    AttachVehicleToTrailer(truck, trailer, 10.0)
                end
                Wait(1000)
            end
        end)

        -- 2. SPAWN CONDUCTOR
        local driver = CreatePed(4, pedModel, logis.truckSpawn.x + 3.0, logis.truckSpawn.y + 3.0, logis.truckSpawn.z,
            0.0, true, false)
        SetEntityAsMissionEntity(driver, true, true)
        SetBlockingOfNonTemporaryEvents(driver, true)
        SetPedKeepTask(driver, true)
        SetPedCanBeDraggedOut(driver, false)

        SetModelAsNoLongerNeeded(pedModel)
        SetModelAsNoLongerNeeded(truckModel)
        SetModelAsNoLongerNeeded(trailerModel)

        -- 3. CARGA DE VEHÍCULOS (CONCESIONARIO)
        -- ★ FIX: Le damos 60 segundos de paciencia al NPC para caminar y subirse (60000ms)
        TaskEnterVehicle(driver, truck, 60000, -1, 2.0, 1, 0)
        local timeout = 0
        while not IsPedInVehicle(driver, truck, false) and timeout < 60 do
            Wait(1000)
            timeout = timeout + 1
        end
        if not IsPedInVehicle(driver, truck, false) then
            TaskWarpPedIntoVehicle(driver, truck, -1)
        end

        TaskVehicleDriveToCoordLongrange(driver, truck, logis.loadingZone.x, logis.loadingZone.y, logis.loadingZone.z,
            15.0, 2883621, 5.0)
        timeout = 0
        while #(GetEntityCoords(truck) - vector3(logis.loadingZone.x, logis.loadingZone.y, logis.loadingZone.z)) > 15.0 and
            timeout < 600 do
            Wait(1000)
            timeout = timeout + 1
        end
        TaskVehicleTempAction(driver, truck, 27, 3000)
        Wait(3000)

        local loadedCarsEntities = {}

        for i, vData in ipairs(vehiclesBatch) do
            if i > 6 then
                break
            end

            local carHash = LoadModel(vData.model)
            local car = CreateVehicle(carHash, logis.carSpawn.x, logis.carSpawn.y, logis.carSpawn.z, logis.carSpawn.w,
                true, false)
            SetEntityAsMissionEntity(car, true, true)
            SetVehicleNumberPlateText(car, vData.plate)

            if type(vData.color) == 'table' then
                SetVehicleCustomPrimaryColour(car, tonumber(vData.color.r), tonumber(vData.color.g),
                    tonumber(vData.color.b))
                SetVehicleCustomSecondaryColour(car, tonumber(vData.color.r), tonumber(vData.color.g),
                    tonumber(vData.color.b))
            else
                local cId = tonumber(vData.color) or 0
                SetVehicleColours(car, cId, cId)
                SetVehicleExtraColours(car, cId, cId)
            end

            SetVehicleModKit(car, 0)
            for j = 1, 20 do
                if DoesExtraExist(car, j) then
                    SetVehicleExtra(car, j, 1)
                end
            end
            if vData.extras then
                for _, extraId in ipairs(vData.extras) do
                    if DoesExtraExist(car, extraId) then
                        SetVehicleExtra(car, extraId, 0)
                    end
                end
            end
            SetVehicleOnGroundProperly(car)

            -- ★ FIX: Que se baje solo si está dentro de un vehículo (Para que no se buguee si ya está a pie)
            local currentVeh = GetVehiclePedIsIn(driver, false)
            if currentVeh ~= 0 then
                TaskLeaveVehicle(driver, currentVeh, 0)
                Wait(2000)
            end

            -- ★ FIX: 60 segundos de paciencia para caminar hacia el coche recién spawneado
            TaskEnterVehicle(driver, car, 60000, -1, 2.0, 1, 0)

            timeout = 0
            while not IsPedInVehicle(driver, car, false) and timeout < 60 do
                Wait(1000)
                timeout = timeout + 1
            end
            if not IsPedInVehicle(driver, car, false) then
                TaskWarpPedIntoVehicle(driver, car, -1)
            end

            local trailerRear = GetOffsetFromEntityInWorldCoords(trailer, 0.0, -15.0, 0.0)
            TaskVehicleDriveToCoord(driver, car, trailerRear.x, trailerRear.y, trailerRear.z, 10.0, 0, carHash, 2883621,
                5.0)

            timeout = 0
            while #(GetEntityCoords(car) - trailerRear) > 8.0 and timeout < 300 do
                Wait(1000)
                timeout = timeout + 1
            end

            local offset = trailerOffsets[i]
            AttachEntityToEntity(car, trailer, 0, offset.x, offset.y, offset.z, 0.0, 0.0, 0.0, false, false, false,
                false, 2, true)
            table.insert(loadedCarsEntities, car)
            SetModelAsNoLongerNeeded(carHash)

            TaskLeaveVehicle(driver, car, 0)
            Wait(2000)
        end

        -- 4. VIAJE HASTA EL GARAJE (PLAZA CUBOS / CENTRAL)
        print('^3[DP-LOGISTICA]^7 Vehículos cargados. Iniciando ruta hasta el Garaje Central (Plaza Cubos)...')

        -- ★ FIX: 60 segundos para volver al camión
        TaskEnterVehicle(driver, truck, 60000, -1, 2.0, 1, 0)
        timeout = 0
        while not IsPedInVehicle(driver, truck, false) and timeout < 60 do
            Wait(1000)
            timeout = timeout + 1
        end
        if not IsPedInVehicle(driver, truck, false) then
            TaskWarpPedIntoVehicle(driver, truck, -1)
        end

        -- Coordenadas de Plaza Cubos (Garaje Central) - ZONA AMPLIA BAJO EL PUENTE
        local garageCoords = vector3(232.25, -856.53, 29.81)

        -- Punto donde el NPC dejará el coche (unos metros por delante del camión)
        local garageDropoff = vector3(225.00, -845.00, 29.81)

        TaskVehicleDriveToCoordLongrange(driver, truck, garageCoords.x, garageCoords.y, garageCoords.z, 20.0, 2883621,
            10.0)

        timeout = 0
        while #(GetEntityCoords(truck) - garageCoords) > 25.0 and timeout < 1800 do
            Wait(1000)
            timeout = timeout + 1
        end
        TaskVehicleTempAction(driver, truck, 27, 3000)
        Wait(3000)

        -- 5. DESCARGA EN EL GARAJE
        print('^3[DP-LOGISTICA]^7 Destino alcanzado. Procediendo a descargar vehículos...')
        for _, carEnt in ipairs(loadedCarsEntities) do
            if DoesEntityExist(carEnt) then
                local currentVeh = GetVehiclePedIsIn(driver, false)
                if currentVeh ~= 0 then
                    TaskLeaveVehicle(driver, currentVeh, 0)
                    Wait(2500)
                end

                DetachEntity(carEnt, true, true)

                local dropPos = GetOffsetFromEntityInWorldCoords(trailer, 0.0, -12.0, 0.0)
                SetEntityCoords(carEnt, dropPos.x, dropPos.y, dropPos.z, false, false, false, true)
                SetVehicleOnGroundProperly(carEnt)
                Wait(1000)

                -- ★ FIX: 60 segundos de paciencia en la descarga también
                TaskEnterVehicle(driver, carEnt, 60000, -1, 2.0, 1, 0)
                local t2 = 0
                while not IsPedInVehicle(driver, carEnt, false) and t2 < 60 do
                    Wait(1000)
                    t2 = t2 + 1
                end
                if not IsPedInVehicle(driver, carEnt, false) then
                    TaskWarpPedIntoVehicle(driver, carEnt, -1)
                end

                TaskVehicleDriveToCoord(driver, carEnt, garageDropoff.x, garageDropoff.y, garageDropoff.z, 7.0, 0,
                    GetEntityModel(carEnt), 786603, 3.0)
                local t3 = 0
                while #(GetEntityCoords(carEnt) - garageDropoff) > 5.0 and t3 < 300 do
                    Wait(1000)
                    t3 = t3 + 1
                end

                TaskVehicleTempAction(driver, carEnt, 27, 2000)
                Wait(2000)

                TaskLeaveVehicle(driver, carEnt, 0)
                Wait(2500)
                DeleteEntity(carEnt)
            end
        end

        -- 6. VIAJE DE VUELTA AL CONCESIONARIO
        print('^3[DP-LOGISTICA]^7 Vehículos entregados. Regresando a la base...')
        -- ★ FIX: Últimos 60 segundos para el viaje de vuelta
        TaskEnterVehicle(driver, truck, 60000, -1, 2.0, 1, 0)
        timeout = 0
        while not IsPedInVehicle(driver, truck, false) and timeout < 60 do
            Wait(1000)
            timeout = timeout + 1
        end
        if not IsPedInVehicle(driver, truck, false) then
            TaskWarpPedIntoVehicle(driver, truck, -1)
        end

        TaskVehicleDriveToCoordLongrange(driver, truck, logis.truckSpawn.x, logis.truckSpawn.y, logis.truckSpawn.z,
            20.0, 2883621, 10.0)

        timeout = 0
        while #(GetEntityCoords(truck) - vector3(logis.truckSpawn.x, logis.truckSpawn.y, logis.truckSpawn.z)) > 30.0 and
            timeout < 1800 do
            Wait(1000)
            timeout = timeout + 1
        end

        -- 7. AUTO-LIMPIEZA FINAL
        print('^2[DP-LOGISTICA]^7 Jornada completada. Fichando salida y guardando camión.')
        isRouteActive = false
        Wait(3000)

        if DoesEntityExist(trailer) then
            DeleteEntity(trailer)
        end
        if DoesEntityExist(truck) then
            DeleteEntity(truck)
        end
        if DoesEntityExist(driver) then
            DeleteEntity(driver)
        end
    end)
end)

-- Evento recibido del servidor: spawnear coche y arrancar timer
RegisterNetEvent('DP-VehicleShop:client:beginTestDrive')
AddEventHandler('DP-VehicleShop:client:beginTestDrive', function(dealerId, vehicleData, bucket)
    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig or not dealerConfig.ExitSpawnPoints then
        return
    end

    -- 1. Cerramos el NUI del showroom (sin avisar al servidor, ya lo gestionamos aquí)
    isMenuOpen = false
    SendNUIMessage({
        action = 'setVisible',
        status = false
    })
    SendNUIMessage({
        action = 'hideTestDriveHUD'
    })
    SetNuiFocus(false, false)

    -- MOSTRAR HUD Y VOZ PARA CONDUCIR LA PRUEBA
    exports['DP-Hud']:ToggleVisibility(true)
    TriggerEvent('bcs-voice-ui:client:showVoice', true)

    -- 2. Destruir cámara y restaurar jugador (igual que exitShowroomMode)
    local ped = PlayerPedId()

    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        DeleteEntity(previewVehicleEntity)
        previewVehicleEntity = nil
    end

    if showroomCam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(showroomCam, false)
        showroomCam = nil
    end

    if previousCoords then
        SetEntityCoords(ped, previousCoords.x, previousCoords.y, previousCoords.z, false, false, false, false)
        SetEntityHeading(ped, previousCoords.w)
        previousCoords = nil
    end

    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, true)
    SetEntityCollision(ped, true, true)
    SetPedCanRagdoll(ped, true)
    TriggerEvent('chat:client:showChat', true)
    DisplayRadar(true)

    -- 3. Buscar spawn libre
    local spawnPoint = dealerConfig.ExitSpawnPoints[1]
    for _, point in ipairs(dealerConfig.ExitSpawnPoints) do
        if not IsAnyVehicleNearPoint(point.x, point.y, point.z, 3.0) then
            spawnPoint = point
            break
        end
    end

    -- 4. Spawnear el vehículo de prueba
    local modelHash = GetHashKey(vehicleData.model)
    RequestModel(modelHash)
    local timeout = 0
    while not HasModelLoaded(modelHash) and timeout < 2000 do
        Wait(10)
        timeout = timeout + 10
    end
    if not HasModelLoaded(modelHash) then
        return
    end

    testDriveVehicle = CreateVehicle(modelHash, spawnPoint.x, spawnPoint.y, spawnPoint.z, spawnPoint.w, true, false)

    -- 5. Personalización (color, matrícula, extras)
    SetVehicleNumberPlateText(testDriveVehicle, vehicleData.plate or 'PRUEBA')

    if type(vehicleData.color) == 'table' then
        local r, g, b = tonumber(vehicleData.color.r), tonumber(vehicleData.color.g), tonumber(vehicleData.color.b)
        SetVehicleCustomPrimaryColour(testDriveVehicle, r, g, b)
        SetVehicleCustomSecondaryColour(testDriveVehicle, r, g, b)
    else
        local cId = tonumber(vehicleData.color) or 0
        SetVehicleColours(testDriveVehicle, cId, cId)
        SetVehicleExtraColours(testDriveVehicle, cId, cId)
    end
    SetVehicleModKit(testDriveVehicle, 0)
    SetVehicleLivery(testDriveVehicle, -1)

    -- Extras
    for i = 1, 20 do
        if DoesExtraExist(testDriveVehicle, i) then
            SetVehicleExtra(testDriveVehicle, i, 1) -- Apagar todos
        end
    end
    if vehicleData.extras and type(vehicleData.extras) == 'table' then
        for _, extraId in ipairs(vehicleData.extras) do
            if DoesExtraExist(testDriveVehicle, extraId) then
                SetVehicleExtra(testDriveVehicle, extraId, 0)
            end
        end
    end

    -- 6. Sin colisión con otros jugadores (solo con el mundo)
    SetEntityNoCollisionEntity(testDriveVehicle, ped, false)

    SetVehicleOnGroundProperly(testDriveVehicle)

    -- 7. Meter al jugador dentro como conductor
    TaskWarpPedIntoVehicle(ped, testDriveVehicle, -1)

    -- MODO DIOS, ANTI-CAÍDAS Y GASOLINA AL 100%
    SetEntityInvincible(testDriveVehicle, true) -- Vehículo indestructible
    SetVehicleCanBeVisiblyDamaged(testDriveVehicle, false) -- Sin rasguños
    SetVehicleEngineOn(testDriveVehicle, true, true, false)
    SetVehicleFuelLevel(testDriveVehicle, 100.0)

    -- Si usas LegacyFuel o similar, forzamos el 100% también
    if exports['LegacyFuel'] then
        exports['LegacyFuel']:SetFuel(testDriveVehicle, 100.0)
    end

    SetPlayerInvincible(PlayerId(), true) -- Jugador no recibe daño
    SetPedCanBeKnockedOffVehicle(ped, 1) -- 1 = KNOCKOFFVEHICLE_NEVER (No se cae de las motos)

    SetModelAsNoLongerNeeded(modelHash)

    -- 8. Arrancar el HUD con el timer y el hilo de vigilancia
    testDriveActive = true
    testDriveTimer = Config.TestDrive.Duration

    SendNUIMessage({
        action = 'showTestDriveHUD',
        duration = Config.TestDrive.Duration
    })

    -- 9. Hilo de vigilancia optimizado: countdown al segundo + detección al milisegundo
    CreateThread(function()
        local lastUpdate = GetGameTimer()

        while testDriveActive and testDriveTimer > 0 do
            Wait(0) -- Vigilancia al milisegundo para que sea instantáneo

            local currentPed = PlayerPedId()

            -- DETECCIÓN INSTANTÁNEA: ¿Está saliendo del coche (Task 2) o ya no está dentro?
            if GetIsTaskActive(currentPed, 2) or GetVehiclePedIsIn(currentPed, false) == 0 then
                -- Opcional: Avisar que se canceló
                Framework.Core.Functions.Notify('Prueba de manejo finalizada.', 'primary')
                break
            end

            -- ACTUALIZACIÓN DEL TIMER: Solo cada 1000ms (1 segundo)
            if GetGameTimer() - lastUpdate >= 1000 then
                testDriveTimer = testDriveTimer - 1

                SendNUIMessage({
                    action = 'updateTestDriveTimer',
                    timeLeft = testDriveTimer
                })

                lastUpdate = GetGameTimer()
            end
        end

        -- Tiempo agotado o se bajó: terminar prueba de golpe
        if testDriveActive then
            EndTestDrive()
        end
    end)
end)

-- Evento del servidor confirmando que ya está en bucket 0: reabrir showroom
RegisterNetEvent('DP-VehicleShop:client:finishTestDrive')
AddEventHandler('DP-VehicleShop:client:finishTestDrive', function()
    -- Teletransportar de vuelta a donde estaba frente al NPC
    if testDriveReturnCoords then
        local ped = PlayerPedId()
        SetEntityCoords(ped, testDriveReturnCoords.x, testDriveReturnCoords.y, testDriveReturnCoords.z, false, false,
            false, false)
        SetEntityHeading(ped, testDriveReturnCoords.w)
        testDriveReturnCoords = nil
    end

    -- Reabrimos el showroom desde cero (el servidor nos mandará los datos de nuevo)
    if currentShowroomDealerId then
        TriggerServerEvent('DP-VehicleShop:server:requestShowroom', currentShowroomDealerId)
    end
end)

-- =================================================================
-- MÓDULO 11: NUI CALLBACKS - MENÚ GENERAL
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

    -- MOSTRAR HUD, CHAT Y VOZ
    exports['DP-Hud']:ToggleVisibility(true)
    TriggerEvent('chat:client:showChat', true)
    TriggerEvent('bcs-voice-ui:client:showVoice', true)
    cb('ok')
end)

-- Callback específico para confirmar la compra del concesionario
RegisterNUICallback('confirmPurchase', function(data, cb)
    local dealerId = data.dealerId
    if dealerId then
        TriggerServerEvent('DP-VehicleShop:server:buyDealership', dealerId)
    end
    SetMenuState(false) -- Cerramos la UI y liberamos el ratón

    -- MOSTRAR HUD, CHAT Y VOZ
    exports['DP-Hud']:ToggleVisibility(true)
    TriggerEvent('chat:client:showChat', true)
    TriggerEvent('bcs-voice-ui:client:showVoice', true)
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

RegisterNUICallback('closeBossMenu', function(data, cb)
    SetNuiFocus(false, false)
    currentBossDealerId = nil

    -- MOSTRAR HUD, CHAT Y VOZ
    exports['DP-Hud']:ToggleVisibility(true)
    TriggerEvent('chat:client:showChat', true)
    TriggerEvent('bcs-voice-ui:client:showVoice', true)
    cb('ok')
end)

-- =================================================================
-- MÓDULO 12: NUI CALLBACKS - SHOWROOM Y PREVISUALIZACIÓN
-- =================================================================

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

    -- 1. Aplicamos el color seleccionado (Normal o RGB)
    if type(data.color) == 'table' then
        local r, g, b = tonumber(data.color.r), tonumber(data.color.g), tonumber(data.color.b)
        SetVehicleCustomPrimaryColour(previewVehicleEntity, r, g, b)
        SetVehicleCustomSecondaryColour(previewVehicleEntity, r, g, b)
    else
        local cId = tonumber(data.color) or 0
        ClearVehicleCustomPrimaryColour(previewVehicleEntity)
        ClearVehicleCustomSecondaryColour(previewVehicleEntity)
        SetVehicleColours(previewVehicleEntity, cId, cId)
        SetVehicleExtraColours(previewVehicleEntity, cId, cId)
    end

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

    FreezeEntityPosition(previewVehicleEntity, true)

    -- Usamos las nativas de GTA que leen el "handling.meta" del coche
    local maxSpeed = GetVehicleModelEstimatedMaxSpeed(modelHash)
    local maxAccel = GetVehicleModelAcceleration(modelHash)
    local maxBraking = GetVehicleModelMaxBraking(modelHash)
    local maxTraction = GetVehicleModelMaxTraction(modelHash)

    -- ESCALA BARRAS DE PROGRESO
    local speedScore = math.ceil((maxSpeed / 65.0) * 100) / 10
    local accelScore = math.ceil((maxAccel / 0.45) * 100) / 10
    local brakingScore = math.ceil((maxBraking / 1.15) * 100) / 10
    local handlingScore = math.ceil((maxTraction / 2.85) * 100) / 10

    if speedScore > 10.0 then
        speedScore = 10.0
    end
    if accelScore > 10.0 then
        accelScore = 10.0
    end
    if brakingScore > 10.0 then
        brakingScore = 10.0
    end
    if handlingScore > 10.0 then
        handlingScore = 10.0
    end

    -- CÁLCULOS PARA LA CUADRÍCULA INFERIOR

    -- 1. ASIENTOS
    local seats = GetVehicleModelNumberOfSeats(modelHash)

    -- 2. VELOCIDAD MÁXIMA EN TEXTO (KM/H o MP/H)
    -- Asumimos que existe Config.Velocity en tu config.lua. Si no, usa 'kmh' por defecto.
    local velocityConfig = Config.Velocity or 'kmh'
    local maxSpeedText = "--"

    if velocityConfig == 'kmh' then
        -- Convertir m/s a km/h (x 3.6)
        local speedKmh = math.ceil(maxSpeed * 3.6)
        maxSpeedText = tostring(speedKmh) .. " KM/H"
    else
        -- Convertir m/s a mp/h (x 2.236936)
        local speedMph = math.ceil(maxSpeed * 2.236936)
        maxSpeedText = tostring(speedMph) .. " MP/H"
    end

    -- 3. TIEMPO DE ACELERACIÓN 0-100 (Fórmula de estimación física)
    -- El valor maxAccel de GTA suele ir de 0.1 a 0.5. Aplicamos una fórmula para dar segundos realistas.
    local accelTime = (1.0 / maxAccel) * 1.2
    if accelTime < 1.5 then
        accelTime = 1.5
    end -- Capamos a 1.5s para que coches muy chetados no den 0 segundos
    local accelTimeText = string.format("%.1f s", accelTime)

    -- 4. DETECCIÓN DE TUNING ESTÉTICO
    -- Comprobamos las categorías básicas de modificaciones visuales usando la entidad recién creada
    local hasTuning = false
    -- 0: Alerones | 1: Parachoques Delantero | 2: Parachoques Trasero | 3: Faldones | 4: Escapes
    if GetNumVehicleMods(previewVehicleEntity, 0) > 0 or GetNumVehicleMods(previewVehicleEntity, 1) > 0 or
        GetNumVehicleMods(previewVehicleEntity, 2) > 0 or GetNumVehicleMods(previewVehicleEntity, 3) > 0 or
        GetNumVehicleMods(previewVehicleEntity, 4) > 0 then

        hasTuning = true
    end

    -- Se lo enviamos TODO al Javascript (NUI)
    SendNUIMessage({
        action = 'updateVehicleStats',
        stats = {
            -- Barras de progreso
            speed = speedScore,
            acceleration = accelScore,
            braking = brakingScore,
            handling = handlingScore,
            maxSpeedText = maxSpeedText,
            seats = seats,
            accelTimeText = accelTimeText,
            hasTuning = hasTuning,
            measurementUnit = velocityConfig
        }
    })

    SetModelAsNoLongerNeeded(modelHash)
    cb('ok')
end)

RegisterNUICallback('updateVehicleColor', function(data, cb)
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        if type(data.color) == 'table' then
            -- Es un color RGB Custom de iro.js
            local r, g, b = tonumber(data.color.r), tonumber(data.color.g), tonumber(data.color.b)
            SetVehicleCustomPrimaryColour(previewVehicleEntity, r, g, b)
            SetVehicleCustomSecondaryColour(previewVehicleEntity, r, g, b)
        else
            -- Es un ID de color normal de la paleta de GTA
            local colorId = tonumber(data.color) or 0
            ClearVehicleCustomPrimaryColour(previewVehicleEntity)
            ClearVehicleCustomSecondaryColour(previewVehicleEntity)
            SetVehicleColours(previewVehicleEntity, colorId, colorId)
            SetVehicleExtraColours(previewVehicleEntity, colorId, colorId)
        end
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

-- Resetear todos los extras de golpe
RegisterNUICallback('resetAllVehicleExtras', function(_, cb)
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        -- Los vehículos de GTA suelen tener hasta 20 slots de extras
        for i = 1, 20 do
            if IsVehicleExtraIdValid(previewVehicleEntity, i) then
                SetVehicleExtra(previewVehicleEntity, i, 1) -- 1 = Desactivado/Oculto
            end
        end
    end
    cb('ok')
end)

RegisterNUICallback('updateVehiclePlate', function(data, cb)
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        local plateText = data.plate

        -- Si la matrícula viene vacía (porque le dio a la papelera o la borró a mano)
        -- Generamos una aleatoria puramente visual
        if not plateText or plateText == "" then
            plateText = string.upper(tostring(math.random(10, 99)) .. "DP" .. tostring(math.random(100, 999)))
        end

        SetVehicleNumberPlateText(previewVehicleEntity, plateText)
    end
    cb('ok')
end)

RegisterNUICallback('updateCategoryOrder', function(data, cb)
    if data then
        if data.orderData then
            TriggerServerEvent('DP-VehicleShop:server:updateCategoryOrder', data.orderData)
        end
    end

    cb('ok')
end)

RegisterNUICallback('focusPlateCamera', function(data, cb)
    -- Si no hay cámara o no hay coche, no hacemos nada
    if not showroomCam or not DoesEntityExist(previewVehicleEntity) then
        cb('ok')
        return
    end

    local dealerConfig = Config.Dealerships[currentShowroomDealerId]
    local baseHeading = 225.0
    if dealerConfig and dealerConfig.preview_spawn then
        baseHeading = dealerConfig.preview_spawn.w or 0.0
    end

    -- Asegurarnos de tener guardada la posición original de la cámara principal
    if not baseCamCoords then
        baseCamCoords = GetCamCoord(showroomCam)
        baseCamRot = GetCamRot(showroomCam, 2)
        baseCamFOV = GetCamFov(showroomCam)
    end

    if data.focus then
        -- 1. Guardamos la rotación actual por si el jugador lo había girado a mano
        prePlateHeading = GetEntityHeading(previewVehicleEntity)

        -- 2. Giramos el coche 180º exactos para que dé el culo directamente a la cámara
        SetEntityHeading(previewVehicleEntity, baseHeading + 225.0)

        -- 3. BAJAMOS LA CÁMARA: Le restamos 1.75 metros a la altura (Z) original
        local newCamZ = baseCamCoords.z - 1.75
        SetCamCoord(showroomCam, baseCamCoords.x, baseCamCoords.y, newCamZ)

        -- 4. LEVANTAMOS LA MIRADA: Ponemos la inclinación (RotX) a -2.0 para mirar casi recto
        SetCamRot(showroomCam, -2.0, baseCamRot.y, baseCamRot.z, 2)

        -- 5. Ajustamos el Zoom (Un 35.0 suele encuadrar perfectamente la trasera entera)
        currentPreviewFOV = 35.0
        SetCamFov(showroomCam, currentPreviewFOV)
    else
        -- 1. Restauramos la rotación del coche
        if prePlateHeading then
            SetEntityHeading(previewVehicleEntity, prePlateHeading)
            prePlateHeading = nil
        else
            SetEntityHeading(previewVehicleEntity, baseHeading)
        end

        -- 2. Restauramos la cámara original (Altura, Inclinación y Zoom)
        if baseCamCoords and baseCamRot then
            SetCamCoord(showroomCam, baseCamCoords.x, baseCamCoords.y, baseCamCoords.z)
            SetCamRot(showroomCam, baseCamRot.x, baseCamRot.y, baseCamRot.z, 2)
        end

        currentPreviewFOV = baseCamFOV or 50.0
        SetCamFov(showroomCam, currentPreviewFOV)
    end

    cb('ok')
end)

RegisterNUICallback('togglePreviewCamera', function(data, cb)
    if not showroomCam or not DoesEntityExist(previewVehicleEntity) then
        cb('ok')
        return
    end

    if currentPreviewCameraMode ~= 'interior' and not baseCamCoords then
        baseCamCoords = GetCamCoord(showroomCam)
        baseCamRot = GetCamRot(showroomCam, 2)
        baseCamFOV = GetCamFov(showroomCam) -- Guardamos el FOV original para evitar el zoom
    end

    currentPreviewCameraMode = data.mode
    local dealerConfig = Config.Dealerships[currentShowroomDealerId]

    if data.mode == 'exterior' or data.mode == 'reset' then
        DetachCam(showroomCam)
        StopCamPointing(showroomCam)

        if baseCamCoords and baseCamRot and baseCamFOV then
            SetCamCoord(showroomCam, baseCamCoords.x, baseCamCoords.y, baseCamCoords.z)
            SetCamRot(showroomCam, baseCamRot.x, baseCamRot.y, baseCamRot.z, 2)
            currentPreviewFOV = baseCamFOV -- Restauramos el FOV original
            SetCamFov(showroomCam, currentPreviewFOV)
        end

        if data.mode == 'reset' then
            if dealerConfig and dealerConfig.preview_spawn then
                SetEntityHeading(previewVehicleEntity, dealerConfig.preview_spawn.w)
            end
            baseCamCoords = nil
            baseCamRot = nil
            baseCamFOV = nil
        end

    elseif data.mode == 'interior' then
        currentPreviewFOV = 60.0 -- FOV un poco más alejado para el interior
        SetCamFov(showroomCam, currentPreviewFOV)

        StopCamPointing(showroomCam)
        AttachCamToEntity(showroomCam, previewVehicleEntity, 0.0, 0.1, 0.6, true)
        currentInteriorCamHeading = GetEntityHeading(previewVehicleEntity)
        SetCamRot(showroomCam, 0.0, 0.0, currentInteriorCamHeading, 2)
    end

    cb('ok')
end)

-- (El resto de callbacks de rotatePreviewCamera y updatePreviewZoom se quedan igual)

RegisterNUICallback('rotatePreviewCamera', function(data, cb)
    if not showroomCam or not DoesEntityExist(previewVehicleEntity) then
        cb('ok')
        return
    end

    local dragAmount = data.dragAmount
    local sensitivity = 0.4

    if currentPreviewCameraMode == 'exterior' then
        local currentHeading = GetEntityHeading(previewVehicleEntity)
        -- Cambiado de - a + para corregir la rotación invertida
        local newHeading = currentHeading + (dragAmount * sensitivity)
        SetEntityHeading(previewVehicleEntity, newHeading)
    elseif currentPreviewCameraMode == 'interior' then
        -- Cambiado de + a - para que el interior también se sienta natural
        currentInteriorCamHeading = currentInteriorCamHeading - (dragAmount * sensitivity)
        SetCamRot(showroomCam, 0.0, 0.0, currentInteriorCamHeading, 2)
    end
    cb('ok')
end)

RegisterNUICallback('updatePreviewZoom', function(data, cb)
    if not showroomCam then
        cb('ok')
        return
    end

    if data.direction == 'in' then
        currentPreviewFOV = currentPreviewFOV - 2.0
    else
        currentPreviewFOV = currentPreviewFOV + 2.0
    end

    -- Limites de Zoom (Min: 20 para mucho zoom | Max: 70 para alejar)
    if currentPreviewFOV < 20.0 then
        currentPreviewFOV = 20.0
    end
    if currentPreviewFOV > 70.0 then
        currentPreviewFOV = 70.0
    end

    SetCamFov(showroomCam, currentPreviewFOV)
    cb('ok')
end)

RegisterNUICallback('buyVehicle', function(data, cb)
    if currentShowroomDealerId then
        -- ESCANEO DE EXTRAS ANTES DE COMPRAR
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

        -- 1. Enviamos la orden de compra al servidor (con el método de pago, plazos y EXTRAS)
        TriggerServerEvent('DP-VehicleShop:server:buyShowroomVehicle', currentShowroomDealerId, data)

        -- ¡ELIMINADOS LOS PASOS 2 Y 3 (CIERRE DE UI Y CÁMARA)! 
        -- Ahora la cámara, el TP y el menú se quedan exactamente donde están para que sigas viendo coches.
    end
    cb('ok')
end)

RegisterNUICallback('reserveVehicle', function(data, cb)
    if currentShowroomDealerId then
        TriggerServerEvent('DP-VehicleShop:server:reserveVehicle', currentShowroomDealerId, data)
    end
    cb('ok')
end)

-- =================================================================
-- MÓDULO 13: NUI CALLBACKS - BOSS MENU
-- =================================================================

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

RegisterNUICallback('acceptReservation', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:acceptReservation', data.id)
    cb('ok')
end)

RegisterNUICallback('cancelReservation', function(data, cb)
    TriggerServerEvent('DP-VehicleShop:server:cancelReservation', data.id)
    cb('ok')
end)

RegisterNUICallback('startTestDrive', function(data, cb)
    if not currentShowroomDealerId then
        cb('ok')
        return
    end

    -- Escaneamos los extras activos del coche de preview antes de cerrar
    local appliedExtras = {}
    if previewVehicleEntity and DoesEntityExist(previewVehicleEntity) then
        for i = 1, 20 do
            if DoesExtraExist(previewVehicleEntity, i) then
                if IsVehicleExtraTurnedOn(previewVehicleEntity, i) == 1 or
                    IsVehicleExtraTurnedOn(previewVehicleEntity, i) == true then
                    table.insert(appliedExtras, i)
                end
            end
        end
    end

    data.extras = appliedExtras

    -- Mandamos al servidor para que nos asigne el bucket y nos devuelva el evento
    TriggerServerEvent('DP-VehicleShop:server:startTestDrive', currentShowroomDealerId, data)
    cb('ok')
end)

RegisterNUICallback('changeVehicleCategory', function(data, cb)
    local model = data.model
    local oldCategory = data.oldCategory
    local newCategory = data.newCategory

    -- Verificamos que tengamos los datos mínimos y estemos en una empresa válida
    if currentBossDealerId and model and newCategory then
        -- Enviamos la orden al servidor con el ID del concesionario actual
        TriggerServerEvent('DP-VehicleShop:server:changeVehicleCategory', currentBossDealerId, model, oldCategory,
            newCategory)
    end

    cb('ok')
end)

RegisterNUICallback('massChangeVehicleCategory', function(data, cb)
    local models = data.models
    local newCategory = data.newCategory

    -- Verificamos que tengamos los datos mínimos, que models sea una tabla (array) válida y que tengamos el dealerId
    if currentBossDealerId and models and type(models) == "table" and #models > 0 and newCategory then

        -- Enviamos la orden masiva al servidor
        TriggerServerEvent('DP-VehicleShop:server:massChangeVehicleCategory', currentBossDealerId, models, newCategory)

    end

    cb('ok')
end)

RegisterNUICallback('requestCompareStats', function(data, cb)
    local model = data.model
    if not model then
        return cb('ok')
    end

    local modelHash = GetHashKey(model)
    if not IsModelInCdimage(modelHash) then
        return cb('ok')
    end

    -- 1. NATIVAS DE GTA PARA EXTRAER DATOS BASE (No necesitan spawnear el coche)
    local maxSpeed = GetVehicleModelEstimatedMaxSpeed(modelHash)
    local maxAccel = GetVehicleModelAcceleration(modelHash)
    local maxBraking = GetVehicleModelMaxBraking(modelHash)
    local maxTraction = GetVehicleModelMaxTraction(modelHash)

    -- 2. MATEMÁTICAS DE LAS BARRAS (Exactamente las mismas que usas en tu previewVehicle)
    local speedScore = math.ceil((maxSpeed / 65.0) * 100) / 10
    local accelScore = math.ceil((maxAccel / 0.45) * 100) / 10
    local brakingScore = math.ceil((maxBraking / 1.15) * 100) / 10
    local handlingScore = math.ceil((maxTraction / 2.85) * 100) / 10

    if speedScore > 10.0 then
        speedScore = 10.0
    end
    if accelScore > 10.0 then
        accelScore = 10.0
    end
    if brakingScore > 10.0 then
        brakingScore = 10.0
    end
    if handlingScore > 10.0 then
        handlingScore = 10.0
    end

    -- 3. CÁLCULOS PARA LA CUADRÍCULA INFERIOR
    local seats = GetVehicleModelNumberOfSeats(modelHash)

    local velocityConfig = Config.Velocity or 'kmh'
    local maxSpeedText = "--"

    if velocityConfig == 'kmh' then
        local speedKmh = math.ceil(maxSpeed * 3.6)
        maxSpeedText = tostring(speedKmh) .. " KM/H"
    else
        local speedMph = math.ceil(maxSpeed * 2.236936)
        maxSpeedText = tostring(speedMph) .. " MP/H"
    end

    local accelTime = (1.0 / maxAccel) * 1.2
    if accelTime < 1.5 then
        accelTime = 1.5
    end
    local accelTimeText = string.format("%.1f s", accelTime)

    -- 4. DETECCIÓN DE TUNING ESTÉTICO 
    -- (Para leer los mods, GTA exige que el coche exista físicamente y TENGA EL MODKIT INICIADO)
    local hasTuning = false
    RequestModel(modelHash)
    local timeout = 0
    while not HasModelLoaded(modelHash) and timeout < 1500 do
        Wait(10)
        timeout = timeout + 10
    end

    if HasModelLoaded(modelHash) then
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        local tempVeh = CreateVehicle(modelHash, pos.x, pos.y, pos.z - 50.0, 0.0, false, false)

        -- ¡EL FIX ESTÁ AQUÍ! Iniciamos el ModKit para que GTA pueda contar las piezas
        SetVehicleModKit(tempVeh, 0)

        if GetNumVehicleMods(tempVeh, 0) > 0 or GetNumVehicleMods(tempVeh, 1) > 0 or GetNumVehicleMods(tempVeh, 2) > 0 or
            GetNumVehicleMods(tempVeh, 3) > 0 or GetNumVehicleMods(tempVeh, 4) > 0 then
            hasTuning = true
        end

        DeleteEntity(tempVeh)
        SetModelAsNoLongerNeeded(modelHash)
    end

    -- 5. ENVIAMOS TODO LISTO AL JAVASCRIPT
    SendNUIMessage({
        action = 'updateCompareStats',
        stats = {
            speed = speedScore,
            acceleration = accelScore,
            braking = brakingScore,
            handling = handlingScore,
            maxSpeedText = maxSpeedText,
            seats = seats,
            accelTimeText = accelTimeText,
            measurementUnit = velocityConfig,
            hasTuning = hasTuning
        }
    })

    cb('ok')
end)

-- Recibe los datos del modal y pide al servidor que cree el cupón
RegisterNUICallback('createDiscountCode', function(data, cb)
    if not currentBossDealerId then
        cb('error')
        return
    end

    TriggerServerEvent('DP-VehicleShop:server:createDiscount', currentBossDealerId, data)
    cb('ok')
end)

-- Pide al servidor eliminar un cupón existente
RegisterNUICallback('deleteDiscountCode', function(data, cb)
    if not currentBossDealerId then
        cb('error')
        return
    end

    TriggerServerEvent('DP-VehicleShop:server:deleteDiscount', currentBossDealerId, data.id)
    cb('ok')
end)

RegisterNUICallback('verifyDiscountCode', function(data, cb)
    -- Si por algún motivo no sabemos en qué concesionario estamos, cortamos
    if not currentShowroomDealerId then
        cb({
            valid = false,
            message = "Error: No se ha detectado el concesionario."
        })
        return
    end

    -- Usamos un Callback de QBCore para preguntarle al Servidor y esperar su respuesta
    Framework.Core.Functions.TriggerCallback('DP-VehicleShop:server:verifyDiscount', function(result)
        -- result será un JSON que JS entiende: { valid = true, percentage = 15 } o { valid = false, message = "..." }
        cb(result)
    end, currentShowroomDealerId, data.code, data.model, data.category)
end)

-- Callback NUI que se activa cuando el administrador pulsa el botón "Create New"
RegisterNUICallback('adminCreateDealer', function(data, cb)
    cb('ok')
end)

-- Callback NUI: Obtener Coordenadas actuales del Administrador para el formulario
RegisterNUICallback('adminGetCoords', function(data, cb)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    -- Devolvemos la posición exacta en formato JSON al JavaScript
    cb({
        x = coords.x,
        y = coords.y,
        z = coords.z,
        h = heading
    })
end)

-- Callback NUI: Enviar el formulario de creación de concesionario hacia el servidor
RegisterNUICallback('adminSaveNewDealer', function(data, cb)
    if data and data.id then
        -- Pasamos el objeto con toda la información al sv_main.lua de forma segura
        TriggerServerEvent('DP-VehicleShop:server:adminSaveNewDealer', data)
    end
    cb('ok')
end)

-- Callback NUI: Actualizar datos de un concesionario existente
RegisterNUICallback('adminUpdateDealer', function(data, cb)
    if data and data.id then
        TriggerServerEvent('DP-VehicleShop:server:adminUpdateDealer', data)
    end
    cb('ok')
end)

-- Callback NUI: Eliminar un concesionario desde la tabla principal
RegisterNUICallback('deleteAdminDealer', function(data, cb)
    if data and data.id then
        TriggerServerEvent('DP-VehicleShop:server:deleteAdminDealer', data.id)
    end
    cb('ok')
end)

-- Callback NUI: Marcar GPS del Concesionario en el mapa de ESC
RegisterNUICallback('adminMarkGPS', function(data, cb)
    if data and data.id then
        local dealerConfig = Config.Dealerships[data.id]
        if dealerConfig then
            local x, y
            -- Buscamos la coordenada más lógica para mandar al jugador
            if dealerConfig.bossMenu then
                x, y = dealerConfig.bossMenu.x, dealerConfig.bossMenu.y
            elseif dealerConfig.blip and dealerConfig.blip.coords then
                x, y = dealerConfig.blip.coords.x, dealerConfig.blip.coords.y
            elseif dealerConfig.coords_npc then
                x, y = dealerConfig.coords_npc.x, dealerConfig.coords_npc.y
            end

            if x and y then
                SetNewWaypoint(x, y)
                Framework.Core.Functions.Notify("Ruta marcada en el GPS hacia el concesionario.", "success")
            else
                Framework.Core.Functions.Notify("Este concesionario no tiene coordenadas válidas.", "error")
            end
        else
            Framework.Core.Functions
                .Notify("Aún no está en memoria. Reinicia el script para trazar la ruta.", "error")
        end
    end
    cb('ok')
end)

-- Callback NUI: Activar o Desactivar Concesionario temporalmente
RegisterNUICallback('adminToggleDealer', function(data, cb)
    if data and data.id then
        -- Mandamos la orden al servidor para que actualice la base de datos
        TriggerServerEvent('DP-VehicleShop:server:adminToggleDealer', data.id)
    end
    cb('ok')
end)

-- Callback NUI: Importar Concesionario desde JSON
RegisterNUICallback('adminImportDealer', function(data, cb)
    -- Verificación básica: Nos aseguramos de que el JSON pegado tenga la estructura mínima
    if data and data.id and data.name then
        -- Enviamos el paquete completo al servidor para que lo procese en la Base de Datos
        TriggerServerEvent('DP-VehicleShop:server:adminImportDealer', data)
    else
        -- Si pegan un JSON válido pero que no es de un concesionario (ej: {"hola": "mundo"})
        Framework.Core.Functions.Notify("Error: El código JSON no pertenece a un concesionario válido.", "error")
    end

    cb('ok')
end)

-- =================================================================
-- MÓDULO 14: HILOS DE EJECUCIÓN OPTIMIZADOS
-- =================================================================

-- [HILO 0: ESC MENÚ DE GESTIÓN]
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
-- MÓDULO 15: ZONAS DE INTERACCIÓN (TEXTUI, MARCADORES Y TECLAS)
-- =================================================================

CreateThread(function()
    while true do
        local sleep = 1000
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        local inZone = false
        local zoneId = nil
        local zoneText = ""

        -- 1. Comprobar puntos SHOWROOM desde la configuración de la BD
        for dealerId, config in pairs(dealerConfigsFromDB) do
            if config and type(config.showroomPoints) == 'table' then
                for index, point in ipairs(config.showroomPoints) do
                    if point and point.coords_npc and point.coords_npc.x then
                        local pointCoords = vector3(tonumber(point.coords_npc.x) or 0.0,
                            tonumber(point.coords_npc.y) or 0.0, tonumber(point.coords_npc.z) or 0.0)
                        local distPoint = #(pos - pointCoords)
                        local pType = point.type or 'npc'

                        -- RENDERIZAR MARCADOR (Showroom)
                        if pType == 'marker' and point.marker and distPoint < 25.0 then
                            sleep = 0
                            local m = point.marker
                            local mType = tonumber(m.type) or 1
                            local sx, sy, sz = tonumber(m.scale.x) or 1.5, tonumber(m.scale.y) or 1.5,
                                tonumber(m.scale.z) or 0.5
                            local dx, dy, dz = tonumber(m.dir.x) or 0.0, tonumber(m.dir.y) or 0.0,
                                tonumber(m.dir.z) or 0.0
                            local rx, ry, rz = tonumber(m.rot.x) or 0.0, tonumber(m.rot.y) or 0.0,
                                tonumber(m.rot.z) or 0.0
                            local r, g, b, a = tonumber(m.color.r) or 255, tonumber(m.color.g) or 255,
                                tonumber(m.color.b) or 255, tonumber(m.color.a) or 150

                            local tDict = (m.textureDict and m.textureDict ~= "") and m.textureDict or nil
                            local tName = (m.textureName and m.textureName ~= "") and m.textureName or nil

                            DrawMarker(mType, pointCoords.x, pointCoords.y, pointCoords.z, dx, dy, dz, rx, ry, rz, sx,
                                sy, sz, r, g, b, a, m.bob, m.faceCamera, 2, m.rotate, tDict, tName, m.drawOnEnts)
                        end

                        -- ZONA INTERACCIÓN SHOWROOM
                        if distPoint < 2.5 and not inZone then
                            sleep = 0
                            inZone = true
                            zoneId = "showroom_" .. dealerId .. "_" .. index

                            if point.label and point.label ~= "" then
                                zoneText = point.label
                            else
                                zoneText = (pType == 'npc') and "Hablar con el Vendedor" or
                                               "Ver Catálogo de Vehículos"
                            end

                            if IsControlJustReleased(0, 38) then
                                TriggerServerEvent('DP-VehicleShop:server:requestShowroom', dealerId)
                            end
                        end
                    end
                end
            end
        end

        -- 2. Comprobar Punto de Compra de Empresa (DINÁMICO DESDE BD)
        for dealerId, config in pairs(dealerConfigsFromDB) do
            if not DealerOwners[dealerId] and config.npc_buy then
                local bp = config.npc_buy
                local bType = bp.type or 'npc'
                local bpCoords = vector3(tonumber(bp.x) or 0.0, tonumber(bp.y) or 0.0, tonumber(bp.z) or 0.0)
                local distBuy = #(pos - bpCoords)

                -- RENDERIZAR MARCADOR (Punto de Compra)
                if bType == 'marker' and bp.marker and distBuy < 25.0 then
                    sleep = 0
                    local m = bp.marker
                    local mType = tonumber(m.type) or 2
                    local sx, sy, sz = tonumber(m.scale.x) or 0.2, tonumber(m.scale.y) or 0.2,
                        tonumber(m.scale.z) or 0.2
                    local r, g, b, a = tonumber(m.color.r) or 0, tonumber(m.color.g) or 255, tonumber(m.color.b) or 0,
                        tonumber(m.color.a) or 200
                    DrawMarker(mType, bpCoords.x, bpCoords.y, bpCoords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, sx, sy, sz, r,
                        g, b, a, m.bob, m.faceCamera, 2, m.rotate, nil, nil, false)
                end

                -- ZONA INTERACCIÓN COMPRAR EMPRESA
                if distBuy < 2.5 and not inZone then
                    sleep = 0
                    inZone = true
                    zoneId = "buy_" .. dealerId

                    -- Texto personalizado
                    if bp.label and bp.label ~= "" then
                        zoneText = bp.label
                    else
                        local dLabel = Config.Dealerships[dealerId] and Config.Dealerships[dealerId].label or dealerId
                        zoneText = "Comprar Empresa (" .. dLabel .. ")"
                    end

                    if IsControlJustReleased(0, 38) then
                        isMenuOpen = true
                        local dLabel = Config.Dealerships[dealerId] and Config.Dealerships[dealerId].label or dealerId
                        SendNUIMessage({
                            action = 'openBuyMenu',
                            dealerId = dealerId,
                            dealerLabel = dLabel,
                            price = Config.DefaultDealershipPrice
                        })
                        SetNuiFocus(true, true)
                    end
                end
            end
        end

        -- =================================================================
        -- LÓGICA DE MOSTRAR/OCULTAR DP-TextUI
        -- =================================================================
        if inZone then
            if currentActiveZone ~= zoneId or currentActiveText ~= zoneText then
                if currentActiveZone then
                    exports['DP-TextUI']:OcultarUI(currentActiveZone)
                end
                currentActiveZone = zoneId
                currentActiveText = zoneText
                exports['DP-TextUI']:MostrarUI(zoneId, zoneText, 'E', false)

                if string.find(zoneId, "showroom_") then
                    allShowroomZoneIds[zoneId] = true
                end
            end
        elseif not inZone and currentActiveZone then
            exports['DP-TextUI']:OcultarUI(currentActiveZone)
            currentActiveZone = nil
            currentActiveText = nil
        end

        Wait(sleep)
    end
end)

-- =================================================================
-- MÓDULO 16: CREACIÓN DE BLIPS (ICONOS DEL MAPA) — DESDE BD
-- =================================================================

-- Función interna: borra los blips activos y los recrea con los datos de BD
local function RefreshDealerBlips()
    -- 1. Borramos todos los blips anteriores del mapa
    for _, blip in ipairs(dealerBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end
    dealerBlips = {}

    -- 2. Recorremos los concesionarios que vinieron de la BD
    for _, dealer in ipairs(dealersFromDB) do
        -- Solo creamos el blip si NO está desactivado
        if dealer.coords and dealer.coords.x and dealer.name and not dealer.disabled then

            local blip = AddBlipForCoord(tonumber(dealer.coords.x), tonumber(dealer.coords.y),
                tonumber(dealer.coords.z) or 0.0)

            -- Sprite/Icono del blip (default: 225 = icono coche)
            SetBlipSprite(blip, tonumber(dealer.blip) or 225)
            SetBlipDisplay(blip, 10)
            SetBlipScale(blip, tonumber(dealer.scale) or 0.8)

            -- FIX: El color 0 a veces rompe el icono. El 4 es Blanco Puro oficial.
            local blipColor = tonumber(dealer.color) or 4
            if blipColor == 0 then
                blipColor = 4
            end
            SetBlipColour(blip, blipColor)

            SetBlipAsShortRange(blip, true)
            SetBlipCategory(blip, 10) -- Categoría Negocios: evita que capture el waypoint del jugador

            -- Nombre visible en el mapa
            BeginTextCommandSetBlipName("STRING")
            AddTextComponentString(dealer.name)
            EndTextCommandSetBlipName(blip)

            table.insert(dealerBlips, blip)
        end
    end
end

-- Recibe la lista de concesionarios desde el servidor y refresca los blips.
RegisterNetEvent('DP-VehicleShop:client:loadDealerBlips', function(dealers)
    if not dealers or type(dealers) ~= 'table' then
        return
    end

    -- 1. Limpieza de UI previa
    for zoneId, _ in pairs(allShowroomZoneIds) do
        exports['DP-TextUI']:OcultarUI(zoneId)
    end
    allShowroomZoneIds = {}
    currentActiveZone = nil
    currentActiveText = nil

    -- 2. Guardar en caché global
    dealersFromDB = dealers
    dealerConfigsFromDB = {}
    for _, dealer in ipairs(dealers) do
        if dealer.id then
            dealerConfigsFromDB[dealer.id] = dealer.config or {}
        end
    end

    -- 3. Acciones críticas
    RefreshDealerBlips()
    DeleteDealershipEntities() -- Borra antiguos
    SpawnDealershipEntities() -- Crea los nuevos
end)

-- =================================================================
-- MÓDULO 17: EXPORTS EXTERNOS (INTEGRACIÓN CON OTROS SCRIPTS)
-- =================================================================

-- Export para abrir el Boss Menu desde cualquier lugar (ej: qb-jobmenu con F7)
exports('OpenBossMenu', function()
    UpdateLocalPlayerData() -- Nos aseguramos de tener el trabajo actualizado

    if not PlayerJob or not PlayerJob.name then
        Framework.Core.Functions.Notify('No tienes ningún trabajo.', 'error')
        return false
    end

    local myJobName = PlayerJob.name
    local isBoss = PlayerJob.isboss
    local dealerIdFound = nil

    -- 1. BUSCAMOS A QUÉ CONCESIONARIO PERTENECE EL TRABAJO DEL JUGADOR
    for dId, config in pairs(dealerConfigsFromDB) do
        -- Leemos el job de la base de datos (y como respaldo del config.lua)
        local requiredJob = config.job or (Config.Dealerships[dId] and Config.Dealerships[dId].job)

        if requiredJob == myJobName then
            dealerIdFound = dId
            break
        end
    end

    -- 2. VALIDACIONES
    if not dealerIdFound then
        Framework.Core.Functions.Notify('Tu trabajo no está vinculado a ningún concesionario.', 'error')
        return false
    end

    -- ¿La gestión de empresa está habilitada en la BD para este concesionario?
    local dealerConfig = dealerConfigsFromDB[dealerIdFound] or {}
    if dealerConfig.management_enabled == false then
        Framework.Core.Functions.Notify('La gestión corporativa de esta empresa está deshabilitada.', 'error')
        return false
    end

    -- ¿Tiene permisos de jefe o es el dueño por base de datos?
    local isAuthorized = false
    if isBoss then
        isAuthorized = true
    end
    if PlayerData and PlayerData.citizenid and DealerOwners[dealerIdFound] == PlayerData.citizenid then
        isAuthorized = true
    end

    if not isAuthorized then
        Framework.Core.Functions.Notify('Solo el dueño o los gerentes pueden acceder al panel.', 'error')
        return false
    end

    -- 3. ABRIR EL MENÚ (Disparamos al servidor para que recoja los datos frescos)
    TriggerServerEvent('DP-VehicleShop:server:requestBossMenu', dealerIdFound)
    return true
end)
