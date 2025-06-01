// Variáveis globais
let db;
const DB_NAME = "restaurantManagerDB";
const TABLE_STORE_NAME = "tables";
const DB_VERSION = 4; // <<-- Versão 4 do DB (isOpen agora é Number 1/0)

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
            const oldVersion = event.oldVersion;
            console.log(`Iniciando onupgradeneeded de v${oldVersion || 0} para v${event.newVersion}`);
            try {
                let tableStore;
                if (!db.objectStoreNames.contains(TABLE_STORE_NAME)) {
                    console.log(`Criando object store ${TABLE_STORE_NAME} com keyPath: sessionId`);
                    tableStore = db.createObjectStore(TABLE_STORE_NAME, { keyPath: "sessionId" }); 
                } else {
                    console.log(`Object store ${TABLE_STORE_NAME} já existe.`);
                    tableStore = transaction.objectStore(TABLE_STORE_NAME);
                    if (tableStore.keyPath !== "sessionId") {
                         console.warn(`Object store ${TABLE_STORE_NAME} existe mas keyPath não é sessionId. Recriando...`);
                         db.deleteObjectStore(TABLE_STORE_NAME);
                         tableStore = db.createObjectStore(TABLE_STORE_NAME, { keyPath: "sessionId" });
                         console.log(`Object store ${TABLE_STORE_NAME} recriado com keyPath: sessionId`);
                    }
                }

                // Garantir que os índices necessários existam
                if (!tableStore.indexNames.contains("isOpenIndex")) {
                     tableStore.createIndex("isOpenIndex", "isOpen", { unique: false });
                     console.log("Índice isOpenIndex criado.");
                 } else {
                     console.log("Índice isOpenIndex já existe.");
                 }
                 if (!tableStore.indexNames.contains("tableNumberIndex")) {
                     tableStore.createIndex("tableNumberIndex", "tableNumber", { unique: false });
                     console.log("Índice tableNumberIndex criado.");
                 } else {
                     console.log("Índice tableNumberIndex já existe.");
                 }
                 if (!tableStore.indexNames.contains("closedAtIndex")) {
                     tableStore.createIndex("closedAtIndex", "closedAt", { unique: false }); 
                     console.log("Índice closedAtIndex criado.");
                 } else {
                     console.log("Índice closedAtIndex já existe.");
                 }

                // *** MIGRAÇÃO DE DADOS (isOpen: boolean -> number) ***
                if (oldVersion < 4) {
                    console.log("Migrando dados de isOpen (boolean para number 1/0)...");
                    tableStore.openCursor().onsuccess = (cursorEvent) => {
                        const cursor = cursorEvent.target.result;
                        if (cursor) {
                            const record = cursor.value;
                            let needsUpdate = false;
                            if (typeof record.isOpen === 'boolean') {
                                record.isOpen = record.isOpen ? 1 : 0;
                                needsUpdate = true;
                                console.log(`Registro ${record.sessionId}: isOpen convertido para ${record.isOpen}`);
                            }
                            if (needsUpdate) {
                                cursor.update(record);
                            }
                            cursor.continue();
                        } else {
                            console.log("Migração de isOpen concluída.");
                        }
                    };
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

// --- Funções CRUD Atualizadas (isOpen é 1 ou 0) --- 

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
     // Garante que isOpen seja 1 ou 0
     tableData.isOpen = (tableData.isOpen === true || tableData.isOpen === 1) ? 1 : 0;
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
    // Garante que isOpen seja 1 ou 0
    tableData.isOpen = (tableData.isOpen === true || tableData.isOpen === 1) ? 1 : 0;
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
    console.log(`Procurando mesa ABERTA (isOpen=1) número ${tableNumber}`);
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
                    // Filtra por isOpen === 1
                    const openTable = tablesWithNumber.find(table => table.isOpen === 1);
                    console.log(`Mesa aberta (isOpen=1) encontrada:`, openTable);
                    resolve(openTable); 
                };
                request.onerror = (event) => reject(event.target.error);
                transaction.onerror = (event) => reject(event.target.error);
            } catch (error) { reject(error); }
        });
    } else {
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.find(t => t.tableNumber === tableNumber && t.isOpen === 1));
        });
    }
}

async function getOpenTables() {
    console.log(`Chamando getOpenTables (filtrando por isOpen=1) com storageType: ${storageType}`);
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const index = store.index("isOpenIndex");
                // Usa IDBKeyRange.only(1) para buscar mesas abertas
                const request = index.getAll(IDBKeyRange.only(1)); 
                request.onsuccess = () => {
                    console.log("Sucesso no request getAll(1) para getOpenTables. Resultado:", request.result);
                    resolve(request.result);
                };
                request.onerror = (event) => {
                    console.error("Erro no request getAll(1) em getOpenTables:", event.target.error);
                    reject(event.target.error);
                };
                transaction.onerror = (event) => {
                     console.error("Erro na transação em getOpenTables:", event.target.error);
                     reject(event.target.error);
                };
            } catch (error) {
                 console.error("Erro síncrono em getOpenTables:", error);
                 reject(error);
            }
        });
    } else {
        console.log("Usando fallback LocalStorage para getOpenTables");
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            resolve(tables.filter(t => t.isOpen === 1));
        });
    }
}

async function getClosedTables() {
    console.log(`Chamando getClosedTables (filtrando por isOpen=0) com storageType: ${storageType}`);
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const index = store.index("isOpenIndex");
                 // Usa IDBKeyRange.only(0) para buscar mesas fechadas
                const request = index.getAll(IDBKeyRange.only(0)); 
                request.onsuccess = () => {
                    console.log("Sucesso no request getAll(0) para getClosedTables. Resultado:", request.result);
                    const sortedResult = request.result.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
                    resolve(sortedResult);
                };
                request.onerror = (event) => {
                    console.error("Erro no request getAll(0) em getClosedTables:", event.target.error);
                    reject(event.target.error);
                };
                transaction.onerror = (event) => {
                     console.error("Erro na transação em getClosedTables:", event.target.error);
                     reject(event.target.error);
                };
            } catch (error) {
                 console.error("Erro síncrono em getClosedTables:", error);
                 reject(error);
            }
        });
    } else {
        console.log("Usando fallback LocalStorage para getClosedTables");
        return new Promise((resolve) => {
            const tables = JSON.parse(localStorage.getItem(TABLE_STORE_NAME) || "[]");
            const closed = tables.filter(t => t.isOpen === 0);
            closed.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
            resolve(closed);
        });
    }
}

// Função para exportar dados (mantida para debug)
async function exportAllData() {
    console.log("--- INÍCIO DA EXPORTAÇÃO DE DADOS ---");
    if (storageType === "indexedDB" && db) {
        console.log("Exportando dados do IndexedDB...");
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([TABLE_STORE_NAME], "readonly");
                const store = transaction.objectStore(TABLE_STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => {
                    console.log("Dados crus do IndexedDB:");
                    console.log(JSON.stringify(request.result, null, 2)); // Log formatado
                    console.log("--- FIM DA EXPORTAÇÃO DE DADOS ---");
                    resolve(request.result);
                };
                request.onerror = (event) => {
                    console.error("Erro ao exportar dados do IndexedDB:", event.target.error);
                    console.log("--- FIM DA EXPORTAÇÃO DE DADOS (COM ERRO) ---");
                    reject(event.target.error);
                };
                transaction.onerror = (event) => {
                     console.error("Erro na transação de exportação:", event.target.error);
                     console.log("--- FIM DA EXPORTAÇÃO DE DADOS (COM ERRO) ---");
                     reject(event.target.error);
                };
            } catch (error) {
                 console.error("Erro síncrono ao iniciar exportação:", error);
                 console.log("--- FIM DA EXPORTAÇÃO DE DADOS (COM ERRO) ---");
                 reject(error);
            }
        });
    } else {
        console.log("Exportando dados do LocalStorage...");
        return new Promise((resolve) => {
            const tables = localStorage.getItem(TABLE_STORE_NAME) || "[]";
            console.log("Dados crus do LocalStorage:");
            try {
                console.log(JSON.stringify(JSON.parse(tables), null, 2)); // Log formatado
            } catch (e) {
                console.log("Erro ao parsear dados do LocalStorage:", e);
                console.log("Dados brutos:", tables);
            }
            console.log("--- FIM DA EXPORTAÇÃO DE DADOS ---");
            resolve(JSON.parse(tables));
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
            let openTable = await findOpenTableByNumber(tableNumber);
            
            const newOrder = {
                orderId: Date.now(), 
                details: orderDetails,
                attended: false,
                timestamp: new Date().toISOString()
            };

            if (openTable) {
                console.log(`Mesa aberta ${tableNumber} (sessionId: ${openTable.sessionId}) encontrada. Adicionando pedido.`);
                if (!openTable.orders) openTable.orders = [];
                openTable.orders.push(newOrder);
                if (!openTable.clientName && clientName) openTable.clientName = clientName;
                if (!openTable.roomNumber && roomNumber) openTable.roomNumber = roomNumber;
                await updateTable(openTable);
                console.log(`Pedido adicionado à mesa ${tableNumber}. Tabela atualizada.`);
            } else {
                console.log(`Nenhuma mesa aberta com número ${tableNumber}. Criando nova instância.`);
                if (!clientName) {
                     alert("Nome do Cliente é obrigatório ao abrir uma nova mesa.");
                     return;
                }
                const newTableSessionId = `table-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                const newTable = {
                    sessionId: newTableSessionId,
                    tableNumber: tableNumber,
                    clientName: clientName,
                    roomNumber: roomNumber || null,
                    orders: [newOrder],
                    isOpen: 1, // <-- Usa 1 para aberto
                    openedAt: new Date().toISOString(),
                    closedAt: null
                };
                await addTable(newTable);
                console.log(`Nova instância de mesa ${tableNumber} (sessionId: ${newTableSessionId}) criada com o primeiro pedido.`);
            }

            orderForm.reset();
            clientNameInput.value = ""; 
            roomNumberInput.value = ""; 

            console.log("Pedido processado. Chamando showList() para atualizar a visualização...");
            showList(); 

        } catch (error) {
            console.error("Falha ao adicionar pedido/mesa:", error);
            alert("Erro ao processar pedido. Verifique o console.");
        }
    });
    console.log("Listener de submit (v3.2 - isOpen=1/0) adicionado ao formulário.");
} else {
    console.error("Erro: Formulário orderForm não encontrado.");
}

// Carrega e renderiza mesas ABERTAS (LÓGICA REAL RESTAURADA)
async function loadTables() {
    console.log("Chamando loadTables (v3.2 - isOpen=1/0)");
    if (!tableListContainer) {
        console.error("Erro: tableListContainer não encontrado em loadTables.");
        return;
    }
    tableListContainer.innerHTML = "<p>Carregando mesas abertas...</p>"; 
    try {
        const openTables = await getOpenTables(); // Deve retornar apenas isOpen=1
        console.log("Mesas abertas (isOpen=1) recebidas em loadTables:", openTables);
        renderTables(openTables);
    } catch (error) {
        console.error("Falha detalhada ao carregar/renderizar mesas abertas:", error);
        let errorMsg = "Erro ao carregar as mesas abertas.";
        if (error instanceof Error) {
             console.error("Stack trace:", error.stack);
             errorMsg += ` Detalhes: ${error.name} - ${error.message}`;
        }
        tableListContainer.innerHTML = `<p style="color: red;">${errorMsg} Verifique o console.</p>`;
    }
}

// Renderiza mesas ABERTAS
function renderTables(tables) {
    console.log("Iniciando renderTables (v3.2) com:", tables);
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
    tables.sort((a, b) => {
        if (a.tableNumber !== b.tableNumber) {
            return a.tableNumber - b.tableNumber;
        }
        return new Date(a.openedAt) - new Date(b.openedAt);
    });

    tables.forEach(table => {
        // *** DATA INTEGRITY CHECK ***
        if (!table || typeof table !== 'object' || !table.sessionId || typeof table.isOpen !== 'number') { // Verifica se isOpen é number
            console.warn("Registro de mesa inválido encontrado e ignorado (v3.2 check):", table);
            return; 
        }

        // Só renderiza se for aberta (isOpen === 1)
        if (table.isOpen !== 1) return;

        console.log(`Renderizando mesa aberta ${table.tableNumber} (sessionId: ${table.sessionId})`);
        const li = document.createElement("li");
        li.className = 'table-item';
        li.dataset.sessionId = table.sessionId; 

        let ordersHtml = 
            '<ul class="order-list"><li class="order-item">Nenhum pedido nesta mesa ainda.</li></ul>';
        if (table.orders && Array.isArray(table.orders) && table.orders.length > 0) {
             ordersHtml = '<ul class="order-list">';
             table.orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
             ordersHtml += table.orders.map(order => {
                 if (!order || typeof order !== 'object' || !order.orderId || typeof order.attended !== 'boolean') {
                     console.warn(`Pedido inválido ignorado na mesa ${table.sessionId}:`, order);
                     return ''; 
                 }
                 return `
                    <li class="order-item ${order.attended ? 'attended' : ''}" data-order-id="${order.orderId}">
                        <span>${(order.details || 'Detalhes ausentes').replace(/\n/g, '<br>')}  (${new Date(order.timestamp).toLocaleTimeString()})</span>
                        <label>
                            <input type="checkbox" class="attended-checkbox" ${order.attended ? 'checked' : ''}>
                            Atendido
                        </label>
                    </li>
                `;
             }).join('');
             ordersHtml += '</ul>';
        } 

        li.innerHTML = `
            <div class="table-header">
                <h3>Mesa ${table.tableNumber || 'N/A'}</h3>
                <span>Cliente: ${table.clientName || 'Não informado'}</span>
                ${table.roomNumber ? `<span>Quarto: ${table.roomNumber}</span>` : ''}
                <span>Aberta em: ${table.openedAt ? new Date(table.openedAt).toLocaleString() : 'Data inválida'}</span>
                <button class="close-table-btn">Fechar Mesa</button>
            </div>
            <div class="table-orders">
                <h4>Pedidos:</h4>
                ${ordersHtml}
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
                        if (tableToClose && tableToClose.isOpen === 1) { // Verifica se isOpen é 1
                            tableToClose.isOpen = 0; // <-- Usa 0 para fechado
                            tableToClose.closedAt = new Date().toISOString();
                            await updateTable(tableToClose);
                            console.log(`Mesa (sessionId: ${sessionIdToClose}) marcada como fechada (isOpen=0) no DB.`);
                            loadTables(); 
                        } else {
                             console.error(`Mesa ${sessionIdToClose} não encontrada ou já fechada (isOpen não é 1).`);
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
    console.log("RenderTables (v3.2) concluído.");
}

// Carrega e renderiza mesas FECHADAS (Histórico)
async function loadHistory() {
    console.log("Chamando loadHistory (v3.2 - isOpen=1/0)");
    if (!historyListContainer) {
        console.error("Erro: historyListContainer não encontrado em loadHistory.");
        return;
    }
    historyListContainer.innerHTML = "<p>Carregando histórico...</p>"; 
    try {
        const closedTables = await getClosedTables(); // Deve retornar apenas isOpen=0
        console.log("Mesas fechadas (isOpen=0) recebidas em loadHistory:", closedTables);
        renderHistory(closedTables);
    } catch (error) {
        console.error("Falha ao carregar histórico de mesas:", error);
        historyListContainer.innerHTML = "<p>Erro ao carregar o histórico. Verifique o console.</p>";
    }
}

// Renderiza mesas FECHADAS (Histórico)
function renderHistory(tables) {
    console.log("Iniciando renderHistory (v3.2) com:", tables);
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
    ul.className = 'history-list'; 
    // Já vem ordenado por closedAt mais recente de getClosedTables

    tables.forEach(table => {
         // *** DATA INTEGRITY CHECK ***
        if (!table || typeof table !== 'object' || !table.sessionId || typeof table.isOpen !== 'number' || table.isOpen !== 0) { // Verifica se isOpen é 0
            console.warn("Registro de histórico inválido encontrado e ignorado (v3.2 check):", table);
            return; 
        }

        console.log(`Renderizando histórico da mesa ${table.tableNumber} (sessionId: ${table.sessionId})`);
        const li = document.createElement("li");
        li.className = 'history-item';
        li.dataset.sessionId = table.sessionId;

        let ordersSummary = 'Nenhum pedido registrado.';
        if (table.orders && Array.isArray(table.orders) && table.orders.length > 0) {
            ordersSummary = `${table.orders.length} pedido(s) registrado(s).`;
        }

        li.innerHTML = `
            <div class="history-header">
                <h3>Mesa ${table.tableNumber || 'N/A'} (ID: ${table.sessionId.substring(0, 8)}...)</h3> 
                <span>Cliente: ${table.clientName || 'Não informado'}</span>
                ${table.roomNumber ? `<span>Quarto: ${table.roomNumber}</span>` : ''}
            </div>
            <div class="history-details">
                 <span>Aberta em: ${table.openedAt ? new Date(table.openedAt).toLocaleString() : 'Data inválida'}</span>
                 <span>Fechada em: ${table.closedAt ? new Date(table.closedAt).toLocaleString() : 'Data inválida'}</span>
                 <p><strong>Pedidos:</strong> ${ordersSummary}</p>
            </div>
        `;
        ul.appendChild(li);
    });
    historyListContainer.appendChild(ul);
    console.log("RenderHistory (v3.2) concluído.");
}


// --- Inicialização da Aplicação ---
async function initializeApp() {
    console.log("Iniciando initializeApp (v3.2 - isOpen=1/0)");
    try {
        storageType = await initDB();
        console.log(`Storage type definido como: ${storageType}`);
        showForm(); 
        console.log("initializeApp (v3.2) concluído.");
    } catch (error) {
        console.error("Erro fatal durante initializeApp:", error);
        alert("Ocorreu um erro crítico ao inicializar a aplicação. Verifique o console.");
    }
}

// Inicia a aplicação
initializeApp();

