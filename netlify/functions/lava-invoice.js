export default async (request) => {
  if (request.method !== "POST") {
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
    const body = await request.json();
    const { email, offerId, currency } = body;

    if (!email || !offerId || !currency) {
      return new Response(
        JSON.stringify({ error: "Dados de pagamento incompletos" }),
        { status: 400 }
      );
    }

    const response = await fetch(
      "https://gate.lava.top/api/v3/invoice",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Api-Key": apiKey
        },
        body: JSON.stringify({ email, offerId, currency })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Não foi possível criar o pagamento" }),
        { status: 502 }
      );
    }

    return new Response(
      JSON.stringify({ paymentUrl: data.paymentUrl }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Erro ao processar pagamento" }),
      { status: 500 }
    );
  }
};
