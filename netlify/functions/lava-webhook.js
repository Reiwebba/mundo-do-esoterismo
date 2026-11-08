export default async (request) => {
  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });

  if (request.method !== "POST") {
    return respond({ error: "Método não permitido" }, 405);
  }

  const secret = Netlify.env.get("LAVA_WEBHOOK_SECRET");
  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!secret || !supabaseUrl || !serviceKey) {
    console.error("Configuração incompleta do webhook.");
    return respond({ error: "Erro de configuração" }, 500);
  }

  const receivedKey = request.headers.get("X-Api-Key") || "";

  if (receivedKey !== secret) {
    return respond({ error: "Não autorizado" }, 401);
  }

  let event;

  try {
    event = await request.json();
  } catch {
    return respond({ error: "JSON inválido" }, 400);
  }

  const eventType = event.eventType;

  if (
    eventType !== "payment.success" &&
    eventType !== "payment.failed"
  ) {
    return respond({ received: true, ignored: true });
  }

  const invoiceId = event.contractId;

  if (!invoiceId) {
    return respond({ error: "ID da fatura ausente" }, 400);
  }

  const status =
    eventType === "payment.success" ? "paid" : "failed";

  try {
    const url =
      `${supabaseUrl}/rest/v1/orders` +
      `?lava_invoice_id=eq.${encodeURIComponent(String(invoiceId))}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      console.error("Erro ao atualizar encomenda:", response.status);
      return respond({ error: "Erro ao atualizar encomenda" }, 500);
    }

    const updated = await response.json();

    if (!updated.length) {
      console.error("Fatura sem encomenda associada.");
      return respond({ error: "Encomenda não encontrada" }, 500);
    }

    return respond({ received: true, updated: true });

  } catch (error) {
    console.error("Erro interno no webhook.");
    return respond({ error: "Erro interno" }, 500);
  }
};
