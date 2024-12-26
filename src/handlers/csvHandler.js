const fs = require("fs");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const path = require("path");
const csv = require("csv-parse");

let existingPlaceIds = new Set();

function readCEPsFromJSON(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const json = JSON.parse(data);
      const ceps = [];
      for (const uf in json) {
        for (const location in json[uf]) {
          const cepsInLocation = json[uf][location];
          for (const cep of cepsInLocation) {
            ceps.push({ cep, uf, location });
          }
        }
      }
      resolve(ceps);
    });
  });
}

function loadExistingPlaceIds(filePath) {
  console.log(`Loading existing place IDs from ${filePath}`);

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf8");
    const lines = data.split("\n");
    lines.forEach((line) => {
      const columns = line.split(",");
      if (columns.length > 4) {
        existingPlaceIds.add(columns[4]); // Adiciona o place_id ao Set
      }
    });
  }
}

function appendToCSV(record, stringifier, filePath) {
  if (existingPlaceIds.has(record.place_id)) {
    console.log(`Place ID ${record.place_id} já existe, pulando.`);
    return;
  }

  try {
    fs.appendFileSync(filePath, stringifier.stringifyRecords([record]));
    existingPlaceIds.add(record.place_id);
  } catch (err) {
    console.error("Error writing to CSV file:", err);
  }
}

function initializeCsvFiles(filePath, stringifier) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    console.log(`Initializing CSV file at: ${filePath}`);

    const headerString = stringifier.getHeaderString();
    if (headerString) {
      fs.writeFileSync(filePath, headerString);
    } else {
      console.error(
        "Erro: headerString está nulo. Verifique os cabeçalhos do CSV."
      );
    }
  }
}

function getCsvStringifier(headers) {
  return createCsvStringifier({
    header: headers,
  });
}

async function readCoordinatesFromCSV(filePath) {
  const estado = path.basename(filePath, ".csv");

  const backupPath = filePath + ".backup";
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log("Backup do arquivo de entrada criado");
  }

  return new Promise((resolve, reject) => {
    try {
      const fileContent = fs.readFileSync(backupPath, "utf-8");
      const lines = fileContent.split("\n");

      // Remove o cabeçalho
      const header = lines[0];
      lines.splice(0, 1);

      // Remove linhas vazias
      const validLines = lines.filter((line) => line.trim());

      // Reorganiza as linhas alternando entre início e fim
      const coordinates = [];
      let frontIndex = 0;
      let backIndex = validLines.length - 1;

      while (frontIndex <= backIndex) {
        // Adiciona do início se houver
        if (frontIndex <= backIndex) {
          const frontLine = validLines[frontIndex];
          const frontRow = frontLine.split(",");
          coordinates.push({
            latitude: parseFloat(frontRow[0]),
            longitude: parseFloat(frontRow[1]),
            zoom: 15,
            estado: estado,
            originalLine: frontLine,
            position: "início", // Para log
          });
          frontIndex++;
        }

        // Adiciona do final se houver e não for a mesma linha
        if (frontIndex <= backIndex) {
          const backLine = validLines[backIndex];
          const backRow = backLine.split(",");
          coordinates.push({
            latitude: parseFloat(backRow[0]),
            longitude: parseFloat(backRow[1]),
            zoom: 15,
            estado: estado,
            originalLine: backLine,
            position: "final", // Para log
          });
          backIndex--;
        }
      }

      if (coordinates.length === 0) {
        console.log("Arquivo de backup vazio, recriando do original...");
        fs.copyFileSync(filePath, backupPath);
      }

      resolve(coordinates);
    } catch (error) {
      reject(error);
    }
  });
}

function removeProcessedCoordinate(filePath, originalLine) {
  try {
    const backupPath = filePath + ".backup";
    const content = fs.readFileSync(backupPath, "utf-8");
    const lines = content.split("\n");
    const newContent = lines
      .filter((line) => line.trim() !== originalLine.trim())
      .join("\n");
    fs.writeFileSync(backupPath, newContent);
  } catch (error) {
    console.error("Erro ao remover linha processada:", error);
  }
}

module.exports = {
  readCEPsFromJSON,
  loadExistingPlaceIds,
  appendToCSV,
  initializeCsvFiles,
  getCsvStringifier,
  existingPlaceIds,
  loadExistingPlaceIds,
  readCoordinatesFromCSV,
  removeProcessedCoordinate,
};
