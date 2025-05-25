// Variáveis globais
let db;
const DB_NAME = "restaurantManagerDB";
const TABLE_STORE_NAME = "tables";
const DB_VERSION = 2;

// Elementos do DOM
const formSection = document.getElementById("formSection");
const listSection = document.getElementById("listSection");
const btnShowForm = document.getElementById("btnShowForm");
const btnShowList = document.getElementById("btnShowList");
const orderForm = document.getElementById("orderForm");
const tableListContainer = document.getElementById("tableListContainer");

// Inputs do formulário
const tableNumberInput = document.getElementById("tableNumber");
const clientNameInput = document.getElementById("clientName");
const roomNumberInput = document.getElementById("roomNumber");
const orderDetailsInput = document.getElementById("orderDetails");

// Funções de Navegação entre Telas
function showForm() {
    console.log("Chamando showForm");
    if (formSection && listSection) {
        formSection.classList.add("active-section");
        formSection.classList.remove("hidden-section");
        listSection.classList.add("hidden-section");
        listSection.classList.remove("active-section");
        console.log("Classes aplicadas em showForm");
    } else {
        console.error("Erro: formSection ou listSection não encontrados em showForm");
    }
}

function showList() {
    console.log("Chamando showList");
    if (formSection && listSection) {
        console.log("Aplicando classes para mostrar lista...");
        listSection.classList.add("active-section");
        listSection.classList.remove("hidden-section");
        formSection.classList.add("hidden-section");
        formSection.classList.remove("active-section");
        console.log("Classes aplicadas em showList. Chamando loadTables...");
        loadTables(); // Carrega as mesas ao mostrar a lista
    } else {
         console.error("Erro: formSection ou listSection não encontrados em showList");
    }
}

// Inicialização - Adiciona Event Listeners aos botões de navegação
if (btnShowForm && btnShowList) {
    btnShowForm.addEventListener("click", showForm);
    btnShowList.addEventListener("click", showList);
    console.log("Listeners de navegação adicionados.");
} else {
     console.error("Erro: Botões de navegação não encontrados.");
}


// --- Lógica de Persistência de Dados ---

let storageType = "localStorage";

function initDB() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            console.warn("IndexedDB não suportado. Usando LocalStorage.");
            resolve("localStorage");
            return;
        }
        console.log(`Tentando abrir IndexedDB: ${DB_NAME} versão ${DB_VERSION}`);
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            console.log(`Iniciando onupgradeneeded para versão ${DB_VERSION}`);
            try {
                let tableStore;
                if (!db.objectStoreNames.contains(TABLE_STORE_NAME)) {
                    console.log(`Criando object store ${TABLE_STORE_NAME}`);
                    tableStore = db.createObjectStore(TABLE_STORE_NAME, { keyPath: "id" });
                } else {
                    console.log(`Object store ${TABLE_STORE_NAME} já existe.`);
                    const transaction = event.target.transaction; 
                    tableStore = transaction.objectStore(TABLE_STORE_NAME);
                }
                // Garante que o índice exista
                if (!tableStore.indexNames.contains("isOpenIndex")) {
                     console.log(`Criando índice isOpenIndex em ${TABLE_STORE_NAME}.`);
                     tableStore.createIndex("isOpenIndex", "isOpen", { unique: false });
                     console.log("Índice isOpenIndex criado.");
                 } else {
                     console.log("Índice isOpenIndex já existe.");
                 }
                 // Remover stores antigos
                 if (db.objectStoreNames.contains("orders")) {
                     console.log("Removendo object store antigo 'orders'.");
                     db.deleteObjectStore("orders");
                     console.log("Object store 'orders' removido.");
                 }
                 console.log("onupgradeneeded concluído com sucesso.");
            } catch (error) {
                console.error("Erro durante onupgradeneeded:", error);
                reject(error);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("IndexedDB inicializado com sucesso (onsuccess).");
            db.onerror = (event) => {
                 console.error(`Erro no banco de dados: ${event.target.errorCode}`);
            };
            resolve("indexedDB");
        };

        request.onerror = (event) => {
            console.error("Erro ao abrir/inicializar IndexedDB (onerror request):", event.target.error);
            console.warn("Usando LocalStorage como fallback.");
            resolve("localStorage");
        };
    });
}

// --- Funções CRUD --- 

async function getTable(tableId) {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const request = store.get(tableId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.find(t => t.id === tableId));
        });
    }
}

async function addTable(tableData) {
     if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readwrite");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                console.log("Adicionando tabela ao DB:", tableData);
                const request = store.add(tableData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            tables.push(tableData);
            localStorage.setItem(TABLE_STORE_NAME, JSON.stringify(tables));
            resolve(tableData.id);
        });
    }
}

async function updateTable(tableData) {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readwrite");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                 console.log("Atualizando tabela no DB:", tableData);
                const request = store.put(tableData);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve, reject) => {
            let tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            const index = tables.findIndex(t => t.id === tableData.id);
            if (index > -1) {
                tables[index] = tableData;
                localStorage.setItem(TABLE_STORE_NAME, JSON.stringify(tables));
                resolve();
            } else {
                reject("Mesa não encontrada no LocalStorage.");
            }
        });
    }
}

async function getOpenTables() {
    console.log(`Chamando getOpenTables com storageType: ${storageType}`);
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                console.log("Iniciando transação readonly para getOpenTables (getAll)");
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                console.log("Executando getAll() em store");
                const request = store.getAll(); 

                request.onsuccess = () => {
                    console.log("Sucesso no request getAll(). Resultado bruto:", request.result);
                    // Filtrar por isOpen aqui no JS
                    const openTables = request.result.filter(table => table.isOpen === true);
                    console.log("Resultado filtrado (isOpen=true):", openTables);
                    resolve(openTables);
                };
                request.onerror = (event) => {
                    console.error("Erro no request getAll() para getOpenTables:", event.target.error);
                    reject(event.target.error);
                }
                transaction.oncomplete = () => {
                     console.log("Transação readonly getOpenTables (getAll) concluída.");
                }
                 transaction.onerror = (event) => {
                    console.error("Erro na transação getOpenTables (getAll):", event.target.error);
                    reject(event.target.error);
                }
            } catch (error) {
                 console.error("Erro síncrono em getOpenTables (getAll):", error);
                 reject(error);
            }
        });
    } else {
        console.log("Usando fallback LocalStorage para getOpenTables");
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.filter(t => t.isOpen));
        });
    }
}

// --- Lógica do Formulário e Lista de Mesas ---

if (orderForm) {
    orderForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const tableId = parseInt(tableNumberInput.value);
        const clientName = clientNameInput.value.trim();
        const roomNumber = roomNumberInput.value.trim();
        const orderDetails = orderDetailsInput.value.trim();

        if (isNaN(tableId) || tableId <= 0) {
            alert("Número da Mesa inválido.");
            return;
        }
         if (!orderDetails) {
            alert("Detalhes do Pedido são obrigatórios.");
            return;
        }

        console.log(`Tentando adicionar pedido à mesa ${tableId}`);
        try {
            let table = await getTable(tableId);
            console.log(`Resultado getTable(${tableId}):`, table);
            const newOrder = {
                orderId: Date.now(),
                details: orderDetails,
                attended: false,
                timestamp: new Date().toISOString()
            };

            if (table && table.isOpen) {
                console.log(`Mesa ${tableId} encontrada e aberta. Adicionando pedido.`);
                if (!table.orders) table.orders = [];
                table.orders.push(newOrder);
                if (!table.clientName && clientName) table.clientName = clientName;
                if (!table.roomNumber && roomNumber) table.roomNumber = roomNumber;
                await updateTable(table);
                console.log(`Pedido adicionado à mesa ${tableId}. Tabela atualizada.`);
            } else {
                 console.log(`Mesa ${tableId} ${table ? 'fechada' : 'não encontrada'}. Abrindo nova mesa.`);
                if (!clientName) {
                     alert("Nome do Cliente é obrigatório ao abrir uma nova mesa.");
                     return;
                }
                const newTable = {
                    id: tableId,
                    clientName: clientName,
                    roomNumber: roomNumber || null,
                    orders: [newOrder],
                    isOpen: true, // Garantir que isOpen é true
                    openedAt: new Date().toISOString()
                };
                await addTable(newTable);
                console.log(`Nova mesa ${tableId} aberta com o primeiro pedido.`);
            }

            orderForm.reset();
            clientNameInput.value = '';
            roomNumberInput.value = '';
            alert("Pedido adicionado com sucesso!");
            showList();

        } catch (error) {
            console.error("Falha ao adicionar pedido/mesa:", error);
            alert("Erro ao processar pedido. Verifique o console.");
        }
    });
    console.log("Listener de submit adicionado ao formulário.");
} else {
    console.error("Erro: Formulário orderForm não encontrado.");
}


async function loadTables() {
    console.log("Chamando loadTables");
    if (!tableListContainer) {
        console.error("Erro: tableListContainer não encontrado em loadTables.");
        return;
    }
    tableListContainer.innerHTML = "<p>Carregando mesas...</p>"; // Feedback visual
    try {
        const openTables = await getOpenTables();
        console.log("Mesas abertas recebidas em loadTables:", openTables);
        renderTables(openTables);
    } catch (error) {
        console.error("Falha ao carregar mesas (dentro de loadTables):", error);
        tableListContainer.innerHTML = "<p>Erro ao carregar as mesas abertas. Verifique o console.</p>";
    }
}

function renderTables(tables) {
    console.log("Iniciando renderTables com:", tables);
     if (!tableListContainer) {
        console.error("Erro: tableListContainer não encontrado em renderTables.");
        return;
    }
    tableListContainer.innerHTML = "";

    if (!tables || tables.length === 0) {
        console.log("Nenhuma mesa aberta para renderizar.");
        tableListContainer.innerHTML = "<p>Nenhuma mesa aberta no momento.</p>";
        return;
    }

    const ul = document.createElement("ul");
    ul.className = 'table-list';
    tables.sort((a, b) => a.id - b.id);

    tables.forEach(table => {
        console.log(`Renderizando mesa ${table.id}, isOpen: ${table.isOpen}`);
        const li = document.createElement("li");
        li.className = 'table-item';
        li.dataset.tableId = table.id;

        let ordersHtml = '';
        if (table.orders && table.orders.length > 0) {
             ordersHtml = '';
             table.orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
             ordersHtml += table.orders.map(order => `
                <li class="order-item ${order.attended ? 'attended' : ''}" data-order-id="${order.orderId}">
                    <span>${order.details} (${new Date(order.timestamp).toLocaleTimeString()})</span>
                    <label>
                        <input type="checkbox" class="attended-checkbox" ${order.attended ? 'checked' : ''}>
                        Atendido
                    </label>
                </li>
            `).join('');
             ordersHtml += '';
        } else {
            ordersHtml = '<li class="order-item">Nenhum pedido nesta mesa ainda.</li>';
        }

        li.innerHTML = `
            <div class="table-header">
                <h3>Mesa ${table.id}</h3>
                <span>Cliente: ${table.clientName || 'Não informado'}</span>
                ${table.roomNumber ? `<span>Quarto: ${table.roomNumber}</span>` : ''}
                <span>Aberta em: ${new Date(table.openedAt || Date.now()).toLocaleString()}</span>
                <button class="close-table-btn">Fechar Mesa</button>
            </div>
            <div class="table-orders">
                <h4>Pedidos:</h4>
                <ul class="order-list">${ordersHtml}</ul>
            </div>
        `;

        const closeButton = li.querySelector(".close-table-btn");
        if (closeButton) {
            closeButton.addEventListener("click", async () => {
                if (confirm(`Tem certeza que deseja fechar a Mesa ${table.id}?`)) {
                    try {
                        console.log(`Tentando fechar mesa ${table.id}`);
                        let tableToClose = await getTable(table.id);
                        if (tableToClose) {
                            tableToClose.isOpen = false;
                            await updateTable(tableToClose);
                            console.log(`Mesa ${table.id} marcada como fechada no DB.`);
                            loadTables();
                        } else {
                             console.error(`Mesa ${table.id} não encontrada para fechar.`);
                             alert("Erro: Mesa não encontrada.");
                        }
                    } catch (error) {
                        console.error(`Erro ao fechar mesa ${table.id}:`, error);
                        alert("Erro ao fechar a mesa.");
                    }
                }
            });
        } else {
             console.error(`Botão Fechar Mesa não encontrado para mesa ${table.id}`);
        }

        const checkboxes = li.querySelectorAll(".attended-checkbox");
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener("change", async (event) => {
                const orderItemLi = event.target.closest('.order-item');
                const orderId = Number(orderItemLi.dataset.orderId);
                const isAttended = event.target.checked;
                const tableId = Number(li.dataset.tableId);

                try {
                    console.log(`Tentando atualizar status do pedido ${orderId} na mesa ${tableId} para ${isAttended}`);
                    const currentTable = await getTable(tableId);
                    if (!currentTable) throw new Error(`Mesa ${tableId} não encontrada.`);
                    
                    const orderIndex = currentTable.orders.findIndex(o => o.orderId === orderId);
                    if (orderIndex > -1) {
                        currentTable.orders[orderIndex].attended = isAttended;
                        await updateTable(currentTable);
                        orderItemLi.classList.toggle('attended', isAttended);
                        console.log(`Status do pedido ${orderId} na mesa ${tableId} atualizado com sucesso.`);
                    } else {
                         console.error(`Pedido ${orderId} não encontrado na mesa ${tableId}`);
                         throw new Error(`Pedido ${orderId} não encontrado.`);
                    }
                } catch (error) {
                    console.error("Falha ao atualizar status do pedido:", error);
                    alert(`Erro ao atualizar status do pedido: ${error.message}`);
                    event.target.checked = !isAttended;
                    orderItemLi.classList.toggle('attended', !isAttended);
                }
            });
        });

        ul.appendChild(li);
    });
    tableListContainer.appendChild(ul);
    console.log("RenderTables concluído.");
}

// --- Inicialização da Aplicação ---
async function initializeApp() {
    console.log("Iniciando initializeApp");
    try {
        storageType = await initDB();
        console.log(`Storage type definido como: ${storageType}`);
        // Garante que a lista seja carregada se for a aba ativa
        if (listSection && listSection.classList.contains("active-section")) {
            console.log("Lista de mesas ativa na inicialização, carregando mesas...");
            await loadTables();
        }
        // Define a aba do formulário como padrão inicial se nenhuma estiver ativa
        else if (formSection && !formSection.classList.contains("active-section") && listSection && !listSection.classList.contains("active-section")) {
             console.log("Nenhuma seção ativa, mostrando formulário por padrão.");
             showForm();
        } else {
            console.log("Estado inicial das seções mantido (ou elementos não encontrados).");
        }
         console.log("initializeApp concluído.");
    } catch (error) {
        console.error("Erro fatal durante initializeApp:", error);
        alert("Ocorreu um erro crítico ao inicializar a aplicação. Verifique o console.");
    }
}

// Inicia a aplicação
initializeApp();

