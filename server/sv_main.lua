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

    -- 3. TABLA: Concesionarios y Propietarios (NUEVA)
    local createDealershipsTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_dealerships` (
            `dealership_id` VARCHAR(50) NOT NULL, -- Ej: 'cars', 'motos', 'vip'
            `owner_citizenid` VARCHAR(50) DEFAULT NULL, -- CitizenID del dueño. NULL si pertenece al estado.
            `owner_name` VARCHAR(100) DEFAULT NULL,
            `balance` INT(11) NOT NULL DEFAULT 0, -- Dinero en la cuenta de la empresa
            PRIMARY KEY (`dealership_id`)
        );
    ]]

    -- 4. TABLA: Stock de Vehículos (NUEVA)
    local createStockTableQuery = [[
        CREATE TABLE IF NOT EXISTS `dp_vehicleshop_stock` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `dealership_id` VARCHAR(50) NOT NULL, -- A qué concesionario pertenece el stock
            `vehicle_model` VARCHAR(50) NOT NULL, -- Ej: 'zentorno'
            `stock_count` INT(11) NOT NULL DEFAULT 0, -- Cantidad disponible
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_dealer_vehicle` (`dealership_id`, `vehicle_model`),
            FOREIGN KEY (`dealership_id`) REFERENCES `dp_vehicleshop_dealerships`(`dealership_id`) ON DELETE CASCADE
        );
    ]]

    -- 5. TABLA: Códigos de Descuento (NUEVA)
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

    -- 6. TABLA: Logs y Registro de Actividad (NUEVA)
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

    -- Ejecución secuencial de las consultas
    exports['oxmysql']:execute(createSpawnsTableQuery, {}, function()
        exports['oxmysql']:execute(createVehiclesTableQuery, {}, function()
            exports['oxmysql']:execute(createDealershipsTableQuery, {}, function()
                exports['oxmysql']:execute(createStockTableQuery, {}, function()
                    exports['oxmysql']:execute(createDiscountsTableQuery, {}, function()
                        exports['oxmysql']:execute(createLogsTableQuery, {}, function()
                            print(
                                '^2[DP-VehicleShop] Base de datos (Tablas Multi-Dealer, Stock, Logs y Descuentos) verificada/creada correctamente.^7')

                            -- Cargamos la caché inmediatamente después de crear la DB
                            RefreshDealerCache()

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
            local balance = 0
            if balResult[1] then
                balance = balResult[1].balance
            end

            -- Obtenemos los últimos 50 movimientos de dinero de este concesionario
            exports['oxmysql']:execute(
                "SELECT actor_name, action_type, details, DATE_FORMAT(timestamp, '%d-%m-%Y | %H:%i') as date FROM dp_vehicleshop_logs WHERE dealership_id = ? AND action_type IN ('DEPOSITO', 'RETIRO') ORDER BY timestamp DESC LIMIT 50",
                {dealerId}, function(logsResult)
                    local formattedLogs = {}
                    for _, log in ipairs(logsResult) do
                        -- Decodificamos el JSON que guardamos en 'details' para sacar el rango y la cantidad
                        local detailsObj = json.decode(log.details) or {}
                        table.insert(formattedLogs, {
                            employee = log.actor_name,
                            action = log.action_type,
                            rank = detailsObj.rank or "Desconocido",
                            amount = detailsObj.amount or 0,
                            date = log.date
                        })
                    end
                    TriggerClientEvent('DP-VehicleShop:client:updateBossData', src, balance, formattedLogs)
                end)
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
        -- Si estás autorizado, cargamos las categorías y abrimos el menú
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

                TriggerClientEvent('DP-VehicleShop:client:openBossMenu', src, dealerId, dealerConfig.label, cats)
                RefreshBossData(dealerId, src)
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
    -- Buscamos las categorías y se las pasamos al cliente para que abra el catálogo
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
            TriggerClientEvent('DP-VehicleShop:client:openShowroom', src, dealerId, cats)
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

RegisterCommand(Config.Command, function(source, args, rawCommand)
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
                l = 'Clásicos Deportivos'
            }, {
                n = 'sports',
                l = 'Deportivos'
            }, {
                n = 'super',
                l = 'Súper'
            }, {
                n = 'utility',
                l = 'Utilitarios'
            }, {
                n = 'vans',
                l = 'Furgonetas'
            }, {
                n = 'industrial',
                l = 'Industrial'
            }, {
                n = 'commercial',
                l = 'Comercial'
            }, {
                n = 'service',
                l = 'Servicios'
            }, {
                n = 'military',
                l = 'Militar'
            }},
            ['bikes'] = {{
                n = 'motorcycles',
                l = 'Motocicletas'
            }, {
                n = 'cycles',
                l = 'Bicicletas'
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
                n = 'super',
                l = 'Súper'
            }, {
                n = 'sports',
                l = 'Deportivos'
            }, {
                n = 'sportsclassics',
                l = 'Clásicos Deportivos'
            }, {
                n = 'suvs',
                l = 'SUVs Premium'
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
                RefreshCategoriesForBoss(dealerId, src)
                TriggerClientEvent('QBCore:Notify', src, 'Categoría actualizada correctamente', 'success')
            end)
    else
        -- Si NO trae ID, significa que estamos CREANDO una nueva
        -- Primero buscamos cuál es el último número de orden para ponerla al final
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

-- Evento de Eliminar
RegisterNetEvent('DP-VehicleShop:server:deleteCategory', function(dealerId, catId)
    local src = source
    exports['oxmysql']:execute('DELETE FROM dp_vehicleshop_categories WHERE id = ?', {catId}, function()
        RefreshCategoriesForBoss(dealerId, src)
        TriggerClientEvent('QBCore:Notify', src, 'Categoría eliminada', 'error')
    end)
end)
