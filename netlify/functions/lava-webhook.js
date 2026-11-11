
export default async (request) => {
  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    });

  // Verificação do endereço no navegador
  if (request.method === "GET") {
    return respond({
      success: true,
      message: "Webhook Mundo do Esoterismo ativo.",
      accepts: ["POST"]
    });
  }

  // Aceitar apenas notificações POST
  if (request.method !== "POST") {
    return respond(
      { error: "Método não permitido" },
      405
    );
  }

  const secret = Netlify.env.get("LAVA_WEBHOOK_SECRET");
  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!secret || !supabaseUrl || !serviceKey) {
    console.error("Configuração incompleta do webhook.");

    return respond(
      { error: "Erro de configuração" },
      500
    );
  }

  // Validar autenticação
  const receivedKey = request.headers.get("X-Api-Key") || "";

  if (receivedKey !== secret) {
    return respond(
      { error: "Não autorizado" },
      401
    );
  }

  let event;

  try {
    event = await request.json();
  } catch {
    return respond(
      { error: "JSON inválido" },
      400
    );
  }

  const eventType = event.eventType;

  // Ignorar eventos não relacionados com pagamentos
  if (
    eventType !== "payment.success" &&
    eventType !== "payment.failed"
  ) {
    return respond({
      received: true,
      ignored: true
    });
  }

  const invoiceId = event.contractId;

  if (!invoiceId) {
    return respond(
      { error: "ID da fatura ausente" },
      400
    );
  }

  // Estados correspondentes ao Supabase
  const status =
    eventType === "payment.success"
      ? "pago"
      : "cancelado";

  try {
    const cleanSupabaseUrl = supabaseUrl.replace(/\/+$/, "");

    const url =
      `${cleanSupabaseUrl}/rest/v1/orders` +
      `?lava_invoice_id=eq.${encodeURIComponent(String(invoiceId))}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        status
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Erro ao atualizar encomenda:",
        response.status,
        errorText
      );

      return respond(
        { error: "Erro ao atualizar encomenda" },
        500
      );
    }

    const updated = await response.json();

    if (!updated.length) {
      return respond(
        { error: "Encomenda não encontrada" },
        404
      );
    }

    return respond({
      received: true,
      updated: true,
      status
    });

  } catch (error) {
    console.error(
      "Erro interno no webhook:",
      error?.message || error
    );

    return respond(
      { error: "Erro interno" },
      500
    );
  }
};
