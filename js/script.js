// Variáveis globais
let db;
const DB_NAME = "restaurantOrdersDB";
const STORE_NAME = "orders";
const DB_VERSION = 1;

// Elementos do DOM
const formSection = document.getElementById("formSection");
const listSection = document.getElementById("listSection");
const btnShowForm = document.getElementById("btnShowForm");
const btnShowList = document.getElementById("btnShowList");
const orderForm = document.getElementById("orderForm");
const orderListContainer = document.getElementById("orderListContainer");

// Funções de Navegação entre Telas
function showForm() {
    formSection.classList.add("active-section");
    formSection.classList.remove("hidden-section");
    listSection.classList.add("hidden-section");
    listSection.classList.remove("active-section");
}

function showList() {
    listSection.classList.add("active-section");
    listSection.classList.remove("hidden-section");
    formSection.classList.add("hidden-section");
    formSection.classList.remove("active-section");
    loadOrders(); // Carrega os pedidos ao mostrar a lista
}

// Inicialização - Adiciona Event Listeners aos botões de navegação
btnShowForm.addEventListener("click", showForm);
btnShowList.addEventListener("click", showList);

// Lógica de Persistência de Dados (IndexedDB com fallback para LocalStorage)

function initDB() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            console.warn("IndexedDB não é suportado. Usando LocalStorage como fallback.");
            resolve("localStorage"); // Indica que usaremos localStorage
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("IndexedDB inicializado com sucesso.");
            resolve("indexedDB"); // Indica que usaremos IndexedDB
        };

        request.onerror = (event) => {
            console.error("Erro ao inicializar IndexedDB:", event.target.error);
            console.warn("Usando LocalStorage como fallback devido a erro no IndexedDB.");
            resolve("localStorage"); // Fallback para localStorage
        };
    });
}

let storageType = "localStorage"; // Padrão para localStorage até o initDB confirmar

async function addOrder(order) {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(order);

            request.onsuccess = () => {
                console.log("Pedido adicionado ao IndexedDB:", order);
                resolve(request.result); // Retorna o ID do novo pedido
            };
            request.onerror = (event) => {
                console.error("Erro ao adicionar pedido ao IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        });
    } else {
        // Fallback para LocalStorage
        return new Promise((resolve) => {
            const orders = JSON.parse(localStorage.getItem(STORE_NAME) || "[]");
            order.id = Date.now(); // Simula um ID único para LocalStorage
            orders.push(order);
            localStorage.setItem(STORE_NAME, JSON.stringify(orders));
            console.log("Pedido adicionado ao LocalStorage:", order);
            resolve(order.id);
        });
    }
}

async function getOrders() {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = (event) => {
                console.error("Erro ao buscar pedidos do IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        });
    } else {
        // Fallback para LocalStorage
        return new Promise((resolve) => {
            const orders = JSON.parse(localStorage.getItem(STORE_NAME) || "[]");
            resolve(orders);
        });
    }
}

async function updateOrderStatus(orderId, isAttended) {
    if (storageType === "indexedDB" && db) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(orderId);

            getRequest.onsuccess = () => {
                const order = getRequest.result;
                if (order) {
                    order.attended = isAttended;
                    const updateRequest = store.put(order);
                    updateRequest.onsuccess = () => {
                        console.log(`Status do pedido ${orderId} atualizado para ${isAttended} no IndexedDB.`);
                        resolve();
                    };
                    updateRequest.onerror = (event) => {
                        console.error("Erro ao atualizar status do pedido no IndexedDB:", event.target.error);
                        reject(event.target.error);
                    };
                } else {
                    reject("Pedido não encontrado no IndexedDB.");
                }
            };
            getRequest.onerror = (event) => {
                console.error("Erro ao buscar pedido para atualização no IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        });
    } else {
        // Fallback para LocalStorage
        return new Promise((resolve, reject) => {
            const orders = JSON.parse(localStorage.getItem(STORE_NAME) || "[]");
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
                orders[orderIndex].attended = isAttended;
                localStorage.setItem(STORE_NAME, JSON.stringify(orders));
                console.log(`Status do pedido ${orderId} atualizado para ${isAttended} no LocalStorage.`);
                resolve();
            } else {
                reject("Pedido não encontrado no LocalStorage.");
            }
        });
    }
}

// Lógica do Formulário e Lista de Pedidos
orderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newOrder = {
        tableNumber: orderForm.tableNumber.value,
        clientName: orderForm.clientName.value,
        roomNumber: orderForm.roomNumber.value || null, // Opcional
        orderDetails: orderForm.orderDetails.value,
        attended: false, // Novo pedido sempre começa como não atendido
        timestamp: new Date().toISOString()
    };

    try {
        await addOrder(newOrder);
        orderForm.reset();
        alert("Pedido adicionado com sucesso!");
        showList(); // Mostra a lista atualizada
    } catch (error) {
        console.error("Falha ao adicionar pedido:", error);
        alert("Erro ao adicionar pedido. Verifique o console para mais detalhes.");
    }
});

async function loadOrders() {
    try {
        const orders = await getOrders();
        renderOrders(orders);
    } catch (error) {
        console.error("Falha ao carregar pedidos:", error);
        orderListContainer.innerHTML = "<p>Erro ao carregar os pedidos.</p>";
    }
}

function renderOrders(orders) {
    orderListContainer.innerHTML = ""; // Limpa a lista atual

    if (!orders || orders.length === 0) {
        orderListContainer.innerHTML = "<p>Nenhum pedido registrado ainda.</p>";
        return;
    }

    const ul = document.createElement("ul");
    orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Ordena por mais recente

    orders.forEach(order => {
        const li = document.createElement("li");
        li.className = order.attended ? "attended" : "";
        li.innerHTML = `
            <div><strong>Mesa:</strong> ${order.tableNumber}</div>
            <div><strong>Cliente:</strong> ${order.clientName}</div>
            ${order.roomNumber ? `<div><strong>Quarto:</strong> ${order.roomNumber}</div>` : ""}
            <div><strong>Pedido:</strong> ${order.orderDetails}</div>
            <div><strong>Registrado em:</strong> ${new Date(order.timestamp).toLocaleString()}</div>
            <label>
                <input type="checkbox" data-id="${order.id}" ${order.attended ? "checked" : ""}>
                Atendido
            </label>
        `;
        const checkbox = li.querySelector("input[type='checkbox']");
        checkbox.addEventListener("change", async (event) => {
            const orderId = Number(event.target.dataset.id); // ID pode ser número ou string dependendo do storage
            const isAttended = event.target.checked;
            try {
                await updateOrderStatus(orderId, isAttended);
                li.className = isAttended ? "attended" : ""; // Atualiza visualmente
            } catch (error) {
                console.error("Falha ao atualizar status do pedido:", error);
                alert("Erro ao atualizar status do pedido.");
                event.target.checked = !isAttended; // Reverte o checkbox em caso de erro
            }
        });
        ul.appendChild(li);
    });
    orderListContainer.appendChild(ul);
}

// Inicializa o DB e define o tipo de storage, depois carrega os pedidos se a lista estiver visível
async function initializeApp() {
    storageType = await initDB();
    // Se a lista de pedidos for a tela inicial (ou se não houver preferência, ela é a padrão no HTML)
    // ou se o usuário navegar para ela, loadOrders() será chamado por showList().
    // Para garantir que carregue na primeira vez se a lista estiver ativa:
    if (listSection.classList.contains("active-section")) {
        loadOrders();
    }
}

// Inicia a aplicação
initializeApp();

