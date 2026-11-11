function checkout() {
  if (!cart.length) return;

  const product = cart[0];

  if (!product.id) {
    toast("Não foi possível identificar este produto na Lava.top.");
    return;
  }

  const productUrl =
    `https://app.lava.top/products/${encodeURIComponent(String(product.id))}`;

  window.location.href = productUrl;
}
