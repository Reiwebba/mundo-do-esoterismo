export default async (request) => {
  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    });

  if (request.method !== "POST") {
    return respond(
      { error: "Método não permitido" },
      405
    );
  }

  const apiKey = Netlify.env.get("LAVA_API_KEY");
  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiKey || !supabaseUrl || !serviceKey) {
    console.error("Configuração incompleta.");
    return respond(
      { error: "Configuração incompleta no servidor" },
      500
    );
  }

  try {
    const {
      email,
      offerId,
      currency,
      productName,
      amount
    } = await request.json();

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !offerId ||
      !currency ||
      !productName ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return respond(
        { error: "Dados de pagamento inválidos ou incompletos" },
        400
      );
    }

    // Criar fatura na Lava.top
    const lavaResponse = await fetch(
      "https://gate.lava.top/api/v3/invoice",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Api-Key": apiKey
        },
        body: JSON.stringify({
          email: String(email).trim(),
          offerId: String(offerId),
          currency: String(currency)
        })
      }
    );

    let data;

    try {
      data = await lavaResponse.json();
    } catch {
      console.error("Resposta inválida da Lava.top.");
      return respond(
        { error: "Resposta inválida do serviço de pagamento" },
        502
      );
    }

    if (!lavaResponse.ok) {
      console.error(
        "A Lava.top recusou a criação da fatura:",
        lavaResponse.status
      );

      return respond(
        { error: "Não foi possível criar o pagamento na Lava.top" },
        502
      );
    }

    // Identificar os dados devolvidos pela Lava.top
    const invoiceId =
      data.invoiceId ||
      data.contractId ||
      data.id ||
      data.data?.invoiceId ||
      data.data?.contractId ||
      data.data?.id;

    const paymentUrl =
      data.paymentUrl ||
      data.payment_url ||
      data.data?.paymentUrl ||
      data.data?.payment_url;

    if (!invoiceId || !paymentUrl) {
      console.error(
        "Resposta da Lava.top sem ID ou URL de pagamento."
      );

      return respond(
        { error: "Não foi possível identificar a fatura criada" },
        502
      );
    }

    // Guardar encomenda no Supabase
    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          buyer_email: String(email).trim(),
          lava_invoice_id: String(invoiceId),
          lava_offer_id: String(offerId),
          product_name: String(productName),
          total: Number(amount),
          currency: String(currency),
          status: "pending"
        })
      }
    );

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();

      console.error(
        "Erro ao guardar encomenda no Supabase:",
        orderResponse.status,
        errorText
      );

      return respond(
        { error: "A fatura foi criada, mas não foi possível registar a encomenda" },
        500
      );
    }

    return respond({
      success: true,
      paymentUrl
    });

  } catch (error) {
    console.error("Erro interno ao criar pagamento.");

    return respond(
      { error: "Erro interno ao processar o pagamento" },
      500
    );
  }
};
