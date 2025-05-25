// Variáveis globais
let db;
const DB_NAME = "restaurantManagerDB";
const TABLE_STORE_NAME = "tables";
const DB_VERSION = 3; // <<-- Versão 3 do DB

// Elementos do DOM
const formSection = document.getElementById("formSection");
const listSection = document.getElementById("listSection");
const historySection = document.getElementById("historySection"); 
const btnShowForm = document.getElementById("btnShowForm");
const btnShowList = document.getElementById("btnShowList");
const btnShowHistory = document.getElementById("btnShowHistory"); 
const orderForm = document.getElementById("orderForm");
const tableListContainer = document.getElementById("tableListContainer");
const historyListContainer = document.getElementById("historyListContainer"); 

// Inputs do formulário
const tableNumberInput = document.getElementById("tableNumber");
const clientNameInput = document.getElementById("clientName");
const roomNumberInput = document.getElementById("roomNumber");
const orderDetailsInput = document.getElementById("orderDetails");

// Funções de Navegação entre Telas
function showForm() {
    console.log("Chamando showForm");
    if (formSection && listSection && historySection) {
        formSection.classList.add("active-section");
        formSection.classList.remove("hidden-section");
        listSection.classList.add("hidden-section");
        listSection.classList.remove("active-section");
        historySection.classList.add("hidden-section");
        historySection.classList.remove("active-section");
    } else {
        console.error("Erro: Alguma seção não encontrada em showForm");
    }
}

function showList() {
    console.log("Chamando showList");
    if (formSection && listSection && historySection) {
        listSection.classList.add("active-section");
        listSection.classList.remove("hidden-section");
        formSection.classList.add("hidden-section");
        formSection.classList.remove("active-section");
        historySection.classList.add("hidden-section");
        historySection.classList.remove("active-section");
        loadTables(); // Carrega as mesas ABERTAS
    } else {
         console.error("Erro: Alguma seção não encontrada em showList");
    }
}

function showHistory() {
    console.log("Chamando showHistory");
    if (formSection && listSection && historySection) {
        historySection.classList.add("active-section");
        historySection.classList.remove("hidden-section");
        formSection.classList.add("hidden-section");
        formSection.classList.remove("active-section");
        listSection.classList.add("hidden-section");
        listSection.classList.remove("active-section");
        loadHistory(); // Carrega as mesas FECHADAS
    } else {
         console.error("Erro: Alguma seção não encontrada em showHistory");
    }
}

// Inicialização - Adiciona Event Listeners aos botões de navegação
if (btnShowForm && btnShowList && btnShowHistory) {
    btnShowForm.addEventListener("click", showForm);
    btnShowList.addEventListener("click", showList);
    btnShowHistory.addEventListener("click", showHistory); 
    console.log("Listeners de navegação adicionados.");
} else {
     console.error("Erro: Botões de navegação não encontrados.");
}


// --- Lógica de Persistência de Dados (IndexedDB com fallback para LocalStorage) ---

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
            const transaction = event.target.transaction;
            console.log(`Iniciando onupgradeneeded de v${event.oldVersion || 0} para v${event.newVersion}`);
            try {
                let tableStore;
                if (!db.objectStoreNames.contains(TABLE_STORE_NAME)) {
                    console.log(`Criando object store ${TABLE_STORE_NAME} com keyPath: sessionId`);
                    tableStore = db.createObjectStore(TABLE_STORE_NAME, { keyPath: "sessionId" }); 
                } else {
                    console.log(`Object store ${TABLE_STORE_NAME} já existe.`);
                    tableStore = transaction.objectStore(TABLE_STORE_NAME);
                    // Adicionar verificação de keyPath se necessário
                    if (tableStore.keyPath !== "sessionId") {
                         console.warn(`Object store ${TABLE_STORE_NAME} existe mas keyPath não é sessionId. Recriando...`);
                         // Poderia tentar migrar, mas recriar é mais simples para este exemplo
                         db.deleteObjectStore(TABLE_STORE_NAME);
                         tableStore = db.createObjectStore(TABLE_STORE_NAME, { keyPath: "sessionId" });
                         console.log(`Object store ${TABLE_STORE_NAME} recriado com keyPath: sessionId`);
                    }
                }

                // Garantir que os índices necessários existam
                if (!tableStore.indexNames.contains("isOpenIndex")) {
                     tableStore.createIndex("isOpenIndex", "isOpen", { unique: false });
                     console.log("Índice isOpenIndex criado.");
                 }
                 if (!tableStore.indexNames.contains("tableNumberIndex")) {
                     tableStore.createIndex("tableNumberIndex", "tableNumber", { unique: false });
                     console.log("Índice tableNumberIndex criado.");
                 }
                 if (!tableStore.indexNames.contains("closedAtIndex")) {
                     tableStore.createIndex("closedAtIndex", "closedAt", { unique: false }); 
                     console.log("Índice closedAtIndex criado.");
                 }

                 console.log("onupgradeneeded concluído com sucesso.");
            } catch (error) {
                console.error("Erro durante onupgradeneeded:", error);
                transaction.abort(); 
                reject(error);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("IndexedDB inicializado com sucesso (onsuccess).");
            db.onerror = (event) => {
                 console.error(`Erro no banco de dados: ${event.target.error || event.target.errorCode}`);
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

// --- Funções CRUD Atualizadas --- 

async function getTableBySessionId(sessionId) {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const request = store.get(sessionId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.find(t => t.sessionId === sessionId)); 
        });
    }
}

async function addTable(tableData) {
     if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readwrite");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                console.log("Adicionando nova mesa ao DB:", tableData);
                const request = store.add(tableData);
                request.onsuccess = () => resolve(request.result); // Retorna a sessionId
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            tables.push(tableData);
            localStorage.setItem(TABLE_STORE_NAME, JSON.stringify(tables));
            resolve(tableData.sessionId);
        });
    }
}

async function updateTable(tableData) {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readwrite");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                 console.log("Atualizando tabela no DB (sessionId: " + tableData.sessionId + "):", tableData);
                const request = store.put(tableData);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve, reject) => {
            let tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            const index = tables.findIndex(t => t.sessionId === tableData.sessionId);
            if (index > -1) {
                tables[index] = tableData;
                localStorage.setItem(TABLE_STORE_NAME, JSON.stringify(tables));
                resolve();
            } else {
                reject("Mesa (sessionId) não encontrada no LocalStorage.");
            }
        });
    }
}

async function findOpenTableByNumber(tableNumber) {
    console.log(`Procurando mesa ABERTA número ${tableNumber}`);
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const numberIndex = store.index("tableNumberIndex");
                const request = numberIndex.getAll(IDBKeyRange.only(tableNumber));

                request.onsuccess = () => {
                    const tablesWithNumber = request.result;
                    console.log(`Mesas encontradas com número ${tableNumber}:`, tablesWithNumber);
                    const openTable = tablesWithNumber.find(table => table.isOpen === true);
                    console.log(`Mesa aberta encontrada:`, openTable);
                    resolve(openTable); 
                };
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.find(t => t.tableNumber === tableNumber && t.isOpen));
        });
    }
}

async function getOpenTables() {
    console.log(`Chamando getOpenTables com storageType: ${storageType}`);
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const index = store.index("isOpenIndex");
                const request = index.getAll(IDBKeyRange.only(true)); 
                request.onsuccess = () => {
                    console.log("Sucesso no request getAll(true) para getOpenTables. Resultado:", request.result);
                    resolve(request.result);
                };
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        console.log("Usando fallback LocalStorage para getOpenTables");
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.filter(t => t.isOpen));
        });
    }
}

async function getClosedTables() {
    console.log(`Chamando getClosedTables com storageType: ${storageType}`);
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const index = store.index("isOpenIndex");
                const request = index.getAll(IDBKeyRange.only(false)); 
                request.onsuccess = () => {
                    console.log("Sucesso no request getAll(false) para getClosedTables. Resultado:", request.result);
                    const sortedResult = request.result.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
                    resolve(sortedResult);
                };
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        console.log("Usando fallback LocalStorage para getClosedTables");
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            const closed = tables.filter(t => !t.isOpen);
            closed.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
            resolve(closed);
        });
    }
}


// --- Lógica do Formulário e Lista de Mesas ATUALIZADA --- 

if (orderForm) {
    orderForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const tableNumber = parseInt(tableNumberInput.value);
        const clientName = clientNameInput.value.trim();
        const roomNumber = roomNumberInput.value.trim();
        const orderDetails = orderDetailsInput.value.trim();

        if (isNaN(tableNumber) || tableNumber <= 0) {
            alert("Número da Mesa inválido.");
            return;
        }
         if (!orderDetails) {
            alert("Detalhes do Pedido são obrigatórios.");
            return;
        }

        console.log(`Tentando adicionar pedido à mesa número ${tableNumber}`);
        try {
            // Verifica se já existe uma mesa ABERTA com este número
            let openTable = await findOpenTableByNumber(tableNumber);
            
            const newOrder = {
                orderId: Date.now(), // ID único para o pedido dentro da mesa
                details: orderDetails,
                attended: false,
                timestamp: new Date().toISOString()
            };

            if (openTable) {
                // Mesa aberta encontrada: Adiciona pedido a ela
                console.log(`Mesa aberta ${tableNumber} (sessionId: ${openTable.sessionId}) encontrada. Adicionando pedido.`);
                if (!openTable.orders) openTable.orders = [];
                openTable.orders.push(newOrder);
                // Atualiza nome/quarto se estiverem vazios e foram preenchidos agora
                if (!openTable.clientName && clientName) openTable.clientName = clientName;
                if (!openTable.roomNumber && roomNumber) openTable.roomNumber = roomNumber;
                await updateTable(openTable);
                console.log(`Pedido adicionado à mesa ${tableNumber}. Tabela atualizada.`);
            } else {
                // Nenhuma mesa aberta com este número: Cria uma NOVA instância de mesa
                console.log(`Nenhuma mesa aberta com número ${tableNumber}. Criando nova instância.`);
                if (!clientName) {
                     alert("Nome do Cliente é obrigatório ao abrir uma nova mesa.");
                     return;
                }
                const newTableSessionId = `table-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; // ID único
                const newTable = {
                    sessionId: newTableSessionId,
                    tableNumber: tableNumber,
                    clientName: clientName,
                    roomNumber: roomNumber || null,
                    orders: [newOrder],
                    isOpen: true, 
                    openedAt: new Date().toISOString(),
                    closedAt: null // Importante iniciar como null
                };
                await addTable(newTable);
                console.log(`Nova instância de mesa ${tableNumber} (sessionId: ${newTableSessionId}) criada com o primeiro pedido.`);
            }

            orderForm.reset();
            clientNameInput.value = ";
            roomNumberInput.value = ";
            alert("Pedido adicionado com sucesso!");
            showList(); // Mostra a lista de mesas ABERTAS atualizada

        } catch (error) {
            console.error("Falha ao adicionar pedido/mesa:", error);
            alert("Erro ao processar pedido. Verifique o console.");
        }
    });
    console.log("Listener de submit (v3) adicionado ao formulário.");
} else {
    console.error("Erro: Formulário orderForm não encontrado.");
}

// Carrega e renderiza mesas ABERTAS
async function loadTables() {
    console.log("Chamando loadTables (v3)");
    if (!tableListContainer) {
        console.error("Erro: tableListContainer não encontrado em loadTables.");
        return;
    }
    tableListContainer.innerHTML = "<p>Carregando mesas abertas...</p>"; 
    try {
        const openTables = await getOpenTables();
        console.log("Mesas abertas recebidas em loadTables:", openTables);
        renderTables(openTables);
    } catch (error) {
        console.error("Falha ao carregar mesas abertas:", error);
        tableListContainer.innerHTML = "<p>Erro ao carregar as mesas abertas. Verifique o console.</p>";
    }
}

// Renderiza mesas ABERTAS
function renderTables(tables) {
    console.log("Iniciando renderTables (v3) com:", tables);
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
    // Ordena por número da mesa, depois por data de abertura (mais antiga primeiro)
    tables.sort((a, b) => {
        if (a.tableNumber !== b.tableNumber) {
            return a.tableNumber - b.tableNumber;
        }
        return new Date(a.openedAt) - new Date(b.openedAt);
    });

    tables.forEach(table => {
        // Só renderiza se for aberta (dupla verificação)
        if (!table.isOpen) return;

        console.log(`Renderizando mesa aberta ${table.tableNumber} (sessionId: ${table.sessionId})`);
        const li = document.createElement("li");
        li.className = 'table-item';
        li.dataset.sessionId = table.sessionId; // Usa sessionId no dataset

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
                <h3>Mesa ${table.tableNumber}</h3>
                <span>Cliente: ${table.clientName || 'Não informado'}</span>
                ${table.roomNumber ? `<span>Quarto: ${table.roomNumber}</span>` : ''}
                <span>Aberta em: ${new Date(table.openedAt).toLocaleString()}</span>
                <button class="close-table-btn">Fechar Mesa</button>
            </div>
            <div class="table-orders">
                <h4>Pedidos:</h4>
                <ul class="order-list">${ordersHtml}</ul>
            </div>
        `;

        // Event Listener para fechar mesa (usa sessionId)
        const closeButton = li.querySelector(".close-table-btn");
        if (closeButton) {
            closeButton.addEventListener("click", async () => {
                const sessionIdToClose = li.dataset.sessionId;
                if (confirm(`Tem certeza que deseja fechar esta instância da Mesa ${table.tableNumber}?`)) {
                    try {
                        console.log(`Tentando fechar mesa com sessionId: ${sessionIdToClose}`);
                        let tableToClose = await getTableBySessionId(sessionIdToClose);
                        if (tableToClose && tableToClose.isOpen) {
                            tableToClose.isOpen = false;
                            tableToClose.closedAt = new Date().toISOString(); // Marca data de fechamento
                            await updateTable(tableToClose);
                            console.log(`Mesa (sessionId: ${sessionIdToClose}) marcada como fechada no DB.`);
                            loadTables(); // Recarrega a lista de mesas ABERTAS
                        } else {
                             console.error(`Mesa ${sessionIdToClose} não encontrada ou já fechada.`);
                             alert("Erro: Mesa não encontrada ou já está fechada.");
                        }
                    } catch (error) {
                        console.error(`Erro ao fechar mesa ${sessionIdToClose}:`, error);
                        alert("Erro ao fechar a mesa.");
                    }
                }
            });
        } else {
             console.error(`Botão Fechar Mesa não encontrado para mesa ${table.sessionId}`);
        }

        // Event Listeners para checkboxes de pedido atendido (usa sessionId)
        const checkboxes = li.querySelectorAll(".attended-checkbox");
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener("change", async (event) => {
                const orderItemLi = event.target.closest('.order-item');
                const orderId = Number(orderItemLi.dataset.orderId);
                const isAttended = event.target.checked;
                const tableSessionId = li.dataset.sessionId;

                try {
                    console.log(`Tentando atualizar status do pedido ${orderId} na mesa ${tableSessionId} para ${isAttended}`);
                    const currentTable = await getTableBySessionId(tableSessionId);
                    if (!currentTable) throw new Error(`Mesa ${tableSessionId} não encontrada.`);
                    
                    const orderIndex = currentTable.orders.findIndex(o => o.orderId === orderId);
                    if (orderIndex > -1) {
                        currentTable.orders[orderIndex].attended = isAttended;
                        await updateTable(currentTable);
                        orderItemLi.classList.toggle('attended', isAttended);
                        console.log(`Status do pedido ${orderId} na mesa ${tableSessionId} atualizado com sucesso.`);
                    } else {
                         console.error(`Pedido ${orderId} não encontrado na mesa ${tableSessionId}`);
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
    console.log("RenderTables (v3) concluído.");
}

// Carrega e renderiza mesas FECHADAS (Histórico)
async function loadHistory() {
    console.log("Chamando loadHistory (v3)");
    if (!historyListContainer) {
        console.error("Erro: historyListContainer não encontrado em loadHistory.");
        return;
    }
    historyListContainer.innerHTML = "<p>Carregando histórico...</p>"; 
    try {
        const closedTables = await getClosedTables();
        console.log("Mesas fechadas recebidas em loadHistory:", closedTables);
        renderHistory(closedTables);
    } catch (error) {
        console.error("Falha ao carregar histórico de mesas:", error);
        historyListContainer.innerHTML = "<p>Erro ao carregar o histórico. Verifique o console.</p>";
    }
}

// Renderiza mesas FECHADAS (Histórico)
function renderHistory(tables) {
    console.log("Iniciando renderHistory (v3) com:", tables);
     if (!historyListContainer) {
        console.error("Erro: historyListContainer não encontrado em renderHistory.");
        return;
    }
    historyListContainer.innerHTML = "";

    if (!tables || tables.length === 0) {
        console.log("Nenhuma mesa fechada para renderizar no histórico.");
        historyListContainer.innerHTML = "<p>Nenhuma mesa fechada encontrada no histórico.</p>";
        return;
    }

    const ul = document.createElement("ul");
    ul.className = 'history-list'; // Classe diferente para estilização
    // Já vem ordenado por closedAt mais recente de getClosedTables

    tables.forEach(table => {
        console.log(`Renderizando histórico da mesa ${table.tableNumber} (sessionId: ${table.sessionId})`);
        const li = document.createElement("li");
        li.className = 'history-item';
        li.dataset.sessionId = table.sessionId;

        // Simplificar exibição de pedidos no histórico (opcional)
        let ordersSummary = 'Nenhum pedido registrado.';
        if (table.orders && table.orders.length > 0) {
            ordersSummary = `${table.orders.length} pedido(s) registrado(s).`;
            // Poderia listar os detalhes se quisesse, mas pode poluir
            /*
            ordersSummary = '<ul class="order-summary-list">';
            ordersSummary += table.orders.map(o => `<li>${o.details} ${o.attended ? '(Atendido)' : ''}</li>`).join('');
            ordersSummary += '</ul>';
            */
        }

        li.innerHTML = `
            <div class="history-header">
                <h3>Mesa ${table.tableNumber} (ID: ${table.sessionId.substring(0, 8)}...)</h3> 
                <span>Cliente: ${table.clientName || 'Não informado'}</span>
                ${table.roomNumber ? `<span>Quarto: ${table.roomNumber}</span>` : ''}
            </div>
            <div class="history-details">
                 <span>Aberta em: ${new Date(table.openedAt).toLocaleString()}</span>
                 <span>Fechada em: ${new Date(table.closedAt).toLocaleString()}</span>
                 <p><strong>Pedidos:</strong> ${ordersSummary}</p>
            </div>
        `;
        ul.appendChild(li);
    });
    historyListContainer.appendChild(ul);
    console.log("RenderHistory (v3) concluído.");
}


// --- Inicialização da Aplicação ---
async function initializeApp() {
    console.log("Iniciando initializeApp (v3)");
    try {
        storageType = await initDB();
        console.log(`Storage type definido como: ${storageType}`);
        // Define a aba do formulário como padrão inicial
        showForm(); 
        console.log("initializeApp (v3) concluído.");
    } catch (error) {
        console.error("Erro fatal durante initializeApp:", error);
        alert("Ocorreu um erro crítico ao inicializar a aplicação. Verifique o console.");
    }
}

// Inicia a aplicação
initializeApp();

