const fs = require("fs");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const path = require("path");
const csv = require('csv-parse');

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
  // Extrai o estado do nome do arquivo
  const estado = path.basename(filePath, '.csv');
  
  // Cria o arquivo de backup se não existir
  const backupPath = filePath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log('Backup do arquivo de entrada criado');
  }

  return new Promise((resolve, reject) => {
    try {
      // Lê do arquivo de backup ao invés do original
      const fileContent = fs.readFileSync(backupPath, 'utf-8');
      const lines = fileContent.split('\n');
      
      // Remove o cabeçalho e guarda para depois
      const header = lines[0];
      lines.splice(0, 1);
      
      // Inverte a ordem das linhas (de baixo para cima)
      const reversedLines = lines.reverse();
      
      const coordinates = [];
      
      // Processa cada linha
      reversedLines.forEach(line => {
        if (line.trim()) {  // Ignora linhas vazias
          const row = line.split(',');
          coordinates.push({
            latitude: parseFloat(row[0]),
            longitude: parseFloat(row[1]),
            zoom: 15, // Força zoom 15
            estado: estado, // Usa o nome do arquivo como estado
            originalLine: line
          });
        }
      });

      // Se o arquivo de backup estiver vazio (só com cabeçalho), recria ele
      if (coordinates.length === 0) {
        console.log('Arquivo de backup vazio, recriando do original...');
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
    const backupPath = filePath + '.backup';
    const content = fs.readFileSync(backupPath, 'utf-8');
    const lines = content.split('\n');
    const newContent = lines.filter(line => line.trim() !== originalLine.trim()).join('\n');
    fs.writeFileSync(backupPath, newContent);
  } catch (error) {
    console.error('Erro ao remover linha processada:', error);
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
