export default async (request) => {
  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });

  if (request.method !== "POST") {
    return respond({ error: "Método não permitido" }, 405);
  }

  const apiKey = Netlify.env.get("LAVA_API_KEY");
  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiKey || !supabaseUrl || !serviceKey) {
    return respond({ error: "Configuração incompleta" }, 500);
  }

  try {
    const { email, offerId, currency } = await request.json();

    if (!email || !offerId || !currency) {
      return respond({ error: "Dados de pagamento incompletos" }, 400);
    }

    const lavaResponse = await fetch(
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

    const data = await lavaResponse.json();

    if (!lavaResponse.ok) {
      console.error("Erro Lava:", lavaResponse.status);
      return respond({ error: "A Lava.top não conseguiu criar a fatura" }, 502);
    }

    const invoiceId =
      data.invoiceId ||
      data.contractId ||
      data.id ||
      data.data?.invoiceId ||
      data.data?.contractId ||
      data.data?.id;

    if (!data.paymentUrl || !invoiceId) {
      console.error("Resposta da Lava sem os dados necessários.");
      return respond({ error: "Resposta incompleta da Lava.top" }, 502);
    }

    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          buyer_email: email,
          lava_invoice_id: String(invoiceId),
          lava_offer_id: String(offerId),
          status: "pending",
          currency
        })
      }
    );

    if (!orderResponse.ok) {
      console.error("Erro ao guardar encomenda:", orderResponse.status);
      return respond({ error: "Não foi possível guardar a encomenda" }, 500);
    }

    return respond({ paymentUrl: data.paymentUrl });

  } catch (error) {
    console.error("Erro interno ao criar pagamento.");
    return respond({ error: "Erro ao processar pagamento" }, 500);
  }
};
