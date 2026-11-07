                                                           export default async (request) => {
  const apiKey = Netlify.env.get("LAVA_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Chave API não configurada" }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      message: "Ligação ao servidor configurada."
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
};                                                                                                                                                                       
