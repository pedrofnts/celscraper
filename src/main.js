const path = require("path");
const fs = require("fs");

// Pega o estado da linha de comando
const targetState = process.argv[2];
if (!targetState) {
  console.error("Por favor, forneça um estado como parâmetro. Ex: node src/main.js paraiba");
  process.exit(1);
}

// Agora usa diretamente o arquivo do estado
const stateFilePath = path.join(__dirname, "data", `${targetState.toLowerCase()}.csv`);
const resultsDir = path.join(__dirname, "..", "results");

// Verifica se o arquivo existe
if (!fs.existsSync(stateFilePath)) {
  console.error(`Arquivo ${stateFilePath} não encontrado`);
  process.exit(1);
}

const {
  appendToCSV,
  initializeCsvFiles,
  loadExistingPlaceIds,
  getCsvStringifier,
  readCoordinatesFromCSV,
  existingPlaceIds,
  removeProcessedCoordinate,
} = require("./handlers/csvHandler");
const { searchValueSERP } = require("./handlers/apiHandler");

const csvStringifier = getCsvStringifier([
  { id: "position", title: "Position" },
  { id: "title", title: "Title" },
  { id: "link", title: "Link" },
  { id: "place_id", title: "Place ID" },
  { id: "address", title: "Address" },
  { id: "city", title: "City" },
  { id: "state", title: "State" },
  { id: "phone", title: "Phone" },
  { id: "rating", title: "Rating" },
  { id: "reviews", title: "Reviews" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "estado", title: "Estado" },
]);

const QUERIES = ["celular", "iphone"];
const RESULTS_PER_PAGE = 20;
const MAX_DUPLICATE_IDS = 19;
const MAX_FULL_DUPLICATE_PAGES = 3;

async function processState(coordinates, estado) {
  console.log(`\nProcessando estado: ${estado}`);
  const outputCsvFilePath = path.join(
    resultsDir,
    `${estado.toLowerCase()}_output.csv`
  );

  initializeCsvFiles(outputCsvFilePath, csvStringifier);
  loadExistingPlaceIds(outputCsvFilePath);

  console.log(`Processando ${coordinates.length} coordenadas`);

  for (const coordData of coordinates) {
    console.log(`\nProcessando coordenadas: ${coordData.latitude}, ${coordData.longitude}`);
    
    try {
      for (const query of QUERIES) {
        console.log(`\nBuscando por: ${query}`);
        let continueFetching = true;
        let currentPage = 1;
        let existingPlaceIdCount = 0;
        let fullDuplicatePages = 0;

        while (continueFetching) {
          const response = await searchValueSERP(
            coordData.latitude,
            coordData.longitude,
            15,
            currentPage,
            query
          );

          if (response && response.places_results) {
            let newPlaceIdFound = false;
            let allDuplicatesInPage = true;
            let resultsInPage = 0;

            for (const place of response.places_results) {
              if (!place.place_id) {
                console.log("Place ID undefined encontrado na resposta da API");
                continue;
              }

              resultsInPage++;

              if (!existingPlaceIds.has(place.place_id)) {
                newPlaceIdFound = true;
                allDuplicatesInPage = false;
                const record = {
                  position: place.position,
                  title: place.title,
                  link: place.link,
                  place_id: place.place_id,
                  address: place.address,
                  city: place.city || "N/A",
                  state: place.state || "N/A",
                  phone: place.phone,
                  rating: place.rating,
                  reviews: place.reviews,
                  latitude: place.gps_coordinates?.latitude,
                  longitude: place.gps_coordinates?.longitude,
                  estado: estado,
                };
                appendToCSV(record, csvStringifier, outputCsvFilePath);
              } else {
                existingPlaceIdCount++;
              }
            }

            if (allDuplicatesInPage && resultsInPage > 0) {
              fullDuplicatePages++;
              console.log(
                `Página ${currentPage} com todos resultados duplicados (${fullDuplicatePages}/${MAX_FULL_DUPLICATE_PAGES})`
              );
            } else {
              fullDuplicatePages = 0;
            }

            continueFetching =
              (newPlaceIdFound ||
                fullDuplicatePages < MAX_FULL_DUPLICATE_PAGES) &&
              response.places_results.length === RESULTS_PER_PAGE &&
              existingPlaceIdCount <= MAX_DUPLICATE_IDS;

            if (continueFetching) {
              currentPage++;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else if (fullDuplicatePages >= MAX_FULL_DUPLICATE_PAGES) {
              console.log(
                `Parando após ${MAX_FULL_DUPLICATE_PAGES} páginas consecutivas com todos resultados duplicados`
              );
            }
          } else {
            continueFetching = false;
          }
        }
      }

      removeProcessedCoordinate(stateFilePath, coordData.originalLine);
    } catch (error) {
      console.error(`Erro ao processar coordenada: ${error.message}`);
    }
  }
}

async function main() {
  try {
    const coordinates = await readCoordinatesFromCSV(stateFilePath);
    
    try {
      await processState(coordinates, targetState);
      console.log(`Concluído processamento do estado: ${targetState}`);
    } catch (error) {
      console.error(`Erro ao processar estado ${targetState}:`, error);
    }

    console.log("\nProcessamento concluído!");

    // Se todas as coordenadas foram processadas, remove o arquivo de backup
    if (coordinates.length === 0) {
      console.log("Todas as coordenadas foram processadas");
      
      // Remove apenas o arquivo de backup, mantendo o original
      if (fs.existsSync(stateFilePath + '.backup')) {
        fs.unlinkSync(stateFilePath + '.backup');
        console.log(`Arquivo ${stateFilePath}.backup removido`);
      }
    }
  } catch (error) {
    console.error("Erro durante a execução:", error);
    process.exit(1);
  }
}

main();
