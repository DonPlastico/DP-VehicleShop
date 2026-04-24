-- =================================================================
-- VARIABLES GLOBALES DEL SERVIDOR
-- =================================================================
local Framework = {}
local DealershipOwners = {} -- Caché local de dueños

-- Función global para refrescar la caché y avisar a los clientes
function RefreshDealerCache()
    exports['oxmysql']:execute('SELECT dealership_id, owner_citizenid FROM dp_vehicleshop_dealerships', {},
        function(results)
            DealershipOwners = {}
            for _, v in ipairs(results) do
                DealershipOwners[v.dealership_id] = v.owner_citizenid
            end
            -- Sincronizamos con todos los clientes
            TriggerClientEvent('DP-VehicleShop:client:updateOwners', -1, DealershipOwners)
        end)
end

-- =================================================================
-- SECCIÓN 1: CARGA DINÁMICA DEL FRAMEWORK
-- =================================================================

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
-- SECCIÓN 2: INICIALIZACIÓN DE LA BASE DE DATOS
-- =================================================================

local function InitializeDatabaseSchema()
    -- 1. TABLA: Spawns (Escaparate)
    local createSpawnsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_pdmescaparates_spawns` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `name` VARCHAR(50) NOT NULL,
            `x` DECIMAL(10, 2) NOT NULL,
            `y` DECIMAL(10, 2) NOT NULL,
            `z` DECIMAL(10, 2) NOT NULL,
            `h` DECIMAL(10, 2) NOT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_spawn_name` (`name`)
        );
    ]]

    -- 2. TABLA: Vehículos en Exposición (Escaparate)
    local createVehiclesTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_pdmescaparates_vehicles` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `model` VARCHAR(50) NOT NULL,
            `display_name` VARCHAR(100) NOT NULL,
            `spawn_id` INT(11) DEFAULT NULL,
            `date_added` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `setter_citizenid` VARCHAR(50) NOT NULL,
            `setter_name` VARCHAR(100) NOT NULL,
            `price` INT(11) NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`),
            FOREIGN KEY (`spawn_id`) REFERENCES `dp_pdmescaparates_spawns`(`id`) ON DELETE SET NULL
        );
    ]]

    -- 3. TABLA: Concesionarios y Propietarios
    local createDealershipsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_dealerships` (
            `dealership_id` VARCHAR(50) NOT NULL, -- Ej: 'cars', 'motos', 'vip'
            `owner_citizenid` VARCHAR(50) DEFAULT NULL, -- CitizenID del dueño. NULL si pertenece al estado.
            `owner_name` VARCHAR(100) DEFAULT NULL,
            `balance` INT(11) NOT NULL DEFAULT 0, -- Dinero en la cuenta de la empresa
            PRIMARY KEY (`dealership_id`)
        );
    ]]

    -- 4. TABLA: Stock de Vehículos (ACTUALIZADA)
    local createStockTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_stock` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL,
            `vehicle_model` VARCHAR(50) NOT NULL,
            `stock_count` INT(11) NOT NULL DEFAULT 0,
            `category_name` VARCHAR(50) DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_dealer_vehicle` (`dealership_id`, `vehicle_model`),
            FOREIGN KEY (`dealership_id`) REFERENCES `dp_vehicleshop_dealerships`(`dealership_id`) ON DELETE CASCADE
        );
    ]]
    -- exports['oxmysql']:execute(createStockTableQuery) -- (Esta línea la puedes quitar de aquí, ya que se ejecuta abajo en el bloque secuencial)

    -- Parche de seguridad UNIVERSAL (Compatible con versiones antiguas de MySQL/MariaDB)
    exports['oxmysql']:scalar([[
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dp_vehicleshop_stock' AND COLUMN_NAME = 'category_name'
    ]], {}, function(count)
        if tonumber(count) == 0 then
            exports['oxmysql']:execute(
                "ALTER TABLE `dp_vehicleshop_stock` ADD COLUMN `category_name` VARCHAR(50) DEFAULT NULL;")
            print("^2[DP-VehicleShop]^7 Columna 'category_name' añadida correctamente a la base de datos.")
        end
    end)

    -- 5. TABLA: Códigos de Descuento
    local createDiscountsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_discounts` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL,
            `code` VARCHAR(20) NOT NULL, -- Ej: 'VERANO2026'
            `discount_percentage` INT(3) NOT NULL, -- Ej: 15 (para un 15%)
            `uses_left` INT(11) NOT NULL DEFAULT 1, -- Cuántas veces se puede usar en total
            `created_by` VARCHAR(50) NOT NULL, -- CitizenID de quien lo creó
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_discount_code` (`code`),
            FOREIGN KEY (`dealership_id`) REFERENCES `dp_vehicleshop_dealerships`(`dealership_id`) ON DELETE CASCADE
        );
    ]]

    -- 6. TABLA: Logs y Registro de Actividad
    local createLogsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_logs` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL,
            `action_type` VARCHAR(50) NOT NULL, -- Ej: 'SALE', 'HIRE', 'FIRE', 'DEPOSIT', 'WITHDRAW', 'DISCOUNT_USED'
            `actor_citizenid` VARCHAR(50) NOT NULL, -- Quién hizo la acción
            `actor_name` VARCHAR(100) NOT NULL,
            `target_citizenid` VARCHAR(50) DEFAULT NULL, -- Sobre quién recae la acción (Ej: el empleado despedido o el cliente que compró)
            `target_name` VARCHAR(100) DEFAULT NULL,
            `details` TEXT DEFAULT NULL, -- Información extra en formato texto o JSON (Ej: "Vendió un Zentorno por $500,000")
            `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            FOREIGN KEY (`dealership_id`) REFERENCES `dp_vehicleshop_dealerships`(`dealership_id`) ON DELETE CASCADE
        );
    ]]

    -- 7. TABLA: Reservas Pendientes
    local createReservationsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_reservations` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL,
            `customer_citizenid` VARCHAR(50) NOT NULL,
            `customer_name` VARCHAR(100) NOT NULL,
            `vehicle_model` VARCHAR(50) NOT NULL,
            `vehicle_name` VARCHAR(100) NOT NULL,
            `price` INT(11) NOT NULL DEFAULT 0,
            `color` INT(11) NOT NULL DEFAULT 0,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            FOREIGN KEY (`dealership_id`) REFERENCES `dp_vehicleshop_dealerships`(`dealership_id`) ON DELETE CASCADE
        );
    ]]

    -- 8. TABLA: Registro de Ventas Finalizadas
    local createSalesTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_sales` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL,
            `customer_citizenid` VARCHAR(50) NOT NULL,
            `customer_name` VARCHAR(100) NOT NULL,
            `vehicle_model` VARCHAR(50) NOT NULL,
            `vehicle_name` VARCHAR(100) NOT NULL,
            `price` INT(11) NOT NULL,
            `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        );
    ]]

    -- 9. TABLA: Financiaciones y Plazos
    local createFinancesTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_finances` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `citizenid` VARCHAR(50) NOT NULL,
            `vehicle_model` VARCHAR(50) NOT NULL,
            `plate` VARCHAR(15) NOT NULL,
            `total_price` INT(11) NOT NULL,
            `amount_paid` INT(11) NOT NULL DEFAULT 0,
            `amount_remaining` INT(11) NOT NULL,
            `installments_total` INT(11) NOT NULL,
            `installments_paid` INT(11) NOT NULL DEFAULT 0,
            `installment_amount` INT(11) NOT NULL,
            `next_payment` DATETIME NOT NULL,
            PRIMARY KEY (`id`)
        );
    ]]

    --- Ejecución secuencial de las consultas
    exports['oxmysql']:execute(createSpawnsTableQuery, {}, function()
        exports['oxmysql']:execute(createVehiclesTableQuery, {}, function()
            exports['oxmysql']:execute(createDealershipsTableQuery, {}, function()
                exports['oxmysql']:execute(createStockTableQuery, {}, function()
                    exports['oxmysql']:execute(createDiscountsTableQuery, {}, function()
                        exports['oxmysql']:execute(createLogsTableQuery, {}, function()
                            exports['oxmysql']:execute(createReservationsTableQuery, {}, function()
                                exports['oxmysql']:execute(createSalesTableQuery, {}, function()
                                    exports['oxmysql']:execute(createFinancesTableQuery, {}, function()
                                        print(
                                            '^2[DP-VehicleShop] Base de datos Tablas verificadas/creadas correctamente.^7')
                                        -- Cargamos la caché inmediatamente después de crear la DB
                                        RefreshDealerCache()
                                    end)
                                end)
                            end)
                        end)
                    end)
                end)
            end)
        end)
    end)

    -- Sincronizar con jugadores que entran
    RegisterNetEvent('DP-VehicleShop:server:requestOwners', function()
        TriggerClientEvent('DP-VehicleShop:client:updateOwners', source, DealershipOwners)
    end)
end

AddEventHandler('onResourceStart', function(resourceName)
    if GetCurrentResourceName() == resourceName then
        InitializeDatabaseSchema()
    end
end)

-- =================================================================
-- SECCIÓN 3: FUNCIONES DE UTILIDAD
-- =================================================================

local function HasJob(source)
    local src = source
    if not Framework.Core then
        return false
    end
    if type(src) ~= 'number' then
        return false
    end

    local hasJob = false
    if Config.Framework == 'qbcore' then
        local Player = Framework.Core.Functions.GetPlayer(src)
        if Player and Player.PlayerData.job.name == Config.JobName then
            hasJob = true
        end
    elseif Config.Framework == 'esx' or Config.Framework == 'new_esx' then
        local Player = Framework.Core.GetPlayerFromId(src)
        if Player and Player.job and Player.job.name == Config.JobName then
            hasJob = true
        end
    elseif Config.Framework == 'ox' then
        local Player = Framework.Core.GetPlayer(src)
        if Player and Player.job and Player.job == Config.JobName then
            hasJob = true
        end
    end
    return hasJob
end

-- =================================================================
-- SECCIÓN 4: CAPA DE PERSISTENCIA (Base de Datos)
-- =================================================================

local function GetShowroomVehicles(cb)
    local query = [[
        SELECT 
            v.id, v.model, v.display_name, v.spawn_id, v.setter_identifier, v.setter_name, v.price,
            CAST(v.date_added AS CHAR) as date_added,
            s.name AS spawn_name,
            s.x AS spawn_x, 
            s.y AS spawn_y, 
            s.z AS spawn_z, 
            s.h AS spawn_h
        FROM 
            dp_pdmescaparates_vehicles v
        LEFT JOIN 
            dp_pdmescaparates_spawns s ON v.spawn_id = s.id;
    ]]
    exports['oxmysql']:query(query, {}, function(result)
        if result then
            cb(result)
        else
            cb({})
        end
    end)
end

local function GetShowroomSpawns(cb)
    exports['oxmysql']:query('SELECT id, name, x, y, z, h FROM dp_pdmescaparates_spawns', {}, cb)
end

-- Función para recargar la lista en TODOS los clientes
local function ReloadAllClients()
    GetShowroomVehicles(function(vehicles)
        TriggerClientEvent('DP-VehicleShop:client:sendVehicles', -1, vehicles)
    end)
end

local function AddShowroomSpawn(spawnData, src)
    exports['oxmysql']:query('SELECT COUNT(id) as cnt FROM dp_pdmescaparates_spawns WHERE name = ?', {spawnData.name},
        function(result)
            local count = (result and result[1] and result[1].cnt) and tonumber(result[1].cnt) or 0
            if count > 0 then
                TriggerClientEvent('QBCore:Notify', src, _L('error_name_exists', spawnData.name), 'error', 5000)
                return
            end
            exports['oxmysql']:insert('INSERT INTO dp_pdmescaparates_spawns (name, x, y, z, h) VALUES (?, ?, ?, ?, ?)',
                {spawnData.name, spawnData.x, spawnData.y, spawnData.z, spawnData.h}, function()
                    TriggerClientEvent('QBCore:Notify', src, _L('spawn_saved', spawnData.name), 'success', 5000)
                end)
        end)
end

local function AddShowroomVehicle(vehicleData, src)
    local Player = Framework.Core.Functions.GetPlayer(src)
    local playerName =
        Player and (Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname) or 'Desconocido'
    local playerIdentifier = Player and Player.PlayerData.citizenid or 'unknown'
    local price = tonumber(vehicleData.price) or 0

    exports['oxmysql']:insert(
        'INSERT INTO dp_pdmescaparates_vehicles (model, display_name, spawn_id, price, setter_identifier, setter_name) VALUES (?, ?, ?, ?, ?, ?)',
        {vehicleData.model, vehicleData.display_name or vehicleData.model, vehicleData.spawn_id or 0, price,
         playerIdentifier, playerName}, function()
            TriggerClientEvent('QBCore:Notify', src, _L('vehicle_assigned', vehicleData.display_name), 'success', 5000)
            ReloadAllClients()
        end)
end

-- =================================================================
-- SECCIÓN 5: EVENTOS DE RED
-- =================================================================

RegisterNetEvent('DP-VehicleShop:server:getVehicles')
AddEventHandler('DP-VehicleShop:server:getVehicles', function()
    local src = source
    -- Eliminada comprobación de trabajo. Todos deben ver los coches.
    GetShowroomVehicles(function(vehicles)
        TriggerClientEvent('DP-VehicleShop:client:sendVehicles', src, vehicles)
    end)
end)

RegisterNetEvent('DP-VehicleShop:server:getSpawns')
AddEventHandler('DP-VehicleShop:server:getSpawns', function()
    local src = source
    if not HasJob(src) then
        return
    end
    GetShowroomSpawns(function(spawns)
        TriggerClientEvent('DP-VehicleShop:client:sendSpawns', src, spawns)
    end)
end)

RegisterNetEvent('DP-VehicleShop:server:setSpawn')
AddEventHandler('DP-VehicleShop:server:setSpawn', function(spawnData)
    local src = source
    if not HasJob(src) then
        return
    end
    if not spawnData.name or not spawnData.x then
        return
    end
    AddShowroomSpawn(spawnData, src)
end)

RegisterNetEvent('DP-VehicleShop:server:assignVehicle')
AddEventHandler('DP-VehicleShop:server:assignVehicle', function(vehicleData)
    local src = source
    if not HasJob(src) then
        return
    end
    if not vehicleData.model then
        return
    end
    AddShowroomVehicle(vehicleData, src)
end)

RegisterNetEvent('DP-VehicleShop:server:editVehicle')
AddEventHandler('DP-VehicleShop:server:editVehicle', function(vehicleData)
    local src = source
    if not HasJob(src) then
        return
    end

    local price = tonumber(vehicleData.price) or 0

    exports['oxmysql']:execute(
        'UPDATE dp_pdmescaparates_vehicles SET model = ?, display_name = ?, spawn_id = ?, price = ? WHERE id = ?',
        {vehicleData.model, vehicleData.display_name, vehicleData.spawn_id, price, vehicleData.id},
        function(rowsAffected)
            TriggerClientEvent('QBCore:Notify', src, _L('vehicle_updated', vehicleData.display_name), 'success', 5000)
            TriggerClientEvent('DP-VehicleShop:client:deleteVehicleEntity', -1, vehicleData.id)
            ReloadAllClients()
        end)
end)

RegisterNetEvent('DP-VehicleShop:server:deleteVehicle')
AddEventHandler('DP-VehicleShop:server:deleteVehicle', function(vehicleId)
    local src = source
    if not HasJob(src) then
        return
    end

    exports['oxmysql']:execute('DELETE FROM dp_pdmescaparates_vehicles WHERE id = ?', {vehicleId},
        function(rowsAffected)
            TriggerClientEvent('QBCore:Notify', src, _L('vehicle_deleted'), 'success', 5000)
            TriggerClientEvent('DP-VehicleShop:client:deleteVehicleEntity', -1, vehicleId)
            ReloadAllClients()
        end)
end)

-- Función auxiliar para refrescar el menú en vivo
local function RefreshBossData(dealerId, src)
    exports['oxmysql']:execute('SELECT balance FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId},
        function(balResult)
            local balance = balResult[1] and balResult[1].balance or 0

            -- 1. Obtenemos los Logs (Ingresos/Retiros)
            exports['oxmysql']:execute(
                "SELECT actor_name, action_type, details, DATE_FORMAT(timestamp, '%d-%m-%Y | %H:%i') as date FROM dp_vehicleshop_logs WHERE dealership_id = ? AND action_type IN ('DEPOSITO', 'RETIRO', 'VENTA_VEHICULO') ORDER BY timestamp DESC LIMIT 20",
                {dealerId}, function(logsResult)
                    local formattedLogs = {}
                    for _, log in ipairs(logsResult) do
                        local detailsObj = json.decode(log.details) or {}
                        table.insert(formattedLogs, {
                            employee = log.actor_name,
                            action = log.action_type,
                            rank = detailsObj.rank or "Sistema",
                            amount = detailsObj.amount or detailsObj.price or 0,
                            date = log.date,
                            model = detailsObj.model or detailsObj.vehicle_name or "N/A"
                        })
                    end

                    -- 2. Obtenemos las últimas Ventas Reales
                    exports['oxmysql']:execute(
                        "SELECT customer_name as buyer, vehicle_name as modelLabel, vehicle_model as modelId, price, DATE_FORMAT(timestamp, '%d-%m-%Y | %H:%i') as date FROM dp_vehicleshop_sales WHERE dealership_id = ? ORDER BY timestamp DESC LIMIT 15",
                        {dealerId}, function(salesResult)
                            -- Enviamos todo al cliente (Boss Menu)
                            TriggerClientEvent('DP-VehicleShop:client:updateBossData', src, balance, formattedLogs,
                                salesResult)
                        end)
                end)
        end)
end

-- Función auxiliar para cargar y enviar las reservas al menú del Jefe
local function RefreshReservationsForBoss(dealerId, src)
    exports['oxmysql']:execute(
        'SELECT * FROM dp_vehicleshop_reservations WHERE dealership_id = ? ORDER BY created_at ASC', {dealerId},
        function(results)
            -- Si no hay resultados, oxmysql devuelve un array vacío, lo cual está bien para el JS
            TriggerClientEvent('DP-VehicleShop:client:updateReservations', src, results)
        end)
end

-- =================================================================
-- SOLICITUD DEL MENÚ DE JEFE
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:requestBossMenu')
AddEventHandler('DP-VehicleShop:server:requestBossMenu', function(dealerId)
    local src = source
    local isAuthorized = false
    local dealerConfig = Config.Dealerships[dealerId]

    if not dealerConfig then
        return
    end

    if Config.Framework == 'qbcore' then
        local Player = Framework.Core.Functions.GetPlayer(src)
        if Player then
            -- ¿Eres el Dueño?
            if DealershipOwners[dealerId] and DealershipOwners[dealerId] == Player.PlayerData.citizenid then
                isAuthorized = true
            end
            -- ¿Eres el Jefe del trabajo?
            if Player.PlayerData.job.name == dealerConfig.job and Player.PlayerData.job.isboss then
                isAuthorized = true
            end
        end
    end

    if isAuthorized then
        -- 1. Cargamos las categorías
        exports['oxmysql']:execute(
            'SELECT * FROM dp_vehicleshop_categories WHERE dealership_id = ? ORDER BY sort_order ASC', {dealerId},
            function(catResult)
                local cats = {}
                for _, v in ipairs(catResult) do
                    table.insert(cats, {
                        id = v.id,
                        name = v.category_name,
                        label = v.category_label,
                        order = v.sort_order
                    })
                end

                -- 2. Buscamos el stock y la CATEGORÍA de la base de datos
                exports['oxmysql']:execute(
                    'SELECT vehicle_model, stock_count, category_name FROM dp_vehicleshop_stock WHERE dealership_id = ?',
                    {dealerId}, function(stockResult)
                        local currentStock = {}
                        if stockResult then
                            for _, s in ipairs(stockResult) do
                                currentStock[s.vehicle_model] = {
                                    count = s.stock_count,
                                    category = s.category_name -- Guardamos la categoría aquí
                                }
                            end
                        end

                        -- 3. EXTRACCIÓN DE RANGOS DEL TRABAJO (QBCore)
                        local jobGrades = {}
                        if Config.Framework == 'qbcore' then
                            local jobName = dealerConfig.job
                            local sharedJob = Framework.Core.Shared.Jobs[jobName]
                            if sharedJob and sharedJob.grades then
                                for gradeLevel, gradeData in pairs(sharedJob.grades) do
                                    table.insert(jobGrades, {
                                        grade = tonumber(gradeLevel),
                                        name = gradeData.name,
                                        payment = gradeData.payment or 0,
                                        isboss = gradeData.isboss or false,
                                        permissions = gradeData.permissions or {}
                                    })
                                end
                                table.sort(jobGrades, function(a, b)
                                    return a.grade < b.grade
                                end)
                            end
                        end

                        -- 4. EXTRACCIÓN DE VEHÍCULOS REALES (Con Filtro de Categorías Prohibidas)
                        local dealerVehicles = {}

                        -- Definimos las categorías que NUNCA queremos que aparezcan en el catálogo de compra
                        local excludedCategories = {
                            ['military'] = true,
                            ['emergency'] = true,
                            ['service'] = true,
                            ['commercial'] = true,
                            ['industrial'] = true,
                            ['utility'] = true
                        }

                        if Config.Framework == 'qbcore' and Framework.Core.Shared.Vehicles then
                            for model, v in pairs(Framework.Core.Shared.Vehicles) do
                                local category = v.category and string.lower(v.category) or "sin_categoria"

                                -- ¡FILTRO CLAVE! Si la categoría NO está en la lista negra, seguimos
                                if not excludedCategories[category] then
                                    local match = false
                                    local vType = v.type and string.lower(v.type) or ""
                                    local vShop = v.shop and string.lower(v.shop) or ""

                                    if dealerId == 'cars' then
                                        if vType == 'automobile' and vShop == 'pdm' then
                                            match = true
                                        end
                                    elseif dealerId == 'bikes' then
                                        if vType == 'bike' and vShop == 'pdm' then
                                            match = true
                                        end
                                    elseif dealerId == 'sea' then
                                        if vType == 'boat' and vShop == 'boats' then
                                            match = true
                                        end
                                    elseif dealerId == 'air' then
                                        if (vType == 'heli' or vType == 'plane') and vShop == 'air' then
                                            match = true
                                        end
                                    elseif dealerId == 'vip' then
                                        if vType == 'automobile' and vShop == 'luxury' then
                                            match = true
                                        end
                                    end

                                    if match then
                                        local stockData = currentStock[model] or {}
                                        table.insert(dealerVehicles, {
                                            model = model,
                                            name = v.name or 'Desconocido',
                                            brand = v.brand or 'Custom',
                                            price = tonumber(v.price) or 0,
                                            type = v.type,
                                            shop = v.shop,
                                            stock = stockData.count or 0,
                                            category = stockData.category
                                        })
                                    end
                                end
                            end

                            table.sort(dealerVehicles, function(a, b)
                                if a.brand == b.brand then
                                    return (a.name or "") < (b.name or "")
                                end
                                return (a.brand or "") < (b.brand or "")
                            end)
                        end

                        -- Mandamos los datos básicos al cliente
                        TriggerClientEvent('DP-VehicleShop:client:openBossMenu', src, dealerId, dealerConfig.label,
                            cats, jobGrades, dealerVehicles)
                        RefreshBossData(dealerId, src)

                        -- Cargamos y enviamos las reservas pendientes a ese Jefe
                        RefreshReservationsForBoss(dealerId, src)
                    end)
            end)
    else
        TriggerClientEvent('QBCore:Notify', src, 'Solo el dueño o el gerente pueden acceder a este panel.', 'error',
            5000)
    end
end)

-- =================================================================
-- SOLICITUD DEL SHOWROOM (CATÁLOGO DE CLIENTES)
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:requestShowroom')
AddEventHandler('DP-VehicleShop:server:requestShowroom', function(dealerId)
    local src = source

    -- 0. Identificamos al jugador para buscar sus reservas personales
    local citizenid = "unknown"
    if Config.Framework == 'qbcore' then
        local Player = Framework.Core.Functions.GetPlayer(src)
        if Player then
            citizenid = Player.PlayerData.citizenid
        end
    elseif Config.Framework == 'esx' or Config.Framework == 'new_esx' then
        local Player = Framework.Core.GetPlayerFromId(src)
        if Player then
            citizenid = Player.identifier
        end
    end

    -- 1. Buscamos las categorías
    exports['oxmysql']:execute(
        'SELECT * FROM dp_vehicleshop_categories WHERE dealership_id = ? ORDER BY sort_order ASC', {dealerId},
        function(catResult)
            local cats = {}
            for _, v in ipairs(catResult) do
                table.insert(cats, {
                    id = v.id,
                    name = v.category_name,
                    label = v.category_label,
                    order = v.sort_order
                })
            end

            -- 2. Buscamos el stock real en la base de datos
            exports['oxmysql']:execute(
                'SELECT vehicle_model, stock_count, category_name FROM dp_vehicleshop_stock WHERE dealership_id = ?',
                {dealerId}, function(stockResult)
                    local currentStock = {}
                    if stockResult then
                        for _, s in ipairs(stockResult) do
                            currentStock[s.vehicle_model] = {
                                count = s.stock_count,
                                category = s.category_name
                            }
                        end
                    end

                    -- 3. Construimos la lista de vehículos (Aplicando los filtros de concesionario)
                    local dealerVehicles = {}
                    local excludedCategories = {
                        ['military'] = true,
                        ['emergency'] = true,
                        ['service'] = true,
                        ['commercial'] = true,
                        ['industrial'] = true,
                        ['utility'] = true
                    }

                    if Config.Framework == 'qbcore' and Framework.Core.Shared.Vehicles then
                        for model, v in pairs(Framework.Core.Shared.Vehicles) do
                            local category = v.category and string.lower(v.category) or "sin_categoria"

                            if not excludedCategories[category] then
                                local match = false
                                local vType = v.type and string.lower(v.type) or ""
                                local vShop = v.shop and string.lower(v.shop) or ""

                                if dealerId == 'cars' then
                                    if vType == 'automobile' and vShop == 'pdm' then
                                        match = true
                                    end
                                elseif dealerId == 'bikes' then
                                    if vType == 'bike' and vShop == 'pdm' then
                                        match = true
                                    end
                                elseif dealerId == 'sea' then
                                    if vType == 'boat' and vShop == 'boats' then
                                        match = true
                                    end
                                elseif dealerId == 'air' then
                                    if (vType == 'heli' or vType == 'plane') and vShop == 'air' then
                                        match = true
                                    end
                                elseif dealerId == 'vip' then
                                    if vType == 'automobile' and vShop == 'luxury' then
                                        match = true
                                    end
                                end

                                if match then
                                    local stockData = currentStock[model] or {}
                                    table.insert(dealerVehicles, {
                                        model = model,
                                        name = v.name or 'Desconocido',
                                        brand = v.brand or 'Custom',
                                        price = tonumber(v.price) or 0,
                                        type = v.type,
                                        shop = v.shop,
                                        stock = stockData.count or 0,
                                        category = stockData.category
                                    })
                                end
                            end
                        end

                        table.sort(dealerVehicles, function(a, b)
                            if a.brand == b.brand then
                                return (a.name or "") < (b.name or "")
                            end
                            return (a.brand or "") < (b.brand or "")
                        end)
                    end

                    -- 4. Buscamos qué coches tiene reservados ESTE jugador en concreto
                    exports['oxmysql']:execute(
                        'SELECT vehicle_model FROM dp_vehicleshop_reservations WHERE customer_citizenid = ?',
                        {citizenid}, function(resResult)
                            local myReservations = {}
                            if resResult then
                                for _, r in ipairs(resResult) do
                                    table.insert(myReservations, r.vehicle_model)
                                end
                            end

                            -- Mandamos al cliente las categorías, los vehículos Y LAS RESERVAS DEL JUGADOR
                            TriggerClientEvent('DP-VehicleShop:client:openShowroom', src, dealerId, cats,
                                dealerVehicles, myReservations)
                        end)
                end)
        end)
end)

-- =================================================================
-- FETCH CATEGORÍAS (Para abrir el Showroom)
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:fetchCategories', function(dealerId)
    local src = source
    exports['oxmysql']:execute(
        'SELECT * FROM dp_vehicleshop_categories WHERE dealership_id = ? ORDER BY sort_order ASC', {dealerId},
        function(result)
            local cats = {}
            for _, v in ipairs(result) do
                table.insert(cats, {
                    id = v.id,
                    name = v.category_name,
                    label = v.category_label,
                    order = v.sort_order
                })
            end
            -- AÑADIDO: Devolvemos el dealerId además de las categorías
            TriggerClientEvent('DP-VehicleShop:client:openShowroomWithCats', src, dealerId, cats)
        end)
end)

-- Evento que recibe la orden de Depositar o Retirar desde JS
RegisterNetEvent('DP-VehicleShop:server:bossAction', function(dealerId, action, amount)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    if not Player then
        return
    end

    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig then
        return
    end

    -- Seguridad Extra: Comprobamos que el jugador tenga el trabajo correcto para ESTE concesionario
    if Player.PlayerData.job.name ~= dealerConfig.job or not Player.PlayerData.job.isboss then
        TriggerClientEvent('QBCore:Notify', src, 'No tienes permisos de administración en esta empresa.', 'error')
        return
    end

    local amountNum = math.floor(tonumber(amount) or 0)
    if amountNum <= 0 then
        return
    end

    local employeeName = Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname
    local rankName = Player.PlayerData.job.grade.name or "Gerente"

    if action == 'deposit' then
        if Player.PlayerData.money['bank'] >= amountNum then
            Player.Functions.RemoveMoney('bank', amountNum, "Deposito en empresa: " .. dealerId)

            exports['oxmysql']:execute(
                'UPDATE dp_vehicleshop_dealerships SET balance = balance + ? WHERE dealership_id = ?',
                {amountNum, dealerId}, function()

                    local logDetails = json.encode({
                        amount = amountNum,
                        rank = rankName
                    })
                    exports['oxmysql']:execute(
                        'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, details) VALUES (?, ?, ?, ?, ?)',
                        {dealerId, 'DEPOSITO', Player.PlayerData.citizenid, employeeName, logDetails}, function()
                            RefreshBossData(dealerId, src)
                            TriggerClientEvent('QBCore:Notify', src,
                                'Has depositado $' .. amountNum .. ' en la cuenta de la empresa.', 'success')
                        end)
                end)
        else
            TriggerClientEvent('QBCore:Notify', src, 'No tienes suficientes fondos en tu banco personal.', 'error')
        end

    elseif action == 'withdraw' then
        exports['oxmysql']:query('SELECT balance FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId},
            function(result)
                local currentBalance = 0
                if result and result[1] and result[1].balance then
                    currentBalance = tonumber(result[1].balance)
                end

                if currentBalance >= amountNum then
                    exports['oxmysql']:execute(
                        'UPDATE dp_vehicleshop_dealerships SET balance = balance - ? WHERE dealership_id = ?',
                        {amountNum, dealerId}, function()
                            Player.Functions.AddMoney('bank', amountNum, "Retiro de empresa: " .. dealerId)

                            local logDetails = json.encode({
                                amount = amountNum,
                                rank = rankName
                            })
                            exports['oxmysql']:execute(
                                'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, details) VALUES (?, ?, ?, ?, ?)',
                                {dealerId, 'RETIRO', Player.PlayerData.citizenid, employeeName, logDetails}, function()
                                    RefreshBossData(dealerId, src)
                                    TriggerClientEvent('QBCore:Notify', src,
                                        'Has retirado $' .. amountNum .. ' a tu cuenta bancaria.', 'success')
                                end)
                        end)
                else
                    TriggerClientEvent('QBCore:Notify', src, 'La empresa no dispone de tantos fondos para retirar.',
                        'error')
                end
            end)
    end
end)

RegisterNetEvent('DP-VehicleShop:server:buyDealership', function(dealerId)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    local price = Config.DefaultDealershipPrice

    if Player.PlayerData.money['bank'] >= price then
        Player.Functions.RemoveMoney('bank', price, "Compra de Concesionario: " .. dealerId)

        -- Insertar o actualizar en DB
        exports['oxmysql']:execute(
            'INSERT INTO dp_vehicleshop_dealerships (dealership_id, owner_citizenid, owner_name, balance) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE owner_citizenid = ?, owner_name = ?',
            {dealerId, Player.PlayerData.citizenid,
             Player.PlayerData.charinfo.firstname .. " " .. Player.PlayerData.charinfo.lastname, 0,
             Player.PlayerData.citizenid,
             Player.PlayerData.charinfo.firstname .. " " .. Player.PlayerData.charinfo.lastname}, function()
                RefreshDealerCache()
                TriggerClientEvent('QBCore:Notify', src, '¡Felicidades! Ahora eres dueño de ' .. dealerId, 'success')
            end)
    else
        TriggerClientEvent('QBCore:Notify', src, 'No tienes suficiente dinero en el banco.', 'error')
    end
end)

-- =================================================================
-- SECCIÓN 6: COMANDOS
-- =================================================================

-- COMANDO PARA ABRIR EL MENÚ DE GESTIÓN DEL ESCAPARATE (RESTRINGIDO A TRABAJO)
RegisterCommand(Config.PDM, function(source, args, rawCommand)
    local src = source
    -- El comando SÍ se mantiene restringido, solo el menú de gestión.
    if HasJob(src) then
        TriggerClientEvent('DP-VehicleShop:client:openMenu', src)
    else
        if Config.NotifyOnDeny then
            TriggerClientEvent('QBCore:Notify', src, _L('no_permission'), 'error', 5000)
        end
    end
end)

-- COMANDO DE ADMINISTRACIÓN PARA GENERAR EL ARCHIVO SQL CON EL STOCK INICIAL DE VEHÍCULOS (MAPEO DIRECTO)
RegisterCommand(Config.VehicleList, function(source, args, rawCommand)
    local src = source
    local vehicles = nil

    -- Obtenemos los vehículos (Compatible con QBCore)
    if Config.Framework == 'qbcore' then
        vehicles = Framework.Core.Shared.Vehicles
    end

    if not vehicles then
        print('^1[DP-VehicleShop] Error: No se encontró la tabla de vehículos.^7')
        return
    end

    -- DICCIONARIO DE CATEGORÍAS (Mapeo directo a Concesionarios)
    local dealerMapping = {
        -- Coches (Premium Deluxe Motorsport)
        ['compacts'] = 'cars',
        ['coupes'] = 'cars',
        ['muscle'] = 'cars',
        ['offroad'] = 'cars',
        ['openwheel'] = 'cars',
        ['suvs'] = 'cars',
        ['sedans'] = 'cars',
        ['sportsclassics'] = 'cars',
        ['sports'] = 'cars',
        ['super'] = 'cars',
        ['vans'] = 'cars',

        -- Motos (Sanders Motorcycles)
        ['cycles'] = 'bikes',
        ['motorcycles'] = 'bikes',

        -- Aéreos (Los Santos Flight Sales)
        ['helicopters'] = 'air',
        ['planes'] = 'air',

        -- Marítimos (Nautical Showroom)
        ['boats'] = 'sea',

        -- VIP (Luxury Autos)
        ['luxury'] = 'vip'
    }

    local sqlContent = "-- =================================================================\n"
    sqlContent = sqlContent .. "-- ARCHIVO GENERADO AUTOMÁTICAMENTE: PRIMER STOCK (MAPEO EXACTO)\n"
    sqlContent = sqlContent .. "-- =================================================================\n\n"

    local count = 0

    -- Recorremos todos los vehículos
    for model, v in pairs(vehicles) do
        local category = v.category and string.lower(v.category) or 'sin_categoria'

        -- Buscamos a qué concesionario pertenece esta categoría
        local dealerId = dealerMapping[category]

        -- Si la categoría tiene un concesionario asignado, generamos la línea SQL
        if dealerId then
            local finalCategory = v.category or 'sin_categoria'
            sqlContent = sqlContent .. string.format(
                "INSERT IGNORE INTO `dp_vehicleshop_stock` (`dealership_id`, `vehicle_model`, `stock_count`, `category_name`) VALUES ('%s', '%s', 1000, '%s');\n",
                dealerId, model, finalCategory)
            count = count + 1
        end
    end

    -- Guardar el archivo
    local resourcePath = GetResourcePath(GetCurrentResourceName())
    local file = io.open(resourcePath .. '/primer_stock.sql', 'w')

    if file then
        file:write(sqlContent)
        file:close()
        if src ~= 0 then
            TriggerClientEvent('QBCore:Notify', src,
                '¡ÉXITO! Archivo generado con ' .. count .. ' vehículos mapeados.', 'success', 8000)
        end
        print('^2[DP-VehicleShop]^7 Archivo primer_stock.sql generado (' .. count .. ' vehículos mapeados).')
    else
        if src ~= 0 then
            TriggerClientEvent('QBCore:Notify', src, 'Error: No se pudo crear el archivo.', 'error')
        end
    end
end, true) -- El 'true' al final restringe el comando a administradores mediante el sistema ACE nativo de FiveM

-- =================================================================
-- INICIALIZACIÓN DE CATEGORÍAS (AUTO-CREACIÓN)
-- =================================================================
CreateThread(function()
    -- 1. Crear la tabla si no existe
    exports['oxmysql']:execute([[
        CREATE TABLE IF NOT EXISTS dp_vehicleshop_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dealership_id VARCHAR(50),
            category_name VARCHAR(50),
            category_label VARCHAR(50),
            sort_order INT
        )
    ]], {}, function()
        -- 2. Listado de categorías por defecto según el concesionario
        local defaultCategories = {
            ['cars'] = {{
                n = 'compacts',
                l = 'Compactos'
            }, {
                n = 'coupes',
                l = 'Coupés'
            }, {
                n = 'muscle',
                l = 'Muscle Cars'
            }, {
                n = 'offroad',
                l = 'Off-Road'
            }, {
                n = 'openwheel',
                l = 'Fórmula'
            }, {
                n = 'suvs',
                l = 'SUVs'
            }, {
                n = 'sedans',
                l = 'Sedanes'
            }, {
                n = 'sportsclassics',
                l = 'Deportivos Clásicos'
            }, {
                n = 'sports',
                l = 'Deportivos'
            }, {
                n = 'super',
                l = 'Súper'
            }, {
                n = 'vans',
                l = 'Furgonetas'
            }},
            ['bikes'] = {{
                n = 'cycles',
                l = 'Bicicletas'
            }, {
                n = 'motorcycles',
                l = 'Motocicletas'
            }},
            ['air'] = {{
                n = 'helicopters',
                l = 'Helicópteros'
            }, {
                n = 'planes',
                l = 'Aviones'
            }},
            ['sea'] = {{
                n = 'boats',
                l = 'Barcos'
            }},
            ['vip'] = {{
                n = 'luxury',
                l = 'Exclusivos'
            }}
            -- El 'used' lo dejamos fuera porque como bien has dicho, no lleva categorías normales.
        }

        -- 3. Comprobar e insertar por cada concesionario
        for dealer, cats in pairs(defaultCategories) do
            exports['oxmysql']:scalar('SELECT COUNT(*) FROM dp_vehicleshop_categories WHERE dealership_id = ?',
                {dealer}, function(count)
                    if count == 0 then
                        for i, cat in ipairs(cats) do
                            exports['oxmysql']:execute(
                                'INSERT INTO dp_vehicleshop_categories (dealership_id, category_name, category_label, sort_order) VALUES (?, ?, ?, ?)',
                                {dealer, cat.n, cat.l, i})
                        end
                        print('^2[DP-VehicleShop]^7 Categorías generadas para el concesionario: ' .. dealer)
                    end
                end)
        end
    end)
end)

-- Envía las categorías específicas de un concesionario a quien las pida
Framework.Core.Functions.CreateCallback('DP-VehicleShop:server:getCategories', function(source, cb, dealerId)
    exports['oxmysql']:execute(
        'SELECT * FROM dp_vehicleshop_categories WHERE dealership_id = ? ORDER BY sort_order ASC', {dealerId},
        function(result)
            local cats = {}
            for _, v in ipairs(result) do
                table.insert(cats, {
                    id = v.id,
                    name = v.category_name,
                    label = v.category_label,
                    order = v.sort_order
                })
            end
            cb(cats)
        end)
end)

-- =================================================================
-- CRUD CATEGORÍAS (CREAR, EDITAR, ELIMINAR)
-- =================================================================

-- Función interna para refrescar y enviar las categorías al instante
local function RefreshCategoriesForBoss(dealerId, src)
    exports['oxmysql']:execute(
        'SELECT * FROM dp_vehicleshop_categories WHERE dealership_id = ? ORDER BY sort_order ASC', {dealerId},
        function(catResult)
            local cats = {}
            for _, v in ipairs(catResult) do
                table.insert(cats, {
                    id = v.id,
                    name = v.category_name,
                    label = v.category_label,
                    order = v.sort_order
                })
            end
            -- Le enviamos las categorías nuevas de vuelta al cliente
            TriggerClientEvent('DP-VehicleShop:client:refreshCategories', src, cats)
        end)
end

-- Evento de Guardar/Editar
RegisterNetEvent('DP-VehicleShop:server:saveCategory', function(dealerId, data)
    local src = source
    if data.id then
        -- Si trae ID, significa que estamos EDITANDO una existente
        exports['oxmysql']:execute(
            'UPDATE dp_vehicleshop_categories SET category_name = ?, category_label = ? WHERE id = ?',
            {data.name, data.label, data.id}, function()

                -- MAGIA EN CASCADA: Si ha cambiado el ID interno, actualizamos todo el stock
                if data.oldName and data.oldName ~= data.name then
                    exports['oxmysql']:execute(
                        'UPDATE dp_vehicleshop_stock SET category_name = ? WHERE dealership_id = ? AND category_name = ?',
                        {data.name, dealerId, data.oldName})
                end

                RefreshCategoriesForBoss(dealerId, src)
                TriggerClientEvent('QBCore:Notify', src, 'Categoría actualizada correctamente', 'success')
            end)
    else
        -- CREANDO nueva... Primero buscamos el máximo sort_order actual para colocar la nueva categoría al final
        exports['oxmysql']:scalar('SELECT MAX(sort_order) FROM dp_vehicleshop_categories WHERE dealership_id = ?',
            {dealerId}, function(maxOrder)
                local nextOrder = (maxOrder or 0) + 1
                exports['oxmysql']:execute(
                    'INSERT INTO dp_vehicleshop_categories (dealership_id, category_name, category_label, sort_order) VALUES (?, ?, ?, ?)',
                    {dealerId, data.name, data.label, nextOrder}, function()
                        RefreshCategoriesForBoss(dealerId, src)
                        TriggerClientEvent('QBCore:Notify', src, 'Categoría creada correctamente', 'success')
                    end)
            end)
    end
end)

-- Evento de Eliminar (Con borrado de Stock)
RegisterNetEvent('DP-VehicleShop:server:deleteCategory', function(dealerId, catId, catName)
    local src = source

    -- 1. Primero borramos DE RAÍZ todos los coches en stock que tuvieran esta categoría
    if catName then
        exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_stock WHERE dealership_id = ? AND category_name = ?',
            {dealerId, catName})
    end

    -- 2. Borramos la categoría
    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_categories WHERE id = ?', {catId}, function()
        RefreshCategoriesForBoss(dealerId, src)
        RefreshBossData(dealerId, src) -- Recargamos el menú de Jefe para que desaparezca el stock borrado
        TriggerClientEvent('QBCore:Notify', src, 'Categoría (y sus vehículos) eliminada', 'error')
    end)
end)

-- =================================================================
-- GUARDADO DE JOBS.LUA (A TRAVÉS DE EXPORT A QB-CORE)
-- =================================================================
local function SaveJobsToFile()
    if Config.Framework ~= 'qbcore' then
        return
    end

    local jobs = Framework.Core.Shared.Jobs

    -- Función recursiva para formatear la tabla a texto
    local function serialize(tbl, indent)
        local result = ""
        local formatting = string.rep("    ", indent)
        local isFirst = true

        local keys = {}
        for k in pairs(tbl) do
            table.insert(keys, k)
        end
        table.sort(keys, function(a, b)
            local numA = tonumber(a)
            local numB = tonumber(b)
            if numA and numB then
                return numA < numB
            end
            return tostring(a) < tostring(b)
        end)

        for _, k in ipairs(keys) do
            local v = tbl[k]
            if type(v) ~= "function" and type(v) ~= "userdata" then
                if not isFirst then
                    result = result .. ",\n"
                else
                    isFirst = false
                end

                local keyStr = ""
                if type(k) == "number" then
                    keyStr = "[" .. k .. "]"
                elseif type(k) == "string" and string.match(k, "^%a[%w_]*$") then
                    keyStr = k
                else
                    keyStr = "['" .. tostring(k) .. "']"
                end

                if type(v) == "table" then
                    result = result .. formatting .. keyStr .. " = {\n" .. serialize(v, indent + 1) .. "\n" ..
                                 formatting .. "}"
                elseif type(v) == "string" then
                    local safeStr = string.gsub(v, "'", "\\'")
                    result = result .. formatting .. keyStr .. " = '" .. safeStr .. "'"
                elseif type(v) == "boolean" then
                    result = result .. formatting .. keyStr .. " = " .. tostring(v)
                else
                    result = result .. formatting .. keyStr .. " = " .. tostring(v)
                end
            end
        end
        return result
    end

    local success, serializedData = pcall(serialize, jobs, 1)
    if not success then
        return
    end

    -- ¡LA MAGIA! Le pasamos los datos formateados a qb-core para que él mismo guarde
    local saved = exports['qb-core']:SaveJobsFile(serializedData)

    if saved then
        print(
            "^2[DP-VehicleShop] ÉXITO TOTAL: El archivo jobs.lua original de qb-core se ha modificado automáticamente.^7")
    else
        print("^1[DP-VehicleShop] ERROR: Falla al comunicar con el export de qb-core.^7")
    end

    TriggerClientEvent('QBCore:Client:UpdateObject', -1)
end

-- Función interna para refrescar los rangos al instante en el UI del Jefe
local function RefreshJobGradesForBoss(dealerId, src)
    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig then
        return
    end

    local jobGrades = {}
    if Config.Framework == 'qbcore' then
        local jobName = dealerConfig.job
        local sharedJob = Framework.Core.Shared.Jobs[jobName]
        if sharedJob and sharedJob.grades then
            for gradeLevel, gradeData in pairs(sharedJob.grades) do
                table.insert(jobGrades, {
                    grade = tonumber(gradeLevel),
                    name = gradeData.name,
                    payment = gradeData.payment or 0,
                    isboss = gradeData.isboss or false,
                    permissions = gradeData.permissions or {}
                })
            end
            table.sort(jobGrades, function(a, b)
                return a.grade < b.grade
            end)
        end
    end
    -- Le enviamos las categorías nuevas de vuelta al cliente
    TriggerClientEvent('DP-VehicleShop:client:refreshJobGrades', src, jobGrades)
end

-- =================================================================
-- GUARDADO DE VEHICLES.LUA (A TRAVÉS DE EXPORT A QB-CORE)
-- =================================================================
local function SaveVehiclesToFile()
    if Config.Framework ~= 'qbcore' then
        return
    end

    local vehicles = Framework.Core.Shared.Vehicles

    -- Función recursiva para formatear la tabla a texto Lua legible
    local function serialize(tbl, indent)
        local result = ""
        local formatting = string.rep("    ", indent)
        local isFirst = true

        local keys = {}
        for k in pairs(tbl) do
            table.insert(keys, k)
        end
        table.sort(keys, function(a, b)
            local numA = tonumber(a)
            local numB = tonumber(b)
            if numA and numB then
                return numA < numB
            end
            return tostring(a) < tostring(b)
        end)

        for _, k in ipairs(keys) do
            local v = tbl[k]
            if type(v) ~= "function" and type(v) ~= "userdata" then
                if not isFirst then
                    result = result .. ",\n"
                else
                    isFirst = false
                end

                local keyStr = ""
                if type(k) == "number" then
                    keyStr = "[" .. k .. "]"
                elseif type(k) == "string" and string.match(k, "^%a[%w_]*$") then
                    keyStr = k
                else
                    keyStr = "['" .. tostring(k) .. "']"
                end

                if type(v) == "table" then
                    result = result .. formatting .. keyStr .. " = {\n" .. serialize(v, indent + 1) .. "\n" ..
                                 formatting .. "}"
                elseif type(v) == "string" then
                    local safeStr = string.gsub(v, "'", "\\'")
                    result = result .. formatting .. keyStr .. " = '" .. safeStr .. "'"
                elseif type(v) == "boolean" then
                    result = result .. formatting .. keyStr .. " = " .. tostring(v)
                else
                    result = result .. formatting .. keyStr .. " = " .. tostring(v)
                end
            end
        end
        return result
    end

    local success, serializedData = pcall(serialize, vehicles, 1)
    if not success then
        return
    end

    -- Mandamos los datos al export de qb-core que acabamos de crear
    local saved = exports['qb-core']:SaveVehiclesFile(serializedData)

    if saved then
        print("^2[DP-VehicleShop] ÉXITO TOTAL: El archivo vehicles.lua de qb-core se ha guardado y actualizado.^7")
    else
        print("^1[DP-VehicleShop] ERROR: Falla al comunicar con el export de vehicles de qb-core.^7")
    end

    -- Sincronizamos la memoria RAM de todos los jugadores
    TriggerClientEvent('QBCore:Client:UpdateObject', -1)
end

-- =================================================================
-- EVENTOS DE RANGOS
-- =================================================================

RegisterNetEvent('DP-VehicleShop:server:saveJobGrade', function(dealerId, data)
    local src = source
    if Config.Framework ~= 'qbcore' then
        return
    end

    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig then
        return
    end

    local jobName = dealerConfig.job
    local gradeStr = tostring(data.grade)

    -- 1. Modificar en la memoria RAM al instante
    if not Framework.Core.Shared.Jobs[jobName].grades then
        Framework.Core.Shared.Jobs[jobName].grades = {}
    end

    local isBossFlag = data.isboss
    if not isBossFlag then
        isBossFlag = nil
    end

    -- SOLO UN JEFE POR EMPRESA
    if isBossFlag then
        -- Si este rango va a ser el Jefe, le quitamos el 'isboss' a todos los demás
        for k, v in pairs(Framework.Core.Shared.Jobs[jobName].grades) do
            if v.isboss then
                v.isboss = nil
            end
        end
    end

    -- =================================================================
    -- LIMPIEZA DE PERMISOS: Solo guardamos los que estén marcados
    -- =================================================================
    local activePerms = nil
    if data.permissions then
        for permName, isGranted in pairs(data.permissions) do
            if isGranted then
                if not activePerms then
                    activePerms = {}
                end
                activePerms[permName] = true
            end
        end
    end

    Framework.Core.Shared.Jobs[jobName].grades[gradeStr] = {
        name = data.name,
        payment = data.payment,
        isboss = isBossFlag,
        permissions = activePerms -- Insertamos solo los permisos en true
    }

    -- 2. Guardar en el archivo jobs.lua físicamente
    SaveJobsToFile()

    -- 3. Refrescar UI del jefe visualmente
    RefreshJobGradesForBoss(dealerId, src)
    TriggerClientEvent('QBCore:Notify', src, 'Rango guardado y sincronizado globalmente.', 'success')
end)

RegisterNetEvent('DP-VehicleShop:server:deleteJobGrade', function(dealerId, grade)
    local src = source
    if Config.Framework ~= 'qbcore' then
        return
    end

    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig then
        return
    end

    local jobName = dealerConfig.job
    local gradeStr = tostring(grade)

    -- 1. Eliminar de la RAM al instante
    if Framework.Core.Shared.Jobs[jobName].grades[gradeStr] then
        Framework.Core.Shared.Jobs[jobName].grades[gradeStr] = nil
    end

    -- 2. Guardar en el archivo jobs.lua físicamente
    SaveJobsToFile()

    -- 3. Refrescar UI del jefe visualmente
    RefreshJobGradesForBoss(dealerId, src)
    TriggerClientEvent('QBCore:Notify', src, 'Rango eliminado y sincronizado globalmente.', 'error')
end)

-- =================================================================
-- COMPRA DE STOCK (DESDE EL BOSS MENU)
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:orderStock', function(dealerId, orderData)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    if not Player then
        return
    end

    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig then
        return
    end

    -- Verificamos permisos (Solo Jefes)
    if Player.PlayerData.job.name ~= dealerConfig.job or not Player.PlayerData.job.isboss then
        TriggerClientEvent('QBCore:Notify', src, 'No tienes permisos de gerencia para pedir stock.', 'error')
        return
    end

    -- Limpieza de datos recibidos del cliente
    local qty = math.floor(tonumber(orderData.amount) or 1)
    if qty < 1 then
        qty = 1
    end
    local retailPrice = tonumber(orderData.retailPrice) or 0
    local model = orderData.model
    local category = orderData.category

    -- ==========================================
    -- MATEMÁTICA ANTI-HACKEOS (Descuento Escalonado)
    -- ==========================================
    local baseDiscount = 0.25
    local bulkDiscount = 0

    if qty >= 500 then
        bulkDiscount = 0.12
    elseif qty >= 100 then
        bulkDiscount = 0.08
    elseif qty >= 50 then
        bulkDiscount = 0.05
    elseif qty >= 10 then
        bulkDiscount = 0.02
    end

    local totalDiscount = baseDiscount + bulkDiscount
    local finalUnitCost = math.floor(retailPrice * (1 - totalDiscount))
    local totalOrderCost = finalUnitCost * qty

    -- ==========================================
    -- TRANSACCIÓN
    -- ==========================================
    -- 1. Consultar balance de la empresa
    exports['oxmysql']:scalar('SELECT balance FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId},
        function(balance)
            local currentBalance = tonumber(balance) or 0

            if currentBalance >= totalOrderCost then
                -- 2. Restar dinero a la empresa
                exports['oxmysql']:execute(
                    'UPDATE dp_vehicleshop_dealerships SET balance = balance - ? WHERE dealership_id = ?',
                    {totalOrderCost, dealerId}, function()

                        -- 3. Añadir el stock a la base de datos
                        -- NOTA: Si el coche ya existía, suma el stock y le actualiza la categoría a la nueva que haya elegido
                        exports['oxmysql']:execute([[
                    INSERT INTO dp_vehicleshop_stock (dealership_id, vehicle_model, stock_count, category_name) 
                    VALUES (?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE stock_count = stock_count + ?, category_name = ?
                ]], {dealerId, model, qty, category, qty, category}, function()

                            -- 4. Registrar movimiento en los Logs de la empresa
                            local employeeName = Player.PlayerData.charinfo.firstname .. ' ' ..
                                                     Player.PlayerData.charinfo.lastname
                            local logDetails = json.encode({
                                action = "COMPRA STOCK",
                                model = model,
                                amount = qty,
                                cost = totalOrderCost
                            })

                            exports['oxmysql']:execute(
                                'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, details) VALUES (?, ?, ?, ?, ?)',
                                {dealerId, 'PEDIDO_STOCK', Player.PlayerData.citizenid, employeeName, logDetails},
                                function()

                                    -- 5. Refrescar UI del jefe y notificar éxito
                                    RefreshBossData(dealerId, src)
                                    TriggerClientEvent('QBCore:Notify', src,
                                        string.format('Has comprado %sx %s por $%s', qty, model, totalOrderCost),
                                        'success')
                                end)
                        end)
                    end)
            else
                TriggerClientEvent('QBCore:Notify', src, string.format('La empresa no tiene saldo. Faltan $%s',
                    (totalOrderCost - currentBalance)), 'error')
            end
        end)
end)

-- =================================================================
-- SISTEMA DE RESERVAS (CLIENTES Y JEFES)
-- =================================================================

-- 1. Un jugador normal realiza una reserva desde el Showroom
RegisterNetEvent('DP-VehicleShop:server:reserveVehicle', function(dealerId, vehicleData)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    if not Player then
        return
    end

    local citizenid = Player.PlayerData.citizenid
    local charName = Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname

    local price = tonumber(vehicleData.price) or 0
    local color = tonumber(vehicleData.color) or 0

    exports['oxmysql']:insert(
        'INSERT INTO dp_vehicleshop_reservations (dealership_id, customer_citizenid, customer_name, vehicle_model, vehicle_name, price, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
        {dealerId, citizenid, charName, vehicleData.model, vehicleData.name, price, color}, function(id)
            -- Opcional: Si quisieras, podrías iterar los jugadores conectados y si tienen el job del 'dealerId', mandarles un QBCore:Notify de "Nueva Reserva"
        end)
end)

-- 2. El Jefe CANCELA / RECHAZA una reserva
RegisterNetEvent('DP-VehicleShop:server:cancelReservation', function(reservationId)
    local src = source
    -- Simplemente borramos la reserva de la base de datos
    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_reservations WHERE id = ?', {reservationId}, function(result)
        -- Hemos quitado el "if result > 0" porque oxmysql devuelve una tabla, no un número.
        -- Mandamos la notificación directamente (en rojo porque es un rechazo/cancelación).
        TriggerClientEvent('QBCore:Notify', src, 'Reserva cancelada y eliminada.', 'error')
    end)
end)

-- 3. El Jefe ACEPTA la reserva (TODO: Aquí irá la lógica de cobro)
RegisterNetEvent('DP-VehicleShop:server:acceptReservation', function(reservationId)
    local src = source
    local BossPlayer = Framework.Core.Functions.GetPlayer(src)
    if not BossPlayer then
        return
    end

    exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_reservations WHERE id = ?', {reservationId},
        function(result)
            if not result or not result[1] then
                TriggerClientEvent('QBCore:Notify', src, 'Reserva no encontrada.', 'error')
                return
            end

            local res = result[1]
            local dealerId = res.dealership_id
            local customerId = res.customer_citizenid
            local price = res.price
            local TargetPlayer = Framework.Core.Functions.GetPlayerByCitizenId(customerId)

            -- 1. COBRO AL CLIENTE (Online / Offline)
            if TargetPlayer then
                -- Está conectado: Cobro directo
                if TargetPlayer.Functions.RemoveMoney('bank', price, "Compra vehículo: " .. res.vehicle_name) then
                    FinalizeSale(src, res, BossPlayer)
                else
                    TriggerClientEvent('QBCore:Notify', src, 'El cliente no tiene suficiente dinero en el banco.',
                        'error')
                end
            else
                -- Está desconectado: Magia de SQL para cobrar offline
                exports['oxmysql']:execute("SELECT money FROM players WHERE citizenid = ?", {customerId},
                    function(pData)
                        if pData and pData[1] then
                            local money = json.decode(pData[1].money)
                            if money.bank >= price then
                                money.bank = money.bank - price
                                exports['oxmysql']:execute("UPDATE players SET money = ? WHERE citizenid = ?",
                                    {json.encode(money), customerId}, function()
                                        FinalizeSale(src, res, BossPlayer)
                                    end)
                            else
                                TriggerClientEvent('QBCore:Notify', src,
                                    'El cliente (Offline) no tiene fondos suficientes.', 'error')
                            end
                        end
                    end)
            end
        end)
end)

-- Función interna para no repetir código al finalizar la venta
function FinalizeSale(src, res, BossPlayer)
    local dealerId = res.dealership_id
    local price = res.price

    -- A. Sumar dinero a la empresa
    exports['oxmysql']:execute('UPDATE dp_vehicleshop_dealerships SET balance = balance + ? WHERE dealership_id = ?',
        {price, dealerId})

    -- B. Registrar en la tabla de ventas
    exports['oxmysql']:execute(
        'INSERT INTO dp_vehicleshop_sales (dealership_id, customer_citizenid, customer_name, vehicle_model, vehicle_name, price) VALUES (?, ?, ?, ?, ?, ?)',
        {dealerId, res.customer_citizenid, res.customer_name, res.vehicle_model, res.vehicle_name, price})

    -- C. Registrar en Logs
    local logDetails = json.encode({
        price = price,
        model = res.vehicle_model,
        customer = res.customer_name
    })
    exports['oxmysql']:execute(
        'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, details) VALUES (?, ?, ?, ?, ?)',
        {dealerId, 'VENTA_VEHICULO', BossPlayer.PlayerData.citizenid,
         BossPlayer.PlayerData.charinfo.firstname .. " " .. BossPlayer.PlayerData.charinfo.lastname, logDetails})

    -- D. Borrar la reserva
    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_reservations WHERE id = ?', {res.id})

    -- E. Refrescar el menú para el jefe
    RefreshBossData(dealerId, src)
    RefreshReservationsForBoss(dealerId, src)

    TriggerClientEvent('QBCore:Notify', src, '¡Venta completada! El dinero se ha sumado a la empresa.', 'success')
end

-- =================================================================
-- SISTEMA DE COMPRA DIRECTA Y FINANCIACIÓN (SHOWROOM)
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:buyShowroomVehicle', function(dealerId, vehicleData)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    if not Player then
        return
    end

    local citizenid = Player.PlayerData.citizenid
    local charName = Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname

    local model = vehicleData.model
    local price = tonumber(vehicleData.price) or 0
    local color = tonumber(vehicleData.color) or 0
    local payMethod = vehicleData.paymentType == 'bank' and 'bank' or 'cash'
    local installments = tonumber(vehicleData.installments) or 0

    -- Capturamos cómo quiere la entrega el cliente
    local delivery = vehicleData.deliveryType or 'drive'

    -- 1. Verificar Stock Real
    exports['oxmysql']:execute(
        'SELECT stock_count FROM dp_vehicleshop_stock WHERE dealership_id = ? AND vehicle_model = ?', {dealerId, model},
        function(stockRes)
            if not stockRes or not stockRes[1] or stockRes[1].stock_count <= 0 then
                TriggerClientEvent('QBCore:Notify', src, "Vehículo sin stock.", "error")
                return
            end

            -- 2. Calcular Pago Inicial
            local amountToPayNow = price
            if installments > 1 then
                -- Si es a plazos, el primer pago es una fracción del total
                amountToPayNow = math.floor(price / installments)
            else
                installments = 0 -- Si puso 0 o 1, se paga de golpe
            end

            -- 3. Intentar Cobrar al Jugador (Banco o Efectivo)
            if Player.Functions.RemoveMoney(payMethod, amountToPayNow, "Compra Vehículo: " .. model) then

                -- Generar una Matrícula Aleatoria (Formato genérico, puedes cambiarlo si tienes un generador custom)
                local plate = string.upper(tostring(math.random(10, 99)) .. "DP" .. tostring(math.random(100, 999)))

                -- Preparamos los extras en el formato que entiende la base de datos (Ej: {"1": true, "3": true})
                local formattedExtras = {}
                if vehicleData.extras then
                    for _, extraId in ipairs(vehicleData.extras) do
                        formattedExtras[tostring(extraId)] = true
                    end
                end

                -- 4. Dar el coche al jugador (Guardar en su garaje de QBCore)
                local vehicleProps = json.encode({
                    color1 = color,
                    color2 = color,
                    extras = formattedExtras
                })

                -- Determinamos el estado: 1 = En Garaje, 0 = Fuera
                local vehicleState = 0
                if delivery == 'garage' then
                    vehicleState = 1
                end

                exports['oxmysql']:execute(
                    'INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    -- ¡CORRECCIÓN AQUÍ! Ahora usa 'Pillbox Hill' exacto a tu Config.Garages
                    {Player.PlayerData.license, citizenid, model, GetHashKey(model), vehicleProps, plate,
                     'Pillbox Hill', vehicleState}, function()

                        -- Lógica de Entrega
                        if delivery == 'drive' then
                            -- Le mandamos al cliente la orden de aparecer el coche en la puerta
                            TriggerClientEvent('DP-VehicleShop:client:spawnPurchasedVehicle', src, model, plate, color,
                                dealerId, vehicleData.extras)
                        else
                            -- Si es al garaje, solo le avisamos
                            TriggerClientEvent('QBCore:Notify', src,
                                "Vehículo enviado automáticamente a Pillbox Hill.", "success")
                        end

                        -- 5. Si es financiado, registrar la deuda
                        if installments > 0 then
                            exports['oxmysql']:execute(
                                'INSERT INTO dp_vehicleshop_finances (citizenid, vehicle_model, plate, total_price, amount_paid, amount_remaining, installments_total, installments_paid, installment_amount, next_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))',
                                {citizenid, model, plate, price, amountToPayNow, (price - amountToPayNow), installments,
                                 1, amountToPayNow})
                            TriggerClientEvent('QBCore:Notify', src,
                                "Has financiado el vehículo. Cuota pagada: $" .. amountToPayNow, "success")
                        else
                            if delivery == 'drive' then -- Evitamos doble notificación si ya le avisamos del garaje
                                TriggerClientEvent('QBCore:Notify', src,
                                    "Has comprado el vehículo al contado por $" .. price, "success")
                            end
                        end

                        -- 6. Restar Stock del concesionario
                        exports['oxmysql']:execute(
                            'UPDATE dp_vehicleshop_stock SET stock_count = stock_count - 1 WHERE dealership_id = ? AND vehicle_model = ?',
                            {dealerId, model})

                        -- 7. Sumar el dinero cobrado a la cuenta de la empresa
                        exports['oxmysql']:execute(
                            'UPDATE dp_vehicleshop_dealerships SET balance = balance + ? WHERE dealership_id = ?',
                            {amountToPayNow, dealerId})

                        -- 8. Registrar la venta para las tablas del Jefe
                        exports['oxmysql']:execute(
                            'INSERT INTO dp_vehicleshop_sales (dealership_id, customer_citizenid, customer_name, vehicle_model, vehicle_name, price) VALUES (?, ?, ?, ?, ?, ?)',
                            {dealerId, citizenid, charName, model, vehicleData.name, price})

                        -- 9. Registrar Log financiero
                        local logMethod = (installments > 0) and (payMethod .. " (Financiado)") or payMethod
                        local logDetails = json.encode({
                            price = amountToPayNow,
                            model = model,
                            customer = charName,
                            method = logMethod
                        })
                        exports['oxmysql']:execute(
                            'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, details) VALUES (?, ?, ?, ?, ?)',
                            {dealerId, 'VENTA_VEHICULO', citizenid, charName, logDetails})

                        -- 10. Refrescar el stock en vivo para todos los que miren el catálogo
                        TriggerClientEvent('DP-VehicleShop:client:updateStockCount', -1, model,
                            (stockRes[1].stock_count - 1))
                    end)
            else
                -- Si no tiene dinero
                TriggerClientEvent('QBCore:Notify', src, "No tienes suficientes fondos en: " .. string.upper(payMethod),
                    "error")
            end
        end)
end)
