
(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = (s) => document.querySelector(s);

  let supabaseClient = null;
  let products = [];
  let cart = [];
  let currentUser = null;
  let selectedCurrency = "USD";

  const icons = { Ebook: "✧", Curso: "☾", Vídeo: "◇" };

  const money = (value, currency = selectedCurrency) => {
    try {
      return new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency
      }).format(Number(value || 0));
    } catch {
      return `${value} ${currency}`;
    }
  };

  const escapeHTML = (s = "") =>
    String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[c]));

  const toast = (message) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3500);
  };

  const showModal = (html) => {
    $("#modalContent").innerHTML = html;
    $("#modalBackdrop").hidden = false;
  };

  const closeModal = () => {
    $("#modalBackdrop").hidden = true;
  };

  const ready = () =>
    window.supabase &&
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("COLOCA_AQUI") &&
    cfg.SUPABASE_PUBLISHABLE_KEY &&
    !cfg.SUPABASE_PUBLISHABLE_KEY.includes("COLOCA_AQUI");

  function setupContact() {
    const number = String(cfg.WHATSAPP_NUMBER || "").replace(/\D/g, "");
    const link = $("#whatsappLink");
    if (!link) return;

    if (number && !number.endsWith("000000")) {
      link.href = `https://wa.me/${number}?text=${encodeURIComponent(
        "Olá! Gostaria de informações sobre os produtos do Mundo do Esoterismo."
      )}`;
    } else {
      link.href = "#";
    }

    link.addEventListener("click", e => {
      if (link.getAttribute("href") === "#") {
        e.preventDefault();
        toast("Configura o teu número de WhatsApp no ficheiro config.js.");
      }
    });
  }

  function getProductData(item) {
    const product = item.data || item;
    const offer = product.offers?.[0];

    const prices = (offer?.prices || [])
      .map(price => ({
        amount: Number(price.amount),
        currency: String(price.currency || "").toUpperCase()
      }))
      .filter(price =>
        Number.isFinite(price.amount) &&
        ["USD", "EUR", "RUB"].includes(price.currency)
      );

    return {
      id: product.id,
      offerId: offer?.id,
      name: product.title || product.name || "Produto digital",
      description: product.description || offer?.description ||
        "Conteúdo digital disponível na nossa loja.",
      type: "Ebook",
      prices
    };
  }

  function getSelectedPrice(product) {
    return product.prices?.find(
      price => price.currency === selectedCurrency
    ) || null;
  }

  function renderProducts() {
    const query = ($("#searchInput")?.value || "").toLowerCase();
    const category = $("#categoryFilter")?.value || "";

    const list = products.filter(p =>
      (!category || p.type === category) &&
      (`${p.name} ${p.description || ""}`.toLowerCase().includes(query))
    );

    $("#productGrid").innerHTML = list.length
      ? list.map(p => {
          const price = getSelectedPrice(p);
          return `
            <article class="product-card">
              <div class="product-art">${icons[p.type] || "✧"}</div>
              <div class="product-info">
                <span class="product-type">${escapeHTML(p.type)}</span>
                <h3>${escapeHTML(p.name)}</h3>
                <p>${escapeHTML(p.description)}</p>
                <div class="product-bottom">
                  <span class="price">${
                    price ? money(price.amount, selectedCurrency)
                    : `Indisponível em ${escapeHTML(selectedCurrency)}`
                  }</span>
                  <button class="small-button"
                    data-add="${escapeHTML(p.id)}"
                    ${price ? "" : "disabled"}>Comprar</button>
                </div>
              </div>
            </article>`;
        }).join("")
      : '<div class="empty-state">Ainda não há produtos publicados nesta categoria.</div>';
  }

  async function loadProducts() {
    $("#productGrid").innerHTML =
      '<div class="empty-state">A carregar os produtos...</div>';

    try {
      const response = await fetch("/.netlify/functions/lava-products");
      if (!response.ok) throw new Error("Erro ao consultar a Lava.top.");

      const result = await response.json();
      products = (result.items || [])
        .map(getProductData)
        .filter(p => p.id && p.offerId);

      renderProducts();

      if (!products.length) {
        $("#productGrid").innerHTML =
          '<div class="empty-state">Não foram encontrados produtos disponíveis.</div>';
      }
    } catch (error) {
      console.error(error);
      $("#productGrid").innerHTML =
        '<div class="empty-state">Não foi possível carregar os produtos. Tenta novamente mais tarde.</div>';
    }
  }

  function updateCart() {
    $("#cartCount").textContent = cart.length;
  }

  function addToCart(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;

    const price = getSelectedPrice(product);
    if (!price) {
      toast(`Este produto não está disponível em ${selectedCurrency}.`);
      return;
    }

    if (cart.length && String(cart[0].id) !== String(id)) {
      toast("Compra um produto de cada vez, por favor.");
      return;
    }

    cart = [{ ...product, price: price.amount, currency: price.currency }];
    updateCart();
    toast("Produto adicionado ao carrinho.");
  }

  function openCart() {
    if (!cart.length) {
      showModal("<h2>O teu carrinho</h2><p>O carrinho ainda está vazio.</p>");
      return;
    }

    const product = cart[0];

    showModal(`
      <h2>O teu carrinho</h2>
      <p>${escapeHTML(product.name)}</p>
      <p><b>Preço: ${money(product.price, product.currency)}</b></p>
      <div class="modal-actions">
        <button class="gold-button" id="checkoutButton">Continuar para pagamento</button>
        <button class="small-button" id="clearCart">Remover produto</button>
      </div>
      <p>O pagamento será processado pela Lava.top.</p>
    `);

    $("#clearCart").onclick = () => {
      cart = [];
      updateCart();
      closeModal();
    };

    $("#checkoutButton").onclick = checkout;
  }

  // Mantém o encaminhamento para a página pública do produto na Lava.top.
  function checkout() {
    if (!cart.length) return;
    const product = cart[0];

    if (!product.id) {
      toast("Não foi possível identificar o produto.");
      return;
    }

    window.location.href =
      `https://app.lava.top/products/${encodeURIComponent(product.id)}`;
  }

  function openAccount() {
    if (!supabaseClient) {
      toast("A área de contas não está disponível.");
      return;
    }

    if (currentUser) {
      accountPanel();
      return;
    }

    showModal(`
      <h2>Minha conta</h2>
      <form id="authForm">
        <label>Email
          <input class="form-control" name="email" type="email" required>
        </label>
        <label>Palavra-passe
          <input class="form-control" name="password" type="password" minlength="6" required>
        </label>
        <button class="gold-button" type="submit">Entrar</button>
      </form>
      <p>Ainda não tens conta?
        <button class="small-button" id="showSignup">Criar conta</button>
      </p>
    `);

    $("#authForm").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: f.get("email"),
        password: f.get("password")
      });

      if (error) toast(error.message);
      else {
        closeModal();
        toast("Sessão iniciada.");
      }
    };

    $("#showSignup").onclick = signupForm;
  }

  function signupForm() {
    showModal(`
      <h2>Criar conta</h2>
      <form id="signupForm">
        <label>Nome
          <input class="form-control" name="name" required>
        </label>
        <label>Email
          <input class="form-control" name="email" type="email" required>
        </label>
        <label>Palavra-passe
          <input class="form-control" name="password" type="password" minlength="6" required>
        </label>
        <button class="gold-button" type="submit">Criar conta</button>
      </form>
      <p>Ao criar conta, poderás acompanhar as tuas encomendas.</p>
    `);

    $("#signupForm").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);

      const { error } = await supabaseClient.auth.signUp({
        email: f.get("email"),
        password: f.get("password"),
        options: { data: { full_name: f.get("name") } }
      });

      if (error) toast(error.message);
      else toast("Conta criada. Verifica o teu email, se a confirmação estiver activa.");
    };
  }

  async function getAdminProfile() {
    if (!currentUser) return null;

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("role,full_name")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar administrador:", error);
      return null;
    }

    return data?.role === "admin" ? data : null;
  }

  async function accountPanel() {
    if (!supabaseClient || !currentUser) return;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role,full_name")
      .eq("id", currentUser.id)
      .maybeSingle();

    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select("id,status,total,currency,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast("Não foi possível carregar as encomendas.");
      return;
    }

    const isAdmin = profile?.role === "admin";

    showModal(`
      <h2>Olá, ${escapeHTML(profile?.full_name || currentUser.email)}</h2>
      <p>${escapeHTML(currentUser.email)}</p>
      <h3>As minhas encomendas</h3>
      ${(orders || []).length
        ? orders.map(o => `
            <p>Encomenda ${String(o.id).slice(0, 8)}
            — ${money(o.total, o.currency)}
            — <b>${escapeHTML(o.status)}</b></p>
          `).join("")
        : "<p>Ainda não tens encomendas registadas.</p>"}
      ${isAdmin ? '<button class="gold-button" id="adminButton">Abrir painel administrativo</button>' : ""}
      <button class="small-button" id="logoutButton">Terminar sessão</button>
    `);

    $("#logoutButton").onclick = async () => {
      await supabaseClient.auth.signOut();
      closeModal();
    };

    if (isAdmin) $("#adminButton").onclick = adminPanel;
  }

  // Painel administrativo
  async function adminPanel(section = "overview") {
    const profile = await getAdminProfile();

    if (!profile) {
      toast("Acesso reservado ao administrador.");
      return;
    }

    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select("id,status,total,currency,created_at,buyer_email,lava_invoice_id,lava_offer_id,product_name")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      showModal(`
        <h2>Painel administrativo</h2>
        <p>Não foi possível consultar as encomendas. Verifica as permissões da tabela orders no Supabase.</p>
        <button class="small-button" id="backAccount">Voltar</button>
      `);
      $("#backAccount").onclick = accountPanel;
      return;
    }

    const rows = orders || [];
    const paid = rows.filter(o => o.status === "pago");
    const pending = rows.filter(o => o.status === "pendente");
    const cancelled = rows.filter(o => o.status === "cancelado");

    const totals = {};
    paid.forEach(o => {
      const currency = o.currency || "USD";
      totals[currency] = (totals[currency] || 0) + Number(o.total || 0);
    });

    const customers = new Map();
    rows.forEach(o => {
      const email = (o.buyer_email || "").trim().toLowerCase();
      if (!email) return;

      if (!customers.has(email)) {
        customers.set(email, {
          email,
          count: 0,
          spent: {},
          latest: o.created_at
        });
      }

      const customer = customers.get(email);
      customer.count++;

      if (o.status === "pago") {
        const currency = o.currency || "USD";
        customer.spent[currency] =
          (customer.spent[currency] || 0) + Number(o.total || 0);
      }
    });

    const nav = `
      <div class="admin-nav">
        <button data-admin-section="overview">Visão geral</button>
        <button data-admin-section="orders">Encomendas</button>
        <button data-admin-section="customers">Clientes</button>
        <button data-admin-section="reports">Relatórios</button>
      </div>
    `;

    let content = "";

    if (section === "overview") {
      content = `
        <div class="admin-stats">
          <div class="admin-stat"><small>Total de encomendas</small><strong>${rows.length}</strong></div>
          <div class="admin-stat"><small>Pagas</small><strong>${paid.length}</strong></div>
          <div class="admin-stat"><small>Pendentes</small><strong>${pending.length}</strong></div>
          <div class="admin-stat"><small>Canceladas</small><strong>${cancelled.length}</strong></div>
          <div class="admin-stat"><small>Clientes com encomendas</small><strong>${customers.size}</strong></div>
        </div>

        <h3>Vendas confirmadas</h3>
        ${Object.keys(totals).length
          ? Object.entries(totals).map(([currency, value]) =>
              `<p><b>${money(value, currency)}</b> em ${escapeHTML(currency)}</p>`
            ).join("")
          : "<p>Ainda não existem vendas confirmadas.</p>"}

        <h3>Encomendas recentes</h3>
        ${renderOrderRows(rows.slice(0, 5))}
      `;
    }

    if (section === "orders") {
      content = `
        <h3>Gestão de encomendas</h3>
        <p>Consulta os dados das compras e o estado recebido no sistema.</p>
        ${renderOrderRows(rows)}
      `;
    }

    if (section === "customers") {
      content = `
        <h3>Clientes</h3>
        <p>Lista de emails identificados nas encomendas registadas. Não inclui necessariamente contas sem compras.</p>
        ${customers.size
          ? Array.from(customers.values()).map(c => `
              <div class="admin-row">
                <b>${escapeHTML(c.email)}</b>
                <p>Encomendas: ${c.count}</p>
                ${Object.entries(c.spent).map(([currency, value]) =>
                  `<p>Compras pagas: ${money(value, currency)}</p>`
                ).join("")}
              </div>
            `).join("")
          : "<p>Ainda não há clientes com encomendas registadas.</p>"}
      `;
    }

    if (section === "reports") {
      content = `
        <h3>Relatórios de vendas</h3>
        <p>Os valores abaixo consideram apenas encomendas com estado <b>pago</b>.</p>
        ${Object.keys(totals).length
          ? Object.entries(totals).map(([currency, value]) => `
              <div class="admin-row">
                <b>${escapeHTML(currency)}</b>
                <p>Total recebido: ${money(value, currency)}</p>
              </div>
            `).join("")
          : "<p>Não existem vendas pagas para apresentar.</p>"}
        <p>Encomendas pagas: ${paid.length}</p>
        <p>Encomendas pendentes: ${pending.length}</p>
        <p>Encomendas canceladas: ${cancelled.length}</p>
      `;
    }

    showModal(`
      <div class="admin-header">
        <div>
          <span class="admin-kicker">MUNDO DO ESOTERISMO</span>
          <h2>Painel administrativo</h2>
          <p>Administrador: ${escapeHTML(currentUser.email)}</p>
        </div>
      </div>
      ${nav}
      <div class="admin-content">${content}</div>
      <div class="modal-actions">
        <button class="small-button" id="refreshAdmin">Actualizar dados</button>
        <button class="small-button" id="backAccount">Voltar à conta</button>
      </div>
      <p class="admin-note">Os produtos e os pagamentos continuam a ser geridos através da Lava.top. Este painel consulta os registos disponíveis no Supabase.</p>
    `);

    document.querySelectorAll("[data-admin-section]").forEach(button => {
      button.onclick = () => adminPanel(button.dataset.adminSection);
    });

    $("#refreshAdmin").onclick = () => adminPanel(section);
    $("#backAccount").onclick = accountPanel;
  }

  function renderOrderRows(rows) {
    if (!rows.length) return "<p>Não existem encomendas registadas.</p>";

    return rows.map(o => `
      <div class="admin-row">
        <b>${escapeHTML(o.product_name || "Produto não identificado")}</b>
        <p>Cliente: ${escapeHTML(o.buyer_email || "Email não registado")}</p>
        <p>Valor: ${money(o.total, o.currency || "USD")}</p>
        <p>Estado: <b>${escapeHTML(o.status || "Desconhecido")}</b></p>
        <p>Data: ${o.created_at
          ? escapeHTML(new Date(o.created_at).toLocaleString("pt-PT"))
          : "Não disponível"}</p>
        <p>Referência Lava.top: ${escapeHTML(o.lava_invoice_id || "Não registada")}</p>
      </div>
    `).join("");
  }

  // Estilos do painel administrativo
  function addAdminStyles() {
    if ($("#adminStyles")) return;

    const style = document.createElement("style");
    style.id = "adminStyles";
    style.textContent = `
      .admin-nav{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0}
      .admin-nav button{background:#2a1d36;color:#f0d99c;border:1px solid rgba(215,180,106,.35);padding:9px 11px;border-radius:4px;cursor:pointer;font-size:11px}
      .admin-nav button:hover{background:#493252}
      .admin-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}
      .admin-stat{padding:15px;background:#281c35;border:1px solid rgba(215,180,106,.25);border-radius:5px}
      .admin-stat small{display:block;color:#b9adbf;font-size:11px}
      .admin-stat strong{display:block;color:#f0d99c;font-size:24px;margin-top:5px}
      .admin-row{padding:12px 0;border-bottom:1px solid rgba(215,180,106,.18);overflow-wrap:anywhere}
      .admin-row p{margin:5px 0}
      .admin-kicker{color:#d7b46a;font-size:9px;letter-spacing:2px}
      .admin-note{font-size:10px!important;border-top:1px solid rgba(215,180,106,.2);padding-top:12px}
      @media(min-width:500px){.admin-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("click", e => {
    const button = e.target.closest("[data-add]");
    if (button) addToCart(button.dataset.add);
  });

  $("#cartButton").onclick = openCart;
  $("#accountButton").onclick = openAccount;
  $("#modalClose").onclick = closeModal;

  $("#modalBackdrop").onclick = e => {
    if (e.target.id === "modalBackdrop") closeModal();
  };

  $("#searchInput").addEventListener("input", renderProducts);
  $("#categoryFilter").addEventListener("change", renderProducts);

  const currencyFilter = $("#currencyFilter");
  if (currencyFilter) {
    selectedCurrency = currencyFilter.value || "USD";

    currencyFilter.addEventListener("change", () => {
      selectedCurrency = currencyFilter.value;
      cart = [];
      updateCart();
      renderProducts();
      toast(`Moeda alterada para ${selectedCurrency}.`);
    });
  }

  $("#menuToggle").onclick = () =>
    $("#mainNav").classList.toggle("open");

  $("#year").textContent = new Date().getFullYear();

  setupContact();
  addAdminStyles();

  if (ready()) {
    supabaseClient = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY
    );

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
    });

    supabaseClient.auth.getSession().then(({ data }) => {
      currentUser = data.session?.user || null;
    });
  }

  loadProducts();
})();
