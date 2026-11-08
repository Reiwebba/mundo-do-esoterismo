
(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = (s) => document.querySelector(s);

  let supabaseClient = null;
  let products = [];
  let cart = [];
  let currentUser = null;
  let selectedCurrency = "USD";

  const icons = {
    Ebook: "✧",
    Curso: "☾",
    Vídeo: "◇"
  };

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

  const escapeHTML = (s = "") =>
    String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

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
        toast("Configura primeiro o teu número de WhatsApp no ficheiro config.js.");
      }
    });
  }

  function getProductData(item) {
    const product = item.data || item;
    const offer = product.offers?.[0];
    const prices = offer?.prices || [];

    const price =
      prices.find(p => p.currency === selectedCurrency) ||
      prices.find(p => p.currency === "USD") ||
      prices[0];

    return {
      id: product.id,
      offerId: offer?.id,
      name: product.title || product.name || "Produto digital",
      description:
        product.description ||
        offer?.description ||
        "Conteúdo digital disponível na nossa loja.",
      type: "Ebook",
      price: Number(price?.amount || 0),
      currency: price?.currency || "USD"
    };
  }

  function renderProducts() {
    const query = ($("#searchInput")?.value || "").toLowerCase();
    const category = $("#categoryFilter")?.value || "";

    const list = products.filter(p =>
      (!category || p.type === category) &&
      (`${p.name} ${p.description || ""}`.toLowerCase().includes(query))
    );

    $("#productGrid").innerHTML = list.length
      ? list.map(p => `
        <article class="product-card">
          <div class="product-art">
            ${icons[p.type] || "✧"}
          </div>

          <div class="product-info">
            <span class="product-type">
              ${escapeHTML(p.type || "Digital")}
            </span>

            <h3>${escapeHTML(p.name)}</h3>

            <p>${escapeHTML(
              p.description ||
              "Conteúdo digital disponível na nossa loja."
            )}</p>

            <div class="product-bottom">
              <span class="price">${money(p.price, p.currency)}</span>

              <button
                class="small-button"
                data-add="${escapeHTML(p.id)}">
                Comprar
              </button>
            </div>
          </div>
        </article>
      `).join("")
      : '<div class="empty-state">Ainda não há produtos publicados nesta categoria.</div>';
  }

  async function loadProducts() {
    $("#productGrid").innerHTML =
      '<div class="empty-state">A carregar os produtos...</div>';

    try {
      const response = await fetch(
        "/.netlify/functions/lava-products"
      );

      if (!response.ok) {
        throw new Error("Erro ao consultar a Lava.top.");
      }

      const result = await response.json();
      const items = result.items || [];

      products = items
        .map(getProductData)
        .filter(p => p.id && p.offerId);

      renderProducts();

      if (!products.length) {
        $("#productGrid").innerHTML =
          '<div class="empty-state">Não foram encontrados produtos disponíveis.</div>';
      }

    } catch (error) {
      console.error("Erro ao carregar produtos:", error);

      $("#productGrid").innerHTML =
        '<div class="empty-state">Não foi possível carregar os produtos. Tenta novamente mais tarde.</div>';
    }
  }

  function updateCart() {
    $("#cartCount").textContent = cart.length;
  }

  function addToCart(id) {
    const product = products.find(
      p => String(p.id) === String(id)
    );

    if (!product) return;

    if (cart.length && String(cart[0].id) !== String(id)) {
      toast("Compra um produto de cada vez, por favor.");
      return;
    }

    cart = [product];
    updateCart();
    toast("Produto adicionado ao carrinho.");
  }

  function openCart() {
    if (!cart.length) {
      showModal(`
        <h2>O teu carrinho</h2>
        <p>O carrinho ainda está vazio. Explora a nossa coleção e escolhe um produto.</p>
      `);
      return;
    }

    const product = cart[0];

    showModal(`
      <h2>O teu carrinho</h2>

      <p>${escapeHTML(product.name)}</p>

      <p><b>Preço: ${money(product.price, product.currency)}</b></p>

      <div class="modal-actions">
        <button class="gold-button" id="checkoutButton">
          Continuar para pagamento
        </button>

        <button class="small-button" id="clearCart">
          Remover produto
        </button>
      </div>

      <p>O pagamento será processado de forma segura pela Lava.top.</p>
    `);

    $("#clearCart").onclick = () => {
      cart = [];
      updateCart();
      closeModal();
    };

    $("#checkoutButton").onclick = checkout;
  }

  async function checkout() {
    if (!cart.length) return;

    const product = cart[0];

    const currencies = ["USD", "EUR", "RUB"];

    showModal(`
      <h2>Finalizar compra</h2>

      <p>${escapeHTML(product.name)}</p>

      <form id="paymentForm">

        <label>
          O teu email
          <input
            class="form-control"
            name="email"
            type="email"
            required
            placeholder="teuemail@exemplo.com"
          >
        </label>

        <label>
          Moeda de pagamento
          <select class="form-control" name="currency">
            ${currencies.map(currency => `
              <option
                value="${currency}"
                ${currency === selectedCurrency ? "selected" : ""}>
                ${currency}
              </option>
            `).join("")}
          </select>
        </label>

        <p id="paymentPrice">
          Preço: ${money(product.price, product.currency)}
        </p>

        <button class="gold-button" type="submit">
          Criar pagamento
        </button>

      </form>

      <p>Depois da criação do pagamento, serás encaminhado para a página segura da Lava.top.</p>
    `);

    $("#paymentForm").onsubmit = async e => {
      e.preventDefault();

      const form = new FormData(e.target);
      const email = form.get("email");
      const currency = form.get("currency");

      const button = e.target.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "A preparar pagamento...";

      try {
        const response = await fetch(
          "/.netlify/functions/lava-invoice",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email,
              offerId: product.offerId,
              currency
            })
          }
        );

        const data = await response.json();

        if (!response.ok || !data.paymentUrl) {
          throw new Error(
            data.error || "Não foi possível criar o pagamento."
          );
        }

        cart = [];
        updateCart();

        window.location.href = data.paymentUrl;

      } catch (error) {
        console.error("Erro no pagamento:", error);
        toast(error.message || "Erro ao iniciar o pagamento.");

        button.disabled = false;
        button.textContent = "Tentar novamente";
      }
    };

    $("#paymentForm").querySelector(
      '[name="currency"]'
    ).onchange = e => {
      const currency = e.target.value;
      const price = product.price;
      $("#paymentPrice").textContent =
        `Preço apresentado: ${money(price, product.currency)}. A moeda seleccionada será enviada à Lava.top.`;
    };
  }

  function openAccount() {
    if (!supabaseClient) {
      toast("A área de contas não está disponível neste momento.");
      return;
    }

    if (currentUser) {
      accountPanel();
      return;
    }

    showModal(`
      <h2>Minha conta</h2>

      <form id="authForm">
        <label>
          Email
          <input class="form-control" name="email" type="email" required>
        </label>

        <label>
          Palavra-passe
          <input class="form-control" name="password" type="password" minlength="6" required>
        </label>

        <button class="gold-button" type="submit">Entrar</button>
      </form>

      <p>
        Ainda não tens conta?
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

      if (error) {
        toast(error.message);
      } else {
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
        <label>
          Nome
          <input class="form-control" name="name" required>
        </label>

        <label>
          Email
          <input class="form-control" name="email" type="email" required>
        </label>

        <label>
          Palavra-passe
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
        options: {
          data: { full_name: f.get("name") }
        }
      });

      if (error) {
        toast(error.message);
      } else {
        toast("Conta criada. Verifica o teu email, se a confirmação estiver activa.");
      }
    };
  }

  async function accountPanel() {
    if (!supabaseClient || !currentUser) return;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role,full_name")
      .eq("id", currentUser.id)
      .maybeSingle();

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id,status,total,currency,created_at")
      .order("created_at", { ascending: false });

    const isAdmin = profile?.role === "admin";

    showModal(`
      <h2>Olá, ${escapeHTML(profile?.full_name || currentUser.email)}</h2>

      <p>${escapeHTML(currentUser.email)}</p>

      <h3>As minhas encomendas</h3>

      ${(orders || []).length
        ? orders.map(o => `
          <p>
            Encomenda ${String(o.id).slice(0, 8)}
            — ${money(o.total, o.currency)}
            — <b>${escapeHTML(o.status)}</b>
          </p>
        `).join("")
        : "<p>Ainda não tens encomendas registadas.</p>"
      }

      ${isAdmin
        ? '<button class="gold-button" id="adminButton">Painel administrativo</button>'
        : ""
      }

      <button class="small-button" id="logoutButton">Terminar sessão</button>
    `);

    $("#logoutButton").onclick = async () => {
      await supabaseClient.auth.signOut();
      closeModal();
    };

    if (isAdmin) {
      $("#adminButton").onclick = adminPanel;
    }
  }

  async function adminPanel() {
    if (!supabaseClient) return;

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id,status,total,currency,created_at")
      .order("created_at", { ascending: false });

    const { data: items } = await supabaseClient
      .from("products")
      .select("id,name,price,type,is_active")
      .order("created_at", { ascending: false });

    showModal(`
      <h2>Painel administrativo</h2>

      <p>
        Os produtos públicos são geridos na Lava.top.
        Esta área mantém a gestão das encomendas existentes no Supabase.
      </p>

      <h3>Encomendas</h3>

      ${(orders || []).map(o => `
        <div class="admin-row">
          <p>
            ${String(o.id).slice(0, 8)}
            · ${money(o.total, o.currency)}
            · ${escapeHTML(o.status)}
          </p>

          ${o.status !== "paid"
            ? `<button class="small-button" data-paid="${o.id}">Marcar como paga</button>`
            : ""
          }
        </div>
      `).join("") || "<p>Sem encomendas.</p>"}

      <h3>Produtos antigos do Supabase</h3>

      <p>${(items || []).length} produtos registados.</p>

      <button class="small-button" id="backAccount">Voltar à conta</button>
    `);

    document.querySelectorAll("[data-paid]").forEach(b => {
      b.onclick = async () => {
        const { error } = await supabaseClient
          .from("orders")
          .update({ status: "paid" })
          .eq("id", b.dataset.paid);

        if (error) {
          toast(error.message);
        } else {
          toast("Encomenda actualizada.");
          adminPanel();
        }
      };
    });

    $("#backAccount").onclick = accountPanel;
  }

  function whatsappURL(message) {
    const n = String(cfg.WHATSAPP_NUMBER || "").replace(/\D/g, "");

    return n && !n.endsWith("000000")
      ? `https://wa.me/${n}?text=${encodeURIComponent(message)}`
      : "#";
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

  $("#menuToggle").onclick = () =>
    $("#mainNav").classList.toggle("open");

  $("#year").textContent = new Date().getFullYear();

  setupContact();

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
