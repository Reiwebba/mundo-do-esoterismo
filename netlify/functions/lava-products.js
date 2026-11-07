export default async (request) => {
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405 }
    );
  }

  const apiKey = Netlify.env.get("LAVA_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Chave API não configurada" }),
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://gate.lava.top/api/v2/products?contentCategories=PRODUCT&feedVisibility=ONLY_VISIBLE&showAllSubscriptionPeriods=false",
      {
        headers: {
          "Accept": "application/json",
          "X-Api-Key": apiKey
        }
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Erro ao consultar a Lava.top",
          status: response.status
        }),
        { status: 502 }
      );
    }

    const data = await response.json();

    const products = (data.items || []).filter(
      product => product.type === "DIGITAL_PRODUCT"
    );

    return new Response(
      JSON.stringify({ items: products }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Falha na ligação à Lava.top" }),
      { status: 500 }
    );
  }
};
