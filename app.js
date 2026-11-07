(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  let supabaseClient = null, products = [], cart = [], currentUser = null;
  const icons = {Ebook:"✧",Curso:"☾",Vídeo:"◇"};
  const money = (value) => new Intl.NumberFormat("pt-PT",{style:"currency",currency:cfg.CURRENCY || "USD"}).format(Number(value || 0));
  const toast = (message) => { const el=$("#toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3500); };
  const showModal = (html) => { $("#modalContent").innerHTML=html; $("#modalBackdrop").hidden=false; };
  const closeModal = () => { $("#modalBackdrop").hidden=true; };
  const escapeHTML = (s="") => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const ready = () => window.supabase && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("COLOCA_AQUI") && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("COLOCA_AQUI");

  function setupContact(){
    const number=String(cfg.WHATSAPP_NUMBER||"").replace(/\D/g,"");
    const link=$("#whatsappLink");
    if(number && !number.endsWith("000000")) link.href=`https://wa.me/${number}?text=${encodeURIComponent("Olá! Gostaria de informações sobre os produtos do Mundo do Esoterismo.")}`;
    else link.href="#";
    link.addEventListener("click",e=>{if(link.getAttribute("href")==="#"){e.preventDefault();toast("Configura primeiro o teu número de WhatsApp no ficheiro config.js.");}});
  }
  function renderProducts(){
    const query=($("#searchInput").value||"").toLowerCase();
    const category=$("#categoryFilter").value;
    const list=products.filter(p=>(!category||p.type===category)&&(`${p.name} ${p.description||""}`.toLowerCase().includes(query)));
    $("#productGrid").innerHTML=list.length?list.map(p=>`
      <article class="product-card">
        <div class="product-art">${icons[p.type]||"✧"}</div>
        <div class="product-info">
          <span class="product-type">${escapeHTML(p.type||"Digital")}</span>
          <h3>${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.description||"Conteúdo digital disponível na nossa loja.")}</p>
          <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="small-button" data-add="${p.id}">Adicionar ao carrinho</button></div>
        </div>
      </article>`).join(""):`<div class="empty-state">Ainda não há produtos publicados nesta categoria. Volta em breve.</div>`;
  }
  async function loadProducts(){
    if(!supabaseClient){$("#productGrid").innerHTML='<div class="empty-state">A loja está preparada. Falta configurar a ligação ao Supabase e adicionar os primeiros produtos.</div>';return;}
    const {data,error}=await supabaseClient.from("products").select("id,name,description,type,price,currency,is_active").eq("is_active",true).order("created_at",{ascending:false});
    if(error){console.error(error);$("#productGrid").innerHTML='<div class="empty-state">Não foi possível carregar os produtos. Confirma a configuração da base de dados.</div>';return;}
    products=data||[];renderProducts();
  }
  function updateCart(){ $("#cartCount").textContent=cart.reduce((n,i)=>n+i.quantity,0); }
  function addToCart(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;const item=cart.find(x=>String(x.id)===String(id));if(item)item.quantity++;else cart.push({id:p.id,name:p.name,price:p.price,quantity:1});updateCart();toast("Produto adicionado ao carrinho.");}
  function openCart(){
    if(!cart.length){showModal("<h2>O teu carrinho</h2><p>O carrinho ainda está vazio. Explora a nossa coleção e escolhe um produto.</p>");return;}
    const total=cart.reduce((n,i)=>n+Number(i.price)*i.quantity,0);
    showModal(`<h2>O teu carrinho</h2>${cart.map(i=>`<p>${escapeHTML(i.name)} × ${i.quantity} — ${money(i.price*i.quantity)}</p>`).join("")}<hr><p><b>Total: ${money(total)}</b></p><div class="modal-actions"><button class="gold-button" id="checkoutButton">Continuar para encomenda</button><button class="small-button" id="clearCart">Esvaziar</button></div><p>O pagamento será feito por transferência internacional, conforme as instruções fornecidas após a criação da encomenda.</p>`);
    $("#clearCart").onclick=()=>{cart=[];updateCart();closeModal();};
    $("#checkoutButton").onclick=checkout;
  }
  function openAccount(){
    if(currentUser){accountPanel();return;}
    showModal(`<h2>Minha conta</h2><form id="authForm"><label>Email<input class="form-control" name="email" type="email" required autocomplete="email"></label><label>Palavra-passe<input class="form-control" name="password" type="password" minlength="6" required autocomplete="current-password"></label><button class="gold-button" type="submit">Entrar</button></form><p>Ainda não tens conta? <button class="small-button" id="showSignup">Criar conta</button></p>`);
    $("#authForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabaseClient.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error)toast(error.message);else{closeModal();toast("Sessão iniciada.");}};
    $("#showSignup").onclick=signupForm;
  }
  function signupForm(){
    showModal(`<h2>Criar conta</h2><form id="signupForm"><label>Nome<input class="form-control" name="name" required></label><label>Email<input class="form-control" name="email" type="email" required></label><label>Palavra-passe<input class="form-control" name="password" type="password" minlength="6" required></label><button class="gold-button" type="submit">Criar conta</button></form><p>Ao criar conta, poderás acompanhar as tuas encomendas.</p>`);
    $("#signupForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabaseClient.auth.signUp({email:f.get("email"),password:f.get("password"),options:{data:{full_name:f.get("name")}}});if(error)toast(error.message);else toast("Conta criada. Verifica o teu email, se a confirmação estiver ativa.");};
  }
  async function accountPanel(){
    if(!supabaseClient||!currentUser)return;
    const {data:profile}=await supabaseClient.from("profiles").select("role,full_name").eq("id",currentUser.id).maybeSingle();
    const {data:orders}=await supabaseClient.from("orders").select("id,status,total,currency,created_at").order("created_at",{ascending:false});
    const isAdmin=profile?.role==="admin";
    showModal(`<h2>Olá, ${escapeHTML(profile?.full_name||currentUser.email)}</h2><p>${escapeHTML(currentUser.email)}</p><h3>As minhas encomendas</h3>${(orders||[]).length?(orders||[]).map(o=>`<p>Encomenda ${String(o.id).slice(0,8)} — ${money(o.total)} — <b>${escapeHTML(o.status)}</b></p>`).join(""):"<p>Ainda não tens encomendas.</p>"}${isAdmin?'<button class="gold-button" id="adminButton">Painel administrativo</button>':""}<button class="small-button" id="logoutButton">Terminar sessão</button>`);
    $("#logoutButton").onclick=async()=>{await supabaseClient.auth.signOut();closeModal();};
    if(isAdmin)$("#adminButton").onclick=adminPanel;
  }
  async function checkout(){
    if(!currentUser){toast("Inicia sessão ou cria uma conta para continuar.");openAccount();return;}
    if(!cart.length)return;
    const items=cart.map(i=>({product_id:i.id,quantity:i.quantity}));
    const {data,error}=await supabaseClient.rpc("create_order",{items_json:items});
    if(error){console.error(error);toast("Não foi possível criar a encomenda: "+error.message);return;}
    cart=[];updateCart();
    showModal(`<h2>Encomenda criada!</h2><p>O número da tua encomenda é <b>${escapeHTML(String(data).slice(0,8))}</b>.</p><p>Entra em contacto pelo WhatsApp para receber as instruções de transferência internacional. O acesso ao produto só será disponibilizado depois da confirmação do pagamento.</p><a class="gold-button" href="${whatsappURL("Olá! Criei a encomenda "+data+" na loja Mundo do Esoterismo. Podem enviar-me as instruções de pagamento?")}" target="_blank" rel="noopener">Pedir instruções pelo WhatsApp ↗</a>`);
  }
  function whatsappURL(message){const n=String(cfg.WHATSAPP_NUMBER||"").replace(/\D/g,"");return n&&!n.endsWith("000000")?`https://wa.me/${n}?text=${encodeURIComponent(message)}`:"#";}
  async function adminPanel(){
    const {data:orders}=await supabaseClient.from("orders").select("id,status,total,currency,created_at").order("created_at",{ascending:false});
    const {data:items}=await supabaseClient.from("products").select("id,name,price,type,is_active").order("created_at",{ascending:false});
    showModal(`<h2>Painel administrativo</h2><p>Gestão de encomendas e catálogo. Confirma sempre o recebimento real da transferência antes de marcar uma encomenda como paga.</p><h3>Encomendas</h3>${(orders||[]).map(o=>`<div class="admin-row"><p>${String(o.id).slice(0,8)} · ${money(o.total)} · ${escapeHTML(o.status)}</p>${o.status!=="paid"?`<button class="small-button" data-paid="${o.id}">Marcar como paga</button>`:""}</div>`).join("")||"<p>Sem encomendas.</p>"}<h3>Adicionar produto</h3><form id="productForm"><label>Nome<input class="form-control" name="name" required></label><label>Descrição<textarea class="form-control" name="description" required></textarea></label><label>Tipo<select class="form-control" name="type"><option>Ebook</option><option>Curso</option><option>Vídeo</option></select></label><label>Preço numérico (${escapeHTML(cfg.CURRENCY||"USD")})<input class="form-control" name="price" type="number" min="0.01" step="0.01" required></label><label>Caminho do ficheiro privado (opcional)<input class="form-control" name="file_path"></label><button class="gold-button">Publicar produto</button></form><p><button class="small-button" id="backAccount">Voltar à conta</button></p>`);
    document.querySelectorAll("[data-paid]").forEach(b=>b.onclick=async()=>{const {error}=await supabaseClient.from("orders").update({status:"paid"}).eq("id",b.dataset.paid);if(error)toast(error.message);else{toast("Encomenda atualizada.");adminPanel();}});
    $("#productForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const payload={name:f.get("name"),description:f.get("description"),type:f.get("type"),price:Number(f.get("price")),currency:cfg.CURRENCY||"USD",file_path:f.get("file_path")||null,is_active:true};const {error}=await supabaseClient.from("products").insert(payload);if(error)toast(error.message);else{toast("Produto publicado.");loadProducts();adminPanel();}};
    $("#backAccount").onclick=accountPanel;
  }
  document.addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(b)addToCart(b.dataset.add);});
  $("#cartButton").onclick=openCart;$("#accountButton").onclick=openAccount;
  $("#modalClose").onclick=closeModal;$("#modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")closeModal();};
  $("#searchInput").addEventListener("input",renderProducts);$("#categoryFilter").addEventListener("change",renderProducts);
  $("#menuToggle").onclick=()=>$("#mainNav").classList.toggle("open");
  $("#year").textContent=new Date().getFullYear();setupContact();
  if(ready()){
    supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    supabaseClient.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;});
    supabaseClient.auth.getSession().then(({data})=>{currentUser=data.session?.user||null;});
  }
  loadProducts();
})();