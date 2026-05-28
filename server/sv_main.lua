-- =================================================================
-- MÓDULO 1: VARIABLES GLOBALES DEL SERVIDOR
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
-- MÓDULO 2: CARGA DEL FRAMEWORK (SOLO QB-CORE)
-- =================================================================
Framework.Core = exports['qb-core']:GetCoreObject()

-- =================================================================
-- MÓDULO 3: INICIALIZACIÓN DE LA BASE DE DATOS
-- =================================================================

-- Construye la lista plana de blips desde la BD y la manda a TODOS los jugadores.
-- Debe estar definida ANTES de InitializeDatabaseSchema para poder llamarla desde dentro.
local function BroadcastDealerBlips()
    exports['oxmysql']:execute('SELECT dealership_id, name, config_data FROM dp_vehicleshop_dealerships', {},
        function(results)
            local blipList = {}
            if results and #results > 0 then
                for _, row in ipairs(results) do
                    local cfg = {}
                    if row.config_data and row.config_data ~= '' then
                        local ok, decoded = pcall(json.decode, row.config_data)
                        if ok and decoded then
                            cfg = decoded
                        end
                    end
                    if cfg.coords and cfg.coords.x then
                        table.insert(blipList, {
                            id = row.dealership_id,
                            name = row.name or string.upper(row.dealership_id),
                            coords = cfg.coords,
                            blip = cfg.blip,
                            color = cfg.color,
                            scale = cfg.scale,
                            disabled = cfg.disabled,
                            config = cfg
                        })
                    end
                end
            end
            TriggerClientEvent('DP-VehicleShop:client:loadDealerBlips', -1, blipList)
        end)
end

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

    -- Parche para soportar colores RGB en las Reservas
    exports['oxmysql']:scalar([[
        SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dp_vehicleshop_reservations' AND COLUMN_NAME = 'color'
    ]], {}, function(dataType)
        if dataType and string.lower(dataType) == 'int' then
            exports['oxmysql']:execute(
                "ALTER TABLE `dp_vehicleshop_reservations` MODIFY COLUMN `color` VARCHAR(50) DEFAULT '0';")
            print("^2[DP-VehicleShop]^7 Columna 'color' de reservas adaptada para soportar RGB Custom.")
        end
    end)

    -- Parche para el sistema de Cupones por Persona
    exports['oxmysql']:scalar([[
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dp_vehicleshop_discounts' AND COLUMN_NAME = 'used_by'
    ]], {}, function(count)
        if tonumber(count) == 0 then
            exports['oxmysql']:execute("ALTER TABLE `dp_vehicleshop_discounts` ADD COLUMN `used_by` LONGTEXT NULL;")
            print("^2[DP-VehicleShop]^7 Columna 'used_by' añadida para rastrear los usos de cupones por jugador.")
        end
    end)

    -- Parche: Añadir columnas dinámicas para el Panel de Administración (Configuración Visual)
    exports['oxmysql']:scalar([[
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dp_vehicleshop_dealerships' AND COLUMN_NAME = 'config_data'
    ]], {}, function(count)
        if tonumber(count) == 0 then
            exports['oxmysql']:execute(
                "ALTER TABLE `dp_vehicleshop_dealerships` ADD COLUMN `name` VARCHAR(100) DEFAULT NULL;")
            exports['oxmysql']:execute(
                "ALTER TABLE `dp_vehicleshop_dealerships` ADD COLUMN `config_data` LONGTEXT DEFAULT NULL;")
            print("^2[DP-VehicleShop]^7 Columnas 'name' y 'config_data' añadidas a dp_vehicleshop_dealerships.")
        end
    end)

    -- 5. TABLA: Códigos de Descuento (REESCRITA PARA EL NUEVO SISTEMA)
    local createDiscountsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_discounts` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL,
            `code` VARCHAR(20) NOT NULL,
            `discount_percentage` INT(3) NOT NULL,
            `vehicles_allowed` LONGTEXT NOT NULL, -- Guardaremos JSON: "ALL" o lista de modelos/categorías
            `is_unlimited_uses` TINYINT(1) NOT NULL DEFAULT 0,
            `uses_left` INT(11) NOT NULL DEFAULT 1,
            `limit_type` VARCHAR(20) NOT NULL DEFAULT 'GLOBAL', -- 'GLOBAL' o 'PER_PERSON'
            `is_unlimited_time` TINYINT(1) NOT NULL DEFAULT 0,
            `start_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `expiration_date` DATETIME NULL,
            `created_by` VARCHAR(50) NOT NULL,
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
            `dealership_id` VARCHAR(50) NOT NULL DEFAULT 'cars',
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

    -- Parche: Asociar las financiaciones al concesionario correcto (Por si la tabla ya existía)
    exports['oxmysql']:scalar([[
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dp_vehicleshop_finances' AND COLUMN_NAME = 'dealership_id'
    ]], {}, function(count)
        if tonumber(count) == 0 then
            exports['oxmysql']:execute(
                "ALTER TABLE `dp_vehicleshop_finances` ADD COLUMN `dealership_id` VARCHAR(50) NOT NULL DEFAULT 'cars' AFTER `id`;")
            print("^2[DP-VehicleShop]^7 Columna 'dealership_id' añadida a financiaciones.")
        end
    end)

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
                                        -- Mandamos los blips a todos los jugadores conectados
                                        BroadcastDealerBlips()
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

-- =================================================================
-- MÓDULO 4: FUNCIONES DE UTILIDAD
-- =================================================================

local function HasJob(source)
    local src = source
    if type(src) ~= 'number' then
        return false
    end

    local Player = Framework.Core.Functions.GetPlayer(src)
    return Player and Player.PlayerData.job.name == Config.JobName
end

-- =================================================================
-- MÓDULO 5: CAPA DE PERSISTENCIA (BASE DE DATOS - ESCAPARATE)
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
-- MÓDULO 6: FUNCIONES AUXILIARES DE REFRESCO (BOSS MENU)
-- =================================================================

-- Función auxiliar para refrescar el menú en vivo
local function RefreshBossData(dealerId, src)
    exports['oxmysql']:execute('SELECT balance FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId},
        function(balResult)
            local balance = balResult[1] and balResult[1].balance or 0

            -- 1. Obtenemos los Logs
            exports['oxmysql']:execute(
                "SELECT actor_name, target_name, action_type, details, DATE_FORMAT(timestamp, '%d-%m-%Y | %H:%i') as date FROM dp_vehicleshop_logs WHERE dealership_id = ? AND action_type IN ('DEPOSITO', 'RETIRO', 'VENTA_VEHICULO', 'SUELDO', 'FINANCE VEHICLE') ORDER BY timestamp DESC LIMIT 20",
                {dealerId}, function(logsResult)
                    local formattedLogs = {}
                    for _, log in ipairs(logsResult) do

                        -- Lógica adaptada para no romper el json.decode con los sueldos
                        local txAmount = 0
                        local txRank = "Sistema"
                        local txModel = "N/A"

                        if log.action_type == 'SUELDO' then
                            -- Si es sueldo, el detail es solo el dinero y el rango está en target_name
                            txAmount = tonumber(log.details) or 0
                            txRank = log.target_name or "Empleado"
                        else
                            -- Si es depósito o venta, lo descodificamos como lo tenías tú
                            local detailsObj = {}
                            if log.details and string.find(log.details, "{") then
                                detailsObj = json.decode(log.details) or {}
                            end
                            txAmount = detailsObj.amount or detailsObj.price or 0
                            txRank = detailsObj.rank or "Sistema"
                            txModel = detailsObj.model or detailsObj.vehicle_name or "N/A"
                        end

                        table.insert(formattedLogs, {
                            employee = log.actor_name,
                            action = log.action_type,
                            rank = txRank,
                            amount = txAmount,
                            date = log.date,
                            model = txModel
                        })
                    end

                    -- 2. Obtenemos las últimas Ventas Reales
                    exports['oxmysql']:execute(
                        "SELECT customer_name as buyer, vehicle_name as modelLabel, vehicle_model as modelId, price, DATE_FORMAT(timestamp, '%d-%m-%Y | %H:%i') as date FROM dp_vehicleshop_sales WHERE dealership_id = ? ORDER BY timestamp DESC LIMIT 15",
                        {dealerId}, function(salesResult)

                            -- 3. Obtenemos los cupones reales de este concesionario
                            exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_discounts WHERE dealership_id = ?',
                                {dealerId}, function(discounts)

                                    -- ENVIAMOS ARGUMENTOS SEPARADOS EXACTAMENTE COMO LOS ESPERA TU CLIENTE
                                    -- Añadiendo 'discounts' como el cuarto argumento
                                    TriggerClientEvent('DP-VehicleShop:client:updateBossData', src, balance,
                                        formattedLogs, salesResult, discounts)

                                end)
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

-- Función interna para refrescar los rangos al instante en el UI del Jefe
local function RefreshJobGradesForBoss(dealerId, src)
    local dealerConfig = Config.Dealerships[dealerId]
    if not dealerConfig then
        return
    end

    local jobGrades = {}
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
    -- Le enviamos las categorías nuevas de vuelta al cliente
    TriggerClientEvent('DP-VehicleShop:client:refreshJobGrades', src, jobGrades)
end

-- =================================================================
-- MÓDULO 7: GUARDADO DE ARCHIVOS (JOBS.LUA Y VEHICLES.LUA)
-- =================================================================

local function SaveJobsToFile()
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

    -- Le pasamos los datos formateados a qb-core para que él mismo guarde
    local saved = exports['qb-core']:SaveJobsFile(serializedData)

    if saved then
        print(
            "^2[DP-VehicleShop] ÉXITO TOTAL: El archivo jobs.lua original de qb-core se ha modificado automáticamente.^7")
    else
        print("^1[DP-VehicleShop] ERROR: Falla al comunicar con el export de qb-core.^7")
    end

    TriggerClientEvent('QBCore:Client:UpdateObject', -1)
end

-- =================================================================
-- GUARDADO DE VEHICLES.LUA (A TRAVÉS DE EXPORT A QB-CORE)
-- =================================================================
local function SaveVehiclesToFile()
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

-- Helper reutilizable: construye la lista de dealers con su config para el panel admin
local function buildAdminDealersList(results)
    local list = {}
    if results and #results > 0 then
        for _, row in ipairs(results) do
            local cfg = {}
            if row.config_data and row.config_data ~= '' then
                local ok, decoded = pcall(json.decode, row.config_data)
                if ok and decoded then
                    cfg = decoded
                end
            end
            table.insert(list, {
                id = row.dealership_id,
                name = row.name or string.upper(row.dealership_id),
                type = 'Vehículos',
                config = cfg
            })
        end
    end
    return list
end

-- =================================================================
-- SINCRONIZACIÓN DE CONCESIONARIOS (BLIPS Y UI ADMIN)
-- =================================================================

-- Función centralizada (Sustituye a tu antiguo buildAdminDealersList)
local function FetchAllDealerships(cb)
    exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_dealerships', {}, function(results)
        local dealershipsData = {}
        if results and #results > 0 then
            for _, row in ipairs(results) do
                -- Parseamos el config_data a un objeto Lua para enviarlo como "config" a JS y Cliente
                local configObj = {}
                if row.config_data and row.config_data ~= "" then
                    configObj = json.decode(row.config_data)
                end

                table.insert(dealershipsData, {
                    id = row.dealership_id,
                    name = row.name or string.upper(row.dealership_id),
                    type = 'Vehículos',
                    config = configObj -- El JS detectará esto mágicamente
                })
            end
        end
        cb(dealershipsData)
    end)
end

-- =================================================================
-- MÓDULO 8: COMANDOS
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

    -- Obtenemos los vehículos de QBCore
    vehicles = Framework.Core.Shared.Vehicles

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
-- COMANDO TEMPORAL DE TESTEO
-- =================================================================
-- Framework.Core.Commands.Add('testnomina', 'Forzar el pago de nóminas de concesionarios (Test)', {}, false,
--     function(source, args)
--         local JobToDealerTest = {}
--         for dealerId, data in pairs(Config.Dealerships) do
--             JobToDealerTest[data.job] = dealerId
--         end

--         local players = Framework.Core.Functions.GetQBPlayers()
--         local empleadosPagados = 0

--         for _, Player in pairs(players) do
--             if Player then
--                 local jobName = Player.PlayerData.job.name
--                 local dealerId = JobToDealerTest[jobName]

--                 if dealerId and Player.PlayerData.job.onduty then
--                     local salary = nil
--                     if Framework.Core.Shared.Jobs[jobName] and
--                         Framework.Core.Shared.Jobs[jobName]['grades'][tostring(Player.PlayerData.job.grade.level)] then
--                         salary =
--                             Framework.Core.Shared.Jobs[jobName]['grades'][tostring(Player.PlayerData.job.grade.level)]
--                                 .payment
--                     end
--                     if not salary then
--                         salary = Player.PlayerData.job.payment
--                     end

--                     if salary and salary > 0 then
--                         empleadosPagados = empleadosPagados + 1
--                         local dealerName = Config.Dealerships[dealerId].label
--                         local balance = exports['oxmysql']:scalarSync(
--                             'SELECT balance FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId})
--                         balance = balance or 0

--                         if balance >= salary then
--                             exports['oxmysql']:execute(
--                                 'UPDATE dp_vehicleshop_dealerships SET balance = balance - ? WHERE dealership_id = ?',
--                                 {salary, dealerId})

--                             -- LOG EN LA TABLA dp_vehicleshop_logs
--                             -- B) Guardamos el LOG en tu tabla YA EXISTENTE (dp_vehicleshop_logs)
--                             local playerName = Player.PlayerData.charinfo.firstname .. " " .. Player.PlayerData.charinfo.lastname

--                             exports['oxmysql']:insert(
--                                 'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, target_name, details) VALUES (?, ?, ?, ?, ?, ?)',
--                                 {dealerId, 'SUELDO', 'SISTEMA', playerName, 'SISTEMA', tostring(salary)})

--                             Player.Functions.AddMoney('bank', salary, 'dealership-salary')
--                             TriggerClientEvent('QBCore:Notify', Player.PlayerData.source,
--                                 'Has recibido tu nómina de $' .. salary .. ' de ' .. dealerName, 'success')
--                         else
--                             TriggerClientEvent('QBCore:Notify', Player.PlayerData.source,
--                                 '¡Tu empresa (' .. dealerName .. ') no tiene fondos para pagar tu nómina de $' ..
--                                     salary .. '!', 'error', 7500)
--                         end
--                     end
--                 end
--             end
--         end

--         TriggerClientEvent('QBCore:Notify', source,
--             'Test finalizado. Se intentó pagar a ' .. empleadosPagados .. ' empleados en servicio.', 'primary')
--     end, 'admin')

-- =================================================================
-- COMANDO TEMPORAL DE PRUEBAS PARA LOGÍSTICA (ELIMINAR EN PRODUCCIÓN)
-- =================================================================
-- RegisterCommand('testdelivery', function(source, args, rawCommand)
--     local src = source
--     local dealerId = 'cars' -- Concesionario donde nacerá el camión

--     -- Lista exacta de los vehículos que has pedido
--     local testModels = {
--         'grotti181',
--         'ballerdef',
--         'gstetrk1c',
--         'gstgoose1b',
--         'zentorno2',
--         'gsticona1',
--     }

--     local batch = {}

--     -- Creamos el paquete simulando que 5 personas acaban de comprar
--     for i, model in ipairs(testModels) do
--         table.insert(batch, {
--             model = model,
--             plate = "TEST00" .. i,
--             color = {r = 255, g = 255, b = 255}, -- Blancos para que se vean bien
--             extras = {},
--             ownerSrc = src
--         })
--     end

--     print('^2[DP-SERVER-TEST]^7 Ejecutando simulación de logística masiva para el ID: ' .. tostring(src))

--     -- Disparamos el evento al cliente al instante, sin temporizadores
--     TriggerClientEvent('DP-VehicleShop:client:StartNPCDelivery', src, dealerId, batch)
-- end, true) -- El 'true' restringe el comando solo a Administradores (God)

-- =================================================================
-- MENÚ DE ADMINISTRADOR (CONFIGURADOR DE CONCESIONARIOS)
-- =================================================================
Framework.Core.Commands.Add(Config.AdminCommand, 'Abrir panel de configuración de concesionarios', {}, false,
    function(source, args)
        local src = source

        -- Hacemos la consulta SQL para obtener todos los concesionarios creados
        exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_dealerships', {}, function(results)
            local adminDealers = buildAdminDealersList(results)

            -- Disparamos el evento al cliente enviando la lista ya procesada
            TriggerClientEvent('DP-VehicleShop:client:openAdminMenu', src, adminDealers)
        end)

    end, 'admin') -- 'admin' asegura que SOLO los dioses puedan usarlo

-- =================================================================
-- MÓDULO 9: EVENTOS DE RED - ESCAPARATE (GESTIÓN INTERNA)
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

-- =================================================================
-- MÓDULO 10: EVENTOS DE RED - BOSS MENU
-- =================================================================

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

    local Player = Framework.Core.Functions.GetPlayer(src)
    if Player then
        if DealershipOwners[dealerId] and DealershipOwners[dealerId] == Player.PlayerData.citizenid then
            isAuthorized = true
        end
        if Player.PlayerData.job.name == dealerConfig.job and Player.PlayerData.job.isboss then
            isAuthorized = true
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

                        if Framework.Core.Shared.Vehicles then
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
-- MÓDULO 11: EVENTOS DE RED - SHOWROOM (CATÁLOGO DE CLIENTES)
-- =================================================================

-- =================================================================
-- SOLICITUD DEL SHOWROOM (CATÁLOGO DE CLIENTES)
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:requestShowroom')
AddEventHandler('DP-VehicleShop:server:requestShowroom', function(dealerId)
    local src = source

    -- 0. Identificamos al jugador para buscar sus reservas personales
    local citizenid = "unknown"
    local Player = Framework.Core.Functions.GetPlayer(src)
    if Player then
        citizenid = Player.PlayerData.citizenid
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

                    if Framework.Core.Shared.Vehicles then
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
-- MÓDULO 12: EVENTOS DE RED - CATEGORÍAS (CRUD)
-- =================================================================

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

    if not dealerId or not catId or not catName then
        return
    end

    -- 1. MÁGIA AQUÍ: En lugar de hacer DELETE, hacemos UPDATE para pasar los coches a "none"
    exports['oxmysql']:execute(
        'UPDATE dp_vehicleshop_stock SET category_name = ? WHERE dealership_id = ? AND category_name = ?',
        {"none", dealerId, catName})

    -- 2. Borramos la categoría de la base de datos
    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_categories WHERE id = ?', {catId}, function()

        -- 3. Actualizamos la memoria RAM (Shared) para que el servidor lo sepa al instante
        local changesMade = false
        for model, vehicleData in pairs(Framework.Core.Shared.Vehicles) do
            if vehicleData.category == catName then
                Framework.Core.Shared.Vehicles[model].category = "none"
                changesMade = true
            end
        end

        -- 4. Guardamos el archivo físico si algún coche fue modificado
        if changesMade then
            SaveVehiclesToFile()
        end

        -- 5. Refrescamos el menú del Jefe (Tus funciones originales)
        RefreshCategoriesForBoss(dealerId, src)
        RefreshBossData(dealerId, src)

        -- 6. Notificamos
        TriggerClientEvent('QBCore:Notify', src, 'Categoría eliminada. Los vehículos ahora están SIN ASIGNAR.',
            'success')
    end)
end)

-- =================================================================
-- MÓDULO 13: EVENTOS DE RED - RANGOS Y PERMISOS
-- =================================================================

RegisterNetEvent('DP-VehicleShop:server:saveJobGrade', function(dealerId, data)
    local src = source
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
-- MÓDULO 14: EVENTOS DE RED - STOCK (COMPRAS AL POR MAYOR)
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
-- MÓDULO 15: SISTEMA DE RESERVAS (CLIENTES Y JEFES)
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

    -- Cogemos el precio base
    local basePrice = tonumber(vehicleData.price) or 0
    local finalPrice = basePrice

    local colorToSave
    if type(vehicleData.color) == 'table' then
        colorToSave = json.encode(vehicleData.color)
    else
        colorToSave = tostring(tonumber(vehicleData.color) or 0)
    end

    -- 1. MATEMÁTICAS: Sumamos la Matrícula Custom
    if vehicleData.plate and vehicleData.plate ~= "" then
        finalPrice = finalPrice + 25000
    end

    -- 2. MATEMÁTICAS: Sumamos los Extras
    local appliedExtras = vehicleData.extras or {}
    if #appliedExtras > 0 then
        finalPrice = finalPrice + (#appliedExtras * 125)
    end

    -- Función que guarda la reserva con el PRECIO FINAL y resta los usos del cupón
    local function SaveReservationToDB(calculatedPrice, discountId, limitType)
        exports['oxmysql']:insert(
            'INSERT INTO dp_vehicleshop_reservations (dealership_id, customer_citizenid, customer_name, vehicle_model, vehicle_name, price, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
            {dealerId, citizenid, charName, vehicleData.model, vehicleData.name, calculatedPrice, colorToSave},
            function(id)

                -- Notificar al CLIENTE
                TriggerClientEvent('QBCore:Notify', src, 'Has reservado el vehículo: ' .. vehicleData.name ..
                    '. Un vendedor te contactará pronto.', 'success', 5000)

                -- Notificar a los EMPLEADOS
                local dealerConfig = Config.Dealerships[dealerId]
                if dealerConfig and dealerConfig.job then
                    local players = Framework.Core.Functions.GetPlayers()
                    for _, playerId in ipairs(players) do
                        local Employee = Framework.Core.Functions.GetPlayer(tonumber(playerId))
                        if Employee and Employee.PlayerData.job.name == dealerConfig.job then
                            TriggerClientEvent('QBCore:Notify', tonumber(playerId),
                                '🔔 NUEVA RESERVA: ' .. charName .. ' ha reservado un ' .. vehicleData.name,
                                'primary', 8000)
                        end
                    end
                end

                -- 💡 LA MAGIA: RESTAR O ANOTAR EL USO DEL CUPÓN AL RESERVAR
                if discountId then
                    if limitType == 'GLOBAL' then
                        exports['oxmysql']:execute(
                            'UPDATE dp_vehicleshop_discounts SET uses_left = uses_left - 1 WHERE id = ?', {discountId})
                    elseif limitType == 'PER_PERSON' then
                        exports['oxmysql']:scalar('SELECT used_by FROM dp_vehicleshop_discounts WHERE id = ?',
                            {discountId}, function(currentUsedBy)
                                local usedByTable = {}
                                if currentUsedBy and currentUsedBy ~= "" then
                                    usedByTable = json.decode(currentUsedBy) or {}
                                end
                                usedByTable[citizenid] = (usedByTable[citizenid] or 0) + 1
                                exports['oxmysql']:execute(
                                    'UPDATE dp_vehicleshop_discounts SET used_by = ? WHERE id = ?',
                                    {json.encode(usedByTable), discountId})
                            end)
                    end
                end
            end)
    end

    -- 3. MATEMÁTICAS: Si le envías un cupón desde JS, le resta el %
    if vehicleData.discountCode and vehicleData.discountCode ~= "" then
        exports['oxmysql']:execute(
            'SELECT id, discount_percentage, is_unlimited_uses, limit_type FROM dp_vehicleshop_discounts WHERE dealership_id = ? AND code = ?',
            {dealerId, vehicleData.discountCode}, function(discRes)
                local discountId = nil
                local limitType = nil

                if discRes and discRes[1] then
                    -- Calculamos el descuento
                    local discountAmount = math.floor(basePrice * (tonumber(discRes[1].discount_percentage) / 100))
                    finalPrice = finalPrice - discountAmount

                    -- Si no es ilimitado, guardamos sus datos para restar un uso
                    if discRes[1].is_unlimited_uses == 0 or discRes[1].is_unlimited_uses == false then
                        discountId = discRes[1].id
                        limitType = discRes[1].limit_type
                    end
                end

                SaveReservationToDB(finalPrice, discountId, limitType)
            end)
    else
        -- Si no hay cupón, guarda con el precio (Base + Extras + Placa)
        SaveReservationToDB(finalPrice, nil, nil)
    end
end)

-- 2. El Jefe CANCELA / RECHAZA una reserva
RegisterNetEvent('DP-VehicleShop:server:cancelReservation', function(reservationId)
    local src = source
    -- Primero buscamos la reserva para saber a qué concesionario pertenece antes de borrarla
    exports['oxmysql']:execute('SELECT dealership_id FROM dp_vehicleshop_reservations WHERE id = ?', {reservationId},
        function(res)
            if res and res[1] then
                local dId = res[1].dealership_id
                exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_reservations WHERE id = ?', {reservationId},
                    function()
                        TriggerClientEvent('QBCore:Notify', src, 'Reserva cancelada y eliminada.', 'error')
                        -- REFRESCAR inmediatamente después de borrar
                        RefreshReservationsForBoss(dId, src)
                    end)
            end
        end)
end)

--- 3. El Jefe ACEPTA la reserva
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
                -- Está conectado: Cobro directo y sacamos su licencia de los datos en vivo
                if TargetPlayer.Functions.RemoveMoney('bank', price, "Compra vehículo: " .. res.vehicle_name) then
                    FinalizeSale(src, res, BossPlayer, TargetPlayer.PlayerData.license)
                else
                    TriggerClientEvent('QBCore:Notify', src, 'El cliente no tiene suficiente dinero en el banco.',
                        'error')
                end
            else
                -- Está desconectado: Magia de SQL para cobrar offline (añadimos 'license' a la consulta)
                exports['oxmysql']:execute("SELECT money, license FROM players WHERE citizenid = ?", {customerId},
                    function(pData)
                        if pData and pData[1] then
                            local money = json.decode(pData[1].money)
                            local customerLicense = pData[1].license

                            if money.bank >= price then
                                money.bank = money.bank - price
                                exports['oxmysql']:execute("UPDATE players SET money = ? WHERE citizenid = ?",
                                    {json.encode(money), customerId}, function()
                                        FinalizeSale(src, res, BossPlayer, customerLicense)
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
function FinalizeSale(src, res, BossPlayer, customerLicense)
    local dealerId = res.dealership_id
    local price = res.price

    -- 1. Generar matrícula aleatoria
    local plate = string.upper(tostring(math.random(10, 99)) .. "DP" .. tostring(math.random(100, 999)))

    -- 2. Procesar el color (Detectar si es RGB Custom guardado como string o un ID normal)
    local colorForProps = 0
    if res.color and string.find(res.color, "{") then
        local dec = json.decode(res.color)
        if dec then
            colorForProps = {tonumber(dec.r) or 255, tonumber(dec.g) or 255, tonumber(dec.b) or 255}
        end
    else
        colorForProps = tonumber(res.color) or 0
    end

    local vehicleProps = json.encode({
        color1 = colorForProps,
        color2 = colorForProps
    })

    -- 3. INSERTAR EL COCHE EN EL GARAJE DEL JUGADOR
    exports['oxmysql']:execute(
        'INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        {customerLicense, res.customer_citizenid, res.vehicle_model, GetHashKey(res.vehicle_model), vehicleProps, plate,
         'Pillbox Hill', 1}, function()

            -- A. Sumar dinero a la empresa
            exports['oxmysql']:execute(
                'UPDATE dp_vehicleshop_dealerships SET balance = balance + ? WHERE dealership_id = ?', {price, dealerId})

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

            -- D. Borrar la reserva y esperar a que termine
            exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_reservations WHERE id = ?', {res.id}, function()
                -- E. Refrescar el menú para el jefe
                RefreshBossData(dealerId, src)
                RefreshReservationsForBoss(dealerId, src)

                TriggerClientEvent('QBCore:Notify', src,
                    '¡Venta completada! Vehículo entregado al garaje del cliente.', 'success')
            end)
        end)
end

-- =================================================================
-- MÓDULO 16: SISTEMA DE COMPRA DIRECTA Y FINANCIACIÓN (SHOWROOM)
-- =================================================================

-- Tabla global para gestionar las colas de logística (El Camión)
local DeliveryQueues = {}

RegisterNetEvent('DP-VehicleShop:server:buyShowroomVehicle', function(dealerId, vehicleData)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    if not Player then
        return
    end

    print('=================================================================')
    print('^6[DP-SERVER-LOGISTICA]^7 NUEVA COMPRA RECIBIDA DE: ' .. Player.PlayerData.name)
    print('^6[DP-SERVER-LOGISTICA]^7 DeliveryType recibido del JS: ' .. tostring(vehicleData.deliveryType))

    local citizenid = Player.PlayerData.citizenid
    local charName = Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname

    local model = vehicleData.model
    local price = tonumber(vehicleData.price) or 0

    local colorRaw = vehicleData.color
    local colorForProps
    if type(colorRaw) == 'table' then
        colorForProps = {tonumber(colorRaw.r) or 255, tonumber(colorRaw.g) or 255, tonumber(colorRaw.b) or 255}
    else
        colorForProps = tonumber(colorRaw) or 0
    end

    local isFinance = (vehicleData.paymentType == 'finance')
    local payMethod = (vehicleData.paymentType == 'bank' or isFinance) and 'bank' or 'cash'
    local installments = tonumber(vehicleData.installments) or 0
    local downpayment = tonumber(vehicleData.downpayment) or 0
    local delivery = vehicleData.deliveryType or 'drive'
    local appliedExtras = vehicleData.extras or {}
    local discountCode = vehicleData.discountCode

    print('^6[DP-SERVER-LOGISTICA]^7 Delivery procesado final: ' .. tostring(delivery))
    print('=================================================================')

    exports['oxmysql']:execute(
        'SELECT stock_count FROM dp_vehicleshop_stock WHERE dealership_id = ? AND vehicle_model = ?', {dealerId, model},
        function(stockRes)
            if not stockRes or not stockRes[1] or stockRes[1].stock_count <= 0 then
                TriggerClientEvent('QBCore:Notify', src, "Vehículo sin stock, revisa las RESERVAS PENDIENTES.", "error")
                return
            end

            local function ProcessPurchase(discountAmount, discountId, isUnlimitedUses, limitType)
                local basePrice =
                    Framework.Core.Shared.Vehicles[model] and Framework.Core.Shared.Vehicles[model].price or price
                local finalPrice = basePrice - discountAmount

                if vehicleData.plate and vehicleData.plate ~= "" then
                    finalPrice = finalPrice + 25000
                end
                if appliedExtras and #appliedExtras > 0 then
                    finalPrice = finalPrice + (#appliedExtras * 125)
                end

                price = finalPrice

                local amountToPayNow = price
                local amountRemaining = 0
                local installmentAmount = 0

                if isFinance and installments > 0 then
                    amountToPayNow = downpayment
                    amountRemaining = price - downpayment
                    installmentAmount = math.ceil(amountRemaining / installments)
                else
                    installments = 0
                end

                if Player.Functions.RemoveMoney(payMethod, amountToPayNow, "Compra Vehículo: " .. model) then
                    local plate = vehicleData.plate
                    if not plate or plate == "" then
                        plate = string.upper(tostring(math.random(10, 99)) .. "DP" .. tostring(math.random(100, 999)))
                    end

                    local formattedExtras = {}
                    for _, extraId in ipairs(appliedExtras) do
                        formattedExtras[tostring(extraId)] = false
                    end

                    local vehicleProps = json.encode({
                        color1 = colorForProps,
                        color2 = colorForProps,
                        extras = formattedExtras
                    })
                    local vehicleState = delivery == 'garage' and 1 or 0

                    exports['oxmysql']:execute(
                        'INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        {Player.PlayerData.license, citizenid, model, GetHashKey(model), vehicleProps, plate,
                         'Pillbox Hill', vehicleState}, function()

                            print('^6[DP-SERVER-LOGISTICA]^7 Vehículo guardado en DB. Evaluando entrega...')

                            -- SISTEMA DE BATCHING (COLA DE LOGÍSTICA PARA EL CAMIÓN)
                            if delivery == 'drive' then
                                print('^2[DP-SERVER-LOGISTICA]^7 ES DRIVE. Añadiendo a la cola del Camión.')

                                if not DeliveryQueues[dealerId] then
                                    local secondsLeft = 60 - tonumber(os.date("%S"))
                                    if secondsLeft < 5 then
                                        secondsLeft = secondsLeft + 60
                                    end
                                    print('^2[DP-SERVER-LOGISTICA]^7 Creando nueva cola. Segundos para salir: ' ..
                                              secondsLeft)

                                    DeliveryQueues[dealerId] = {
                                        timer = secondsLeft,
                                        host = src,
                                        vehicles = {}
                                    }

                                    CreateThread(function()
                                        while DeliveryQueues[dealerId] and DeliveryQueues[dealerId].timer > 0 do
                                            Wait(1000)
                                            DeliveryQueues[dealerId].timer = DeliveryQueues[dealerId].timer - 1
                                        end

                                        print(
                                            '^2[DP-SERVER-LOGISTICA]^7 ¡TIEMPO AGOTADO! Ordenando al cliente que spawnee el NPC.')
                                        if DeliveryQueues[dealerId] then
                                            local batch = DeliveryQueues[dealerId].vehicles
                                            local hostClient = DeliveryQueues[dealerId].host

                                            if not GetPlayerPing(hostClient) or GetPlayerPing(hostClient) == 0 then
                                                for _, v in ipairs(batch) do
                                                    if GetPlayerPing(v.ownerSrc) and GetPlayerPing(v.ownerSrc) > 0 then
                                                        hostClient = v.ownerSrc
                                                        break
                                                    end
                                                end
                                            end

                                            TriggerClientEvent('DP-VehicleShop:client:StartNPCDelivery', hostClient,
                                                dealerId, batch)
                                            DeliveryQueues[dealerId] = nil
                                        end
                                    end)
                                end

                                table.insert(DeliveryQueues[dealerId].vehicles, {
                                    model = model,
                                    plate = plate,
                                    color = colorRaw,
                                    extras = appliedExtras,
                                    ownerSrc = src
                                })
                            else
                                print(
                                    '^1[DP-SERVER-LOGISTICA]^7 ES GARAJE. Evitando el camión y enviando notificación directa.')
                                TriggerClientEvent('QBCore:Notify', src, "Vehículo enviado a Pillbox Hill.", "success")
                            end

                            -- REGISTRAR FINANCIACIÓN EN BASE DE DATOS
                            if installments > 0 then
                                exports['oxmysql']:execute(
                                    'INSERT INTO dp_vehicleshop_finances (dealership_id, citizenid, vehicle_model, plate, total_price, amount_paid, amount_remaining, installments_total, installments_paid, installment_amount, next_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))',
                                    {dealerId, citizenid, model, plate, price, amountToPayNow, amountRemaining,
                                     installments, 1, installmentAmount})
                            end

                            exports['oxmysql']:execute(
                                'UPDATE dp_vehicleshop_stock SET stock_count = stock_count - 1 WHERE dealership_id = ? AND vehicle_model = ?',
                                {dealerId, model})
                            exports['oxmysql']:execute(
                                'UPDATE dp_vehicleshop_dealerships SET balance = balance + ? WHERE dealership_id = ?',
                                {amountToPayNow, dealerId})
                            exports['oxmysql']:execute(
                                'INSERT INTO dp_vehicleshop_sales (dealership_id, customer_citizenid, customer_name, vehicle_model, vehicle_name, price) VALUES (?, ?, ?, ?, ?, ?)',
                                {dealerId, citizenid, charName, model, vehicleData.name, price})

                            local logMethod = isFinance and ("FINANCIADO (" .. installments .. " Cuotas)") or payMethod
                            local logDetails = json.encode({
                                price = amountToPayNow,
                                model = model,
                                customer = charName,
                                method = logMethod
                            })

                            exports['oxmysql']:execute(
                                'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, details) VALUES (?, ?, ?, ?, ?)',
                                {dealerId, 'VENTA_VEHICULO', citizenid, charName, logDetails})

                            TriggerClientEvent('DP-VehicleShop:client:updateStockCount', -1, model,
                                (stockRes[1].stock_count - 1))

                            local isUnlimited = (isUnlimitedUses == 1 or isUnlimitedUses == true)
                            if discountId and not isUnlimited then
                                if limitType == 'GLOBAL' then
                                    exports['oxmysql']:execute(
                                        'UPDATE dp_vehicleshop_discounts SET uses_left = uses_left - 1 WHERE id = ?',
                                        {discountId}, function()
                                            RefreshDiscountsForBoss(dealerId, src)
                                        end)
                                elseif limitType == 'PER_PERSON' then
                                    exports['oxmysql']:scalar(
                                        'SELECT used_by FROM dp_vehicleshop_discounts WHERE id = ?', {discountId},
                                        function(currentUsedBy)
                                            local usedByTable = {}
                                            if currentUsedBy and currentUsedBy ~= "" then
                                                usedByTable = json.decode(currentUsedBy) or {}
                                            end
                                            usedByTable[citizenid] = (usedByTable[citizenid] or 0) + 1
                                            exports['oxmysql']:execute(
                                                'UPDATE dp_vehicleshop_discounts SET used_by = ? WHERE id = ?',
                                                {json.encode(usedByTable), discountId})
                                        end)
                                end
                            end
                        end)
                else
                    TriggerClientEvent('QBCore:Notify', src, "No tienes suficientes fondos para el pago/entrada.",
                        "error")
                end
            end

            if discountCode and discountCode ~= "" then
                exports['oxmysql']:execute(
                    'SELECT id, discount_percentage, is_unlimited_uses, uses_left, limit_type, used_by, IF(is_unlimited_time = 1 OR expiration_date >= DATE(NOW()), 1, 0) as valid_date FROM dp_vehicleshop_discounts WHERE dealership_id = ? AND code = ?',
                    {dealerId, discountCode}, function(discRes)
                        if discRes and discRes[1] and discRes[1].valid_date == 1 then
                            local d = discRes[1]
                            local isValidToUse = false
                            local isUnlimited = (d.is_unlimited_uses == 1 or d.is_unlimited_uses == true)

                            if isUnlimited then
                                isValidToUse = true
                            elseif d.limit_type == 'GLOBAL' and d.uses_left > 0 then
                                isValidToUse = true
                            elseif d.limit_type == 'PER_PERSON' then
                                local usedByList = {}
                                if d.used_by and d.used_by ~= "" then
                                    usedByList = json.decode(d.used_by) or {}
                                end
                                if (usedByList[citizenid] or 0) < d.uses_left then
                                    isValidToUse = true
                                end
                            end

                            if isValidToUse then
                                local basePrice = Framework.Core.Shared.Vehicles[model] and
                                                      Framework.Core.Shared.Vehicles[model].price or price
                                local discountAmount = math.floor(basePrice * (tonumber(d.discount_percentage) / 100))
                                ProcessPurchase(discountAmount, d.id, d.is_unlimited_uses, d.limit_type)
                            else
                                TriggerClientEvent('QBCore:Notify', src,
                                    "Este código ya no tiene usos disponibles para ti.", "error")
                            end
                        else
                            TriggerClientEvent('QBCore:Notify', src, "El código ha caducado o es inválido.", "error")
                        end
                    end)
            else
                ProcessPurchase(0, nil, 1, 'GLOBAL')
            end
        end)
end)

-- =================================================================
-- MÓDULO 17: ACTUALIZAR ORDEN DE CATEGORÍAS (FLECHAS)
-- =================================================================

RegisterNetEvent('DP-VehicleShop:server:updateCategoryOrder')
AddEventHandler('DP-VehicleShop:server:updateCategoryOrder', function(orderData)
    local src = source

    if orderData and #orderData > 0 then
        -- Usamos tu columna 'sort_order' para actualizar el orden
        for _, cat in ipairs(orderData) do
            exports['oxmysql']:execute('UPDATE dp_vehicleshop_categories SET sort_order = ? WHERE id = ?',
                {cat.order, cat.id})
        end
    end
end)

-- =================================================================
-- MOVER VEHÍCULO DE CATEGORÍA
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:changeVehicleCategory')
AddEventHandler('DP-VehicleShop:server:changeVehicleCategory', function(dealerId, model, oldCategory, newCategory)
    local src = source

    -- Verificamos que no falten datos críticos
    if not dealerId or not model or not newCategory then
        return
    end

    -- 1. MAGIA AQUÍ: Insertamos el coche si no existe, o lo actualizamos si ya existe
    exports['oxmysql']:execute(
        'INSERT INTO dp_vehicleshop_stock (dealership_id, vehicle_model, stock_count, category_name) VALUES (?, ?, 0, ?) ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)',
        {dealerId, model, newCategory}, function(result)

            -- 2. Actualizamos la memoria RAM (Shared) para que el cambio sea instantáneo
            if Framework.Core.Shared.Vehicles[model] then
                Framework.Core.Shared.Vehicles[model].category = newCategory
            end

            -- 3. EXPORT A TU SHARED (Archivo Físico)
            -- Guardamos permanentemente en el qb-core/shared/vehicles.lua
            SaveVehiclesToFile()

            -- 4. Notificamos al jefe de la empresa
            TriggerClientEvent('QBCore:Notify', src, "Vehículo movido a: " .. string.upper(newCategory), "success")
        end)
end)

-- =================================================================
-- NUEVO: AÑADIDO MASIVO DE VEHÍCULOS A CATEGORÍA (BOSS MENU)
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:massChangeVehicleCategory')
AddEventHandler('DP-VehicleShop:server:massChangeVehicleCategory', function(dealerId, models, newCategory)
    local src = source

    -- Verificamos que no falten datos críticos y que models sea una tabla válida
    if not dealerId or not models or type(models) ~= "table" or #models == 0 or not newCategory then
        return
    end

    local successCount = 0
    local queries = {} -- Usaremos una tabla para la transacción masiva

    -- Recorremos cada coche que nos ha mandado el JavaScript
    for _, model in ipairs(models) do

        -- 1. Verificamos que el vehículo exista en el Shared de QBCore
        if Framework.Core.Shared.Vehicles[model] then

            -- 2. Actualizamos la categoría en la memoria RAM en vivo
            Framework.Core.Shared.Vehicles[model].category = newCategory

            -- 3. Preparamos la consulta blindada para la Base de Datos
            table.insert(queries, {
                query = 'INSERT INTO dp_vehicleshop_stock (dealership_id, vehicle_model, stock_count, category_name) VALUES (?, ?, 0, ?) ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)',
                values = {dealerId, model, newCategory}
            })

            successCount = successCount + 1
        end
    end

    -- Si hemos logrado actualizar al menos 1 vehículo, guardamos el archivo y avisamos
    if successCount > 0 then
        -- Ejecutamos todas las consultas de golpe con oxmysql:transaction
        exports['oxmysql']:transaction(queries, function(result)

            -- 4. EXPORT A TU SHARED (Archivo Físico)
            -- Lo llamamos AQUÍ, fuera del bucle, para que guarde el archivo 1 sola vez de golpe
            SaveVehiclesToFile()

            -- 5. Notificamos al jefe con el número de coches que ha movido
            TriggerClientEvent('QBCore:Notify', src,
                "Has asignado " .. successCount .. " vehículos a la categoría: " .. string.upper(newCategory),
                "success")
        end)
    else
        TriggerClientEvent('QBCore:Notify', src, "Error: No se pudo asignar ningún vehículo.", "error")
    end
end)

-- =================================================================
-- MÓDULO 18: PRUEBA DE MANEJO (TEST DRIVE)
-- =================================================================

-- Export para que DP-AdminMenu pueda usarlo también si quiere
exports('setPlayerBucket', function(targetSrc, bucket)
    SetPlayerRoutingBucket(targetSrc, bucket)
end)

RegisterNetEvent('DP-VehicleShop:server:startTestDrive')
AddEventHandler('DP-VehicleShop:server:startTestDrive', function(dealerId, vehicleData)
    local src = source

    -- Asignamos una dimensión única: BucketBase + server ID del jugador
    local bucket = Config.TestDrive.BucketBase + src

    -- Metemos al jugador en su dimensión privada
    SetPlayerRoutingBucket(src, bucket)

    -- Le mandamos al cliente los datos para que spawnee el coche y arranque el timer
    TriggerClientEvent('DP-VehicleShop:client:beginTestDrive', src, dealerId, vehicleData, bucket)
end)

RegisterNetEvent('DP-VehicleShop:server:endTestDrive')
AddEventHandler('DP-VehicleShop:server:endTestDrive', function()
    local src = source

    -- Devolvemos al jugador al mundo normal (bucket 0)
    SetPlayerRoutingBucket(src, 0)

    -- Avisamos al cliente para que limpie el coche y restaure el showroom
    TriggerClientEvent('DP-VehicleShop:client:finishTestDrive', src)
end)

-- =================================================================
-- MÓDULO 19: SISTEMA DE CUPONES Y DESCUENTOS (BOSS MENU)
-- =================================================================

-- 1. Crear un nuevo cupón desde el modal del Boss Menu
RegisterNetEvent('DP-VehicleShop:server:createDiscount', function(dealerId, data)
    local src = source
    local Player = Framework.Core.Functions.GetPlayer(src)
    if not Player then
        return
    end

    -- SOLUCIÓN: Convertir el string vacío en nil para que MySQL lo lea como NULL
    local expirationDate = data.expiration
    if expirationDate == "" or expirationDate == nil then
        expirationDate = nil
    end

    -- SQL Insert con todos los campos del modal
    exports['oxmysql']:insert(
        'INSERT INTO dp_vehicleshop_discounts (dealership_id, code, discount_percentage, vehicles_allowed, is_unlimited_uses, uses_left, limit_type, is_unlimited_time, expiration_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        {dealerId, data.code, tonumber(data.percentage), json.encode(data.vehicles), -- Convertimos el array de etiquetas/categorías a JSON
         data.unlimitedUses and 1 or 0, tonumber(data.uses) or 0, data.limitType, -- 'GLOBAL' o 'PER_PERSON'
        data.unlimitedTime and 1 or 0, expirationDate, -- <--- AHORA SÍ LE PASAMOS LA VARIABLE CORREGIDA, NO data.expiration
         Player.PlayerData.citizenid}, function(id)
            if id then
                TriggerClientEvent('QBCore:Notify', src, 'Cupón "' .. data.code .. '" creado correctamente.', 'success')
                -- Refrescamos la pestaña de Descuentos Activos para el jefe
                RefreshDiscountsForBoss(dealerId, src)
            else
                TriggerClientEvent('QBCore:Notify', src, 'Error al crear el cupón. Quizás el código ya existe.',
                    'error')
            end
        end)
end)

-- 2. Eliminar un cupón existente
RegisterNetEvent('DP-VehicleShop:server:deleteDiscount', function(dealerId, discountId)
    local src = source
    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_discounts WHERE id = ? AND dealership_id = ?',
        {discountId, dealerId}, function(rowsChanged)
            -- FIX: Extraemos el número real si oxmysql nos devuelve una tabla
            local rows = type(rowsChanged) == 'table' and rowsChanged.affectedRows or rowsChanged
            if rows and rows > 0 then
                TriggerClientEvent('QBCore:Notify', src, 'Cupón eliminado correctamente.', 'error')
                RefreshDiscountsForBoss(dealerId, src)
            end
        end)
end)

-- 3. Función auxiliar para refrescar SOLO la tabla de descuentos
function RefreshDiscountsForBoss(dealerId, src)
    exports['oxmysql']:execute(
        'SELECT * FROM dp_vehicleshop_discounts WHERE dealership_id = ? ORDER BY created_at DESC', {dealerId},
        function(results)
            TriggerClientEvent('DP-VehicleShop:client:updateDiscounts', src, results)
        end)
end

-- Evento seguro para Eliminar un concesionario desde el menú
RegisterNetEvent('DP-VehicleShop:server:deleteAdminDealer', function(dealerId)
    local src = source

    -- Verificación DOBLE de seguridad: Confirmamos que el que dispara el evento es Admin real
    if not Framework.Core.Functions.HasPermission(src, 'admin') then
        DropPlayer(src, "Intento de vulneración: Ejecución de evento de admin sin permisos.")
        return
    end

    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId},
        function(affectedRows)
            local rows = type(affectedRows) == 'table' and affectedRows.affectedRows or affectedRows
            if rows and rows > 0 then
                TriggerClientEvent('QBCore:Notify', src, 'Concesionario (' .. dealerId .. ') eliminado correctamente',
                    'success')
                -- Actualizamos la caché global del script para que los cambios se apliquen al momento
                RefreshDealerCache()
            else
                TriggerClientEvent('QBCore:Notify', src, 'Error: No se encontró el concesionario en la base de datos',
                    'error')
            end
        end)
end)

-- =================================================================
-- CALLBACK: VERIFICAR CUPÓN DE DESCUENTO EN EL SHOWROOM
-- =================================================================
Framework.Core.Functions.CreateCallback('DP-VehicleShop:server:verifyDiscount',
    function(source, cb, dealerId, code, model, category)
        local Player = Framework.Core.Functions.GetPlayer(source)
        if not Player then
            return
        end
        local citizenid = Player.PlayerData.citizenid

        exports['oxmysql']:execute(
            'SELECT *, IF(is_unlimited_time = 1 OR expiration_date >= DATE(NOW()), 1, 0) as valid_date FROM dp_vehicleshop_discounts WHERE dealership_id = ? AND code = ?',
            {dealerId, code}, function(result)

                if not result or not result[1] then
                    cb({
                        valid = false,
                        message = "EL CÓDIGO NO EXISTE O NO ES VÁLIDO AQUÍ."
                    })
                    return
                end

                local discount = result[1]

                if discount.valid_date == 0 then
                    cb({
                        valid = false,
                        message = "ESTE CUPÓN HA CADUCADO."
                    })
                    return
                end

                local isUnlimited = (discount.is_unlimited_uses == 1 or discount.is_unlimited_uses == true)
                if not isUnlimited then
                    if discount.limit_type == 'GLOBAL' then
                        if discount.uses_left <= 0 then
                            cb({
                                valid = false,
                                message = "ESTE CUPÓN SE HA AGOTADO (GLOBAL)."
                            })
                            return
                        end
                    elseif discount.limit_type == 'PER_PERSON' then
                        local usedByList = {}
                        if discount.used_by and discount.used_by ~= "" then
                            usedByList = json.decode(discount.used_by) or {}
                        end

                        local myUses = usedByList[citizenid] or 0
                        if myUses >= discount.uses_left then
                            cb({
                                valid = false,
                                message = "YA HAS AGOTADO TUS USOS PERSONALES (" .. myUses .. "/" .. discount.uses_left ..
                                    ")."
                            })
                            return
                        end
                    end
                end

                local allowed = json.decode(discount.vehicles_allowed)
                local isAllowed = false

                if type(allowed) == "string" and allowed == "ALL" then
                    isAllowed = true
                elseif type(allowed) == "table" then
                    for _, v in ipairs(allowed) do
                        if v == "ALL" or v == ("CAT_" .. category) or v == ("VEH_" .. model) then
                            isAllowed = true
                            break
                        end
                    end
                end

                if not isAllowed then
                    cb({
                        valid = false,
                        message = "ESTE CUPÓN NO ES APLICABLE A ESTE MODELO, CATEGORIA O NO EXISTE."
                    })
                    return
                end

                cb({
                    valid = true,
                    percentage = discount.discount_percentage
                })
            end)
    end)

-- =================================================================
-- MÓDULO 17: SISTEMA REALISTA DE NÓMINAS (EMPLEADOS Y JEFES)
-- =================================================================

local JobToDealer = {}
CreateThread(function()
    for dealerId, data in pairs(Config.Dealerships) do
        JobToDealer[data.job] = dealerId
    end
end)

local PAYCHECK_MINUTES = 30

CreateThread(function()
    while true do
        Wait(PAYCHECK_MINUTES * 60 * 1000)
        local players = Framework.Core.Functions.GetQBPlayers()

        for _, Player in pairs(players) do
            if Player then
                local jobName = Player.PlayerData.job.name
                local dealerId = JobToDealer[jobName]

                if dealerId and Player.PlayerData.job.onduty then
                    local salary = nil
                    if Framework.Core.Shared.Jobs[jobName] and
                        Framework.Core.Shared.Jobs[jobName]['grades'][tostring(Player.PlayerData.job.grade.level)] then
                        salary = Framework.Core.Shared.Jobs[jobName]['grades'][tostring(Player.PlayerData.job.grade
                                                                                            .level)].payment
                    end
                    if not salary then
                        salary = Player.PlayerData.job.payment
                    end

                    if salary and salary > 0 then
                        local dealerName = Config.Dealerships[dealerId].label
                        local balance = exports['oxmysql']:scalarSync(
                            'SELECT balance FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {dealerId})
                        balance = balance or 0

                        if balance >= salary then
                            -- A) Restamos el dinero de la empresa
                            exports['oxmysql']:execute(
                                'UPDATE dp_vehicleshop_dealerships SET balance = balance - ? WHERE dealership_id = ?',
                                {salary, dealerId})

                            -- B) Guardamos el LOG en tu tabla YA EXISTENTE (dp_vehicleshop_logs)
                            local playerName = Player.PlayerData.charinfo.firstname .. " " ..
                                                   Player.PlayerData.charinfo.lastname
                            local gradeName = Player.PlayerData.job.grade.name or "Empleado"

                            exports['oxmysql']:insert(
                                'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, target_name, details) VALUES (?, ?, ?, ?, ?, ?)',
                                {dealerId, 'SUELDO', 'SISTEMA', playerName, gradeName, tostring(salary)})

                            -- C) Pagamos al jugador
                            Player.Functions.AddMoney('bank', salary, 'dealership-salary')
                            TriggerClientEvent('QBCore:Notify', Player.PlayerData.source,
                                'Has recibido tu nómina de $' .. salary .. ' de ' .. dealerName, 'success')
                        else
                            TriggerClientEvent('QBCore:Notify', Player.PlayerData.source,
                                '¡Tu empresa (' .. dealerName .. ') no tiene fondos para pagar tu nómina de $' ..
                                    salary .. '!', 'error', 7500)
                        end
                    end
                end
            end
        end
    end
end)

-- =================================================================
-- MÓDULO 18: COBRADOR AUTOMÁTICO DE FINANCIACIONES (CRON)
-- =================================================================
CreateThread(function()
    while true do
        Wait(60 * 60 * 1000) -- Se ejecuta cada 1 hora real

        exports['oxmysql']:execute(
            'SELECT * FROM dp_vehicleshop_finances WHERE amount_remaining > 0 AND next_payment <= NOW()', {},
            function(deudas)
                if not deudas or #deudas == 0 then
                    return
                end

                for _, deuda in ipairs(deudas) do
                    local cuota = tonumber(deuda.installment_amount)
                    local citizenid = deuda.citizenid
                    local dealerId = deuda.dealership_id

                    local Player = Framework.Core.Functions.GetPlayerByCitizenId(citizenid)
                    local cobrado = false

                    if Player then
                        -- Jugador Online: Se lo quitamos en vivo
                        Player.Functions.RemoveMoney('bank', cuota, "Cuota Financiación: " .. deuda.vehicle_model)
                        TriggerClientEvent('QBCore:Notify', Player.PlayerData.source,
                            "Cobro automático: $" .. cuota .. " de tu financiación por el " .. deuda.vehicle_model,
                            "primary")
                        cobrado = true
                    else
                        -- Jugador Offline: Entramos por la puerta de atrás de su base de datos
                        exports['oxmysql']:scalar('SELECT money FROM players WHERE citizenid = ?', {citizenid},
                            function(moneyJSON)
                                if moneyJSON then
                                    local moneyData = json.decode(moneyJSON)
                                    if moneyData and moneyData.bank then
                                        moneyData.bank = moneyData.bank - cuota
                                        exports['oxmysql']:execute('UPDATE players SET money = ? WHERE citizenid = ?',
                                            {json.encode(moneyData), citizenid})
                                    end
                                end
                            end)
                        cobrado = true
                    end

                    if cobrado then
                        -- 1. Restar la deuda
                        exports['oxmysql']:execute(
                            'UPDATE dp_vehicleshop_finances SET amount_paid = amount_paid + ?, amount_remaining = amount_remaining - ?, installments_paid = installments_paid + 1, next_payment = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id = ?',
                            {cuota, cuota, deuda.id})

                        -- 2. Ingresar la cuota al Concesionario
                        exports['oxmysql']:execute(
                            'UPDATE dp_vehicleshop_dealerships SET balance = balance + ? WHERE dealership_id = ?',
                            {cuota, dealerId})

                        -- 3. Crear el LOG para que el Jefe lo vea en la NUI
                        local desc = json.encode({
                            price = cuota,
                            model = deuda.vehicle_model,
                            customer = citizenid,
                            method = "PAGO CUOTA AUTOMÁTICO"
                        })
                        exports['oxmysql']:insert(
                            'INSERT INTO dp_vehicleshop_logs (dealership_id, action_type, actor_citizenid, actor_name, target_name, details) VALUES (?, ?, ?, ?, ?, ?)',
                            {dealerId, 'FINANCE VEHICLE', 'SISTEMA', 'Cobro Automático', 'Cliente', desc})
                    end
                end
            end)
    end
end)

-- =================================================================
-- GUARDADO DE UN NUEVO CONCESIONARIO DESDE EL PANEL DE ADMIN
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:adminSaveNewDealer', function(data)
    local src = source

    -- Seguridad Vital: Confirmar que es admin
    if not Framework.Core.Functions.HasPermission(src, 'admin') then
        DropPlayer(src, "Intento de vulneración: Ejecución de evento de admin sin permisos.")
        return
    end

    local dealerId = data.id
    local dealerName = data.name
    local balanceInicial = 10000000 -- 10 Millones como solicitaste

    -- Empaquetamos la info visual en JSON para guardarla ordenadita en la DB
    local configJSON = json.encode({
        coords = data.coords,
        blip = data.blip,
        color = data.color,
        scale = data.scale
    })

    -- Insertamos el concesionario. (owner_citizenid y owner_name quedan en NULL por defecto, listos para comprar).
    exports['oxmysql']:execute(
        'INSERT INTO dp_vehicleshop_dealerships (dealership_id, name, balance, config_data) VALUES (?, ?, ?, ?)',
        {dealerId, dealerName, balanceInicial, configJSON}, function(affectedRows)
            local rows = type(affectedRows) == 'table' and affectedRows.affectedRows or affectedRows
            if rows and rows > 0 then
                TriggerClientEvent('QBCore:Notify', src, 'Concesionario "' .. dealerName .. '" creado exitosamente.',
                    'success')

                RefreshDealerCache() -- Actualiza la caché del script
                BroadcastDealerBlips() -- Actualiza los blips en el mapa de TODOS los jugadores

                -- Refrescamos la lista de la UI mandándole la info actualizada al JS al instante
                exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_dealerships', {}, function(results)
                    local adminDealers = buildAdminDealersList(results)

                    TriggerClientEvent('DP-VehicleShop:client:openAdminMenu', src, adminDealers)
                end)
            else
                TriggerClientEvent('QBCore:Notify', src, 'Error: Ya existe un concesionario con ese ID o Nombre.',
                    'error')
            end
        end)
end)

-- =================================================================
-- ACTUALIZACIÓN DE UN CONCESIONARIO EXISTENTE DESDE EL PANEL ADMIN
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:adminUpdateDealer', function(data)
    local src = source

    if not Framework.Core.Functions.HasPermission(src, 'admin') then
        DropPlayer(src, "Intento de vulneración: Ejecución de evento de admin sin permisos.")
        return
    end

    if not data.id then
        return
    end

    -- 1. Recuperamos la configuración actual para NO borrar variables existentes
    exports['oxmysql']:execute('SELECT config_data, name FROM dp_vehicleshop_dealerships WHERE dealership_id = ?', {data.id},
        function(results)
            local currentName = data.name
            local configObj = {}
            if results and results[1] then
                if not currentName then
                    currentName = results[1].name
                end
                local currentConfigStr = results[1].config_data
                if currentConfigStr and currentConfigStr ~= "" then
                    configObj = json.decode(currentConfigStr) or {}
                end
            end

            -- 2. Sobrescribimos SOLO los datos que vienen del formulario
            if data.coords then configObj.coords = data.coords end
            if data.blip then configObj.blip = data.blip end
            if data.color then configObj.color = data.color end
            if data.scale then configObj.scale = data.scale end

            if data.showroomPoints and type(data.showroomPoints) == 'table' then
                local showroomPoints = {}
                for _, point in ipairs(data.showroomPoints) do
                    if point and point.coords_npc and point.npc_model then
                        table.insert(showroomPoints, {
                            coords_npc = {
                                x = tonumber(point.coords_npc.x) or 0,
                                y = tonumber(point.coords_npc.y) or 0,
                                z = tonumber(point.coords_npc.z) or 0,
                                h = tonumber(point.coords_npc.h) or 0
                            },
                            npc_model = tostring(point.npc_model),
                            npc_scenario = tostring(point.npc_scenario or '')
                        })
                    end
                end
                configObj.showroomPoints = showroomPoints
            end

            local configJSON = json.encode(configObj)

            -- 3. Guardamos en la base de datos
            exports['oxmysql']:execute(
                'UPDATE dp_vehicleshop_dealerships SET name = ?, config_data = ? WHERE dealership_id = ?',
                {currentName or data.name, configJSON, data.id}, function(affectedRows)
                    local rows = type(affectedRows) == 'table' and affectedRows.affectedRows or affectedRows
                    if rows and rows > 0 then
                        TriggerClientEvent('QBCore:Notify', src, 'Concesionario actualizado correctamente.', 'success')
                        RefreshDealerCache()
                        BroadcastDealerBlips() -- Actualiza los blips en el mapa de TODOS los jugadores
                        exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_dealerships', {}, function(results)
                            TriggerClientEvent('DP-VehicleShop:client:openAdminMenu', src,
                                buildAdminDealersList(results))
                        end)
                    else
                        TriggerClientEvent('QBCore:Notify', src, 'Error al actualizar el concesionario.', 'error')
                    end
                end)
        end)
end)

-- ACTIVAR/DESACTIVAR CONCESIONARIO (TOGGLE)
RegisterNetEvent('DP-VehicleShop:server:adminToggleDealer', function(dealerId)
    local src = source

    if not Framework.Core.Functions.HasPermission(src, 'admin') then
        DropPlayer(src, "Intento de vulneración: Ejecución de evento de admin sin permisos.")
        return
    end

    exports['oxmysql']:execute('SELECT name, config_data FROM dp_vehicleshop_dealerships WHERE dealership_id = ?',
        {dealerId}, function(result)
            if result and result[1] then
                local configObj = {}
                if result[1].config_data and result[1].config_data ~= "" then
                    configObj = json.decode(result[1].config_data) or {}
                end

                -- Invertimos el estado (Si no existe la variable, asume que está activo y lo desactiva)
                configObj.disabled = not configObj.disabled

                local newConfigJSON = json.encode(configObj)

                exports['oxmysql']:execute(
                    'UPDATE dp_vehicleshop_dealerships SET config_data = ? WHERE dealership_id = ?',
                    {newConfigJSON, dealerId}, function(rowsChanged)
                        
                        -- Extraemos el número real si oxmysql nos devuelve una tabla
                        local rows = type(rowsChanged) == 'table' and rowsChanged.affectedRows or rowsChanged
                        
                        if rows and rows > 0 then
                            -- Mandamos la notificación dependiendo de cómo haya quedado
                            local statusStr = configObj.disabled and "ha sido CERRADO." or "ha sido ABIERTO."
                            local notifyType = configObj.disabled and "error" or "success"

                            TriggerClientEvent('QBCore:Notify', src,
                                'El concesionario ' .. (result[1].name or dealerId) .. ' ' .. statusStr, notifyType)
                            BroadcastDealerBlips() -- Actualiza los blips en el mapa de TODOS los jugadores

                            -- Refrescamos la UI del Admin para que vea el cambio
                            exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_dealerships', {}, function(results)
                                TriggerClientEvent('DP-VehicleShop:client:openAdminMenu', src,
                                    buildAdminDealersList(results))
                            end)
                        end
                    end)
            end
        end)
end)

-- Evento que piden los clientes al entrar al servidor para recibir los blips del mapa
-- Usado en InitializeClientLoad() del cl_main.lua (requestOwners ya existe, este es el de blips)
RegisterNetEvent('DP-VehicleShop:server:requestBlips', function()
    local src = source
    exports['oxmysql']:execute('SELECT dealership_id, name, config_data FROM dp_vehicleshop_dealerships', {},
        function(results)
            local blipList = {}
            if results and #results > 0 then
                for _, row in ipairs(results) do
                    local cfg = {}
                    if row.config_data and row.config_data ~= '' then
                        local ok, decoded = pcall(json.decode, row.config_data)
                        if ok and decoded then
                            cfg = decoded
                        end
                    end
                    if cfg.coords and cfg.coords.x then
                        table.insert(blipList, {
                            id = row.dealership_id,
                            name = row.name or string.upper(row.dealership_id),
                            coords = cfg.coords,
                            blip = cfg.blip,
                            color = cfg.color,
                            scale = cfg.scale,
                            disabled = cfg.disabled,
                            config = cfg
                        })
                    end
                end
            end
            TriggerClientEvent('DP-VehicleShop:client:loadDealerBlips', src, blipList)
        end)
end)

-- =================================================================
-- IMPORTAR CONCESIONARIO DESDE JSON
-- =================================================================
RegisterNetEvent('DP-VehicleShop:server:adminImportDealer', function(data)
    local src = source

    -- Seguridad: Confirmar que es admin
    if not Framework.Core.Functions.HasPermission(src, 'admin') then
        DropPlayer(src, "Intento de vulneración: Ejecución de evento de admin sin permisos.")
        return
    end

    -- Validamos estructura básica
    if not data.id or not data.name then
        TriggerClientEvent('QBCore:Notify', src, 'Error: El formato del JSON no es válido.', 'error')
        return
    end

    -- Empaquetamos la configuración (config) del objeto que viene del JSON
    local configData = data.config or {
        coords = data.coords or {x=0, y=0, z=0},
        blip = data.blip or 225,
        color = data.color or 4,
        scale = data.scale or 0.55
    }
    local configJSON = json.encode(configData)

    -- Insertamos el concesionario. Usamos INSERT IGNORE por si ya existe el ID
    exports['oxmysql']:execute(
        'INSERT INTO dp_vehicleshop_dealerships (dealership_id, name, balance, config_data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), config_data = VALUES(config_data)',
        {data.id, data.name, data.balance or 0, configJSON}, function(affectedRows)
            
            local rows = type(affectedRows) == 'table' and affectedRows.affectedRows or affectedRows
            if rows and rows > 0 then
                TriggerClientEvent('QBCore:Notify', src, 'Concesionario "' .. data.name .. '" importado/actualizado con éxito.', 'success')
                
                -- Actualizamos todo el sistema
                RefreshDealerCache()
                BroadcastDealerBlips()

                -- Refrescamos la lista de la UI
                exports['oxmysql']:execute('SELECT * FROM dp_vehicleshop_dealerships', {}, function(results)
                    local adminDealers = buildAdminDealersList(results)
                    TriggerClientEvent('DP-VehicleShop:client:openAdminMenu', src, adminDealers)
                end)
            else
                TriggerClientEvent('QBCore:Notify', src, 'Error al importar el concesionario.', 'error')
            end
        end)
end)