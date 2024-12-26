const axios = require("axios");

async function searchValueSERP(latitude, longitude, zoom, page, query) {
  const API_KEY = "";

  const params = {
    api_key: API_KEY,
    search_type: "places",
    q: query,
    google_domain: "google.com.br",
    gl: "br",
    hl: "pt-br",
    output: "json",
    location: `lat:${latitude},lon:${longitude},zoom:${zoom}`,
    page,
  };

  console.log(
    `Consultando coordenadas: ${latitude}, ${longitude}, zoom: ${zoom}, query: ${query}`
  );
  console.log("Usando API key:", API_KEY.substring(0, 5) + "...");

  try {
    const response = await axios.get("https://api.valueserp.com/search", {
      params,
    });

    if (response.data && response.data.places_results) {
      console.log(
        `ValueSERP Página ${page}: ${response.data.places_results.length} resultados encontrados.`
      );
      return response.data;
    }
    return null;
  } catch (error) {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          console.error("Erro de autenticação: API key inválida");
          process.exit(1);
          break;
        case 402:
          console.error("Limite de créditos atingido na API ValueSERP");
          process.exit(1);
          break;
        default:
          console.error(
            `Erro na consulta ValueSERP (${error.response.status}):`,
            error.response.data
          );
      }
    } else {
      console.error("Erro na consulta ValueSERP:", error.message);
    }
    return null;
  }
}

async function sendErrorMessage() {
  try {
    const response = await axios.post(
      "https://evo.pmcholding.com.br/message/sendText/goclinica",
      {
        number: "5579991036669",
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false,
        },
        textMessage: {
          text: "Execução interrompida",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: "d7eaddf3431f909a7e22c57a72967bef",
        },
      }
    );

    console.log("Mensagem de erro enviada com sucesso", response.data);
  } catch (error) {
    console.error("Erro ao enviar mensagem de erro", error.message);
  }
}

module.exports = {
  searchValueSERP,
};
