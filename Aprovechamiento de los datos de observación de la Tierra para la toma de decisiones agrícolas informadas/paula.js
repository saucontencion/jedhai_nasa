// Inicializar Google Earth Engine
var region = ee.Geometry.Rectangle([-75.0, 40.0, -74.0, 41.0]);  // Define la región de interés

// Función para filtrar imágenes por fecha y área
function filtrarImagenes(collection, startDate, endDate, region) {
  return collection
    .filterDate(startDate, endDate)
    .filterBounds(region)
    .mean();  // Promediar imágenes en el rango de fechas
}

// 1. Cantidad de lluvia (GPM Precipitation)
var lluvia = ee.ImageCollection('NASA/GPM_L3/IMERG_V06')
    .select('precipitationCal')
    .filterDate('2023-01-01', '2023-12-31')
    .mean()
    .clip(region);

var lluviaVis = {
  min: 0,
  max: 10,
  palette: ['blue', 'cyan', 'green', 'yellow', 'orange', 'red']
};

Map.addLayer(lluvia, lluviaVis, 'Lluvia');

// 2. Humedad del suelo (SMAP Soil Moisture)
var humedad = ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
    .select('ssm')
    .filterDate('2023-01-01', '2023-12-31')
    .mean()
    .clip(region);

var humedadVis = {
  min: 0,
  max: 0.5,
  palette: ['white', 'blue', 'green']
};

Map.addLayer(humedad, humedadVis, 'Humedad del Suelo');

// 3. Temperatura de la superficie (MODIS)
var temperaturaCollection = ee.ImageCollection('MODIS/006/MOD11A2')
    .select('LST_Day_1km')
    .filterDate('2023-01-01', '2023-12-31')
    .filterBounds(region);

print('Número de imágenes de temperatura:', temperaturaCollection.size());  // Verificar el número de imágenes

var temperatura = temperaturaCollection
    .mean()
    .clip(region);

// Verifica si la imagen de temperatura tiene bandas
print('Bandas de temperatura:', temperatura.bandNames());

// Si no tiene bandas, usar una imagen de valor predeterminado (valor 0)
var temperaturaFinal = ee.Algorithms.If(temperatura.bandNames().size().eq(0),
                                        ee.Image(0),  // Imagen de valor 0 si no hay bandas
                                        temperatura);

// Multiplicar la imagen solo si tiene bandas válidas
temperaturaFinal = ee.Image(temperaturaFinal).multiply(0.02).subtract(273.15);

var temperaturaVis = {
  min: 10,
  max: 40,
  palette: ['blue', 'yellow', 'red']
};

Map.addLayer(temperaturaFinal, temperaturaVis, 'Temperatura');

// 4. Índice de sequedad (NDVI inverso con Sentinel-2)
var ndvi = ee.ImageCollection('COPERNICUS/S2')
    .filterDate('2023-01-01', '2023-12-31')
    .filterBounds(region)
    .map(function(image) {
      var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      return image.addBands(ndvi);
    })
    .select('NDVI')
    .mean()
    .clip(region);

var sequedad = ndvi.multiply(-1);  // Inverso del NDVI para determinar sequedad

var sequedadVis = {
  min: 0,
  max: 1,
  palette: ['white', 'brown', 'black']
};

Map.addLayer(sequedad, sequedadVis, 'Sequedad del Suelo');

// 5. Análisis de minerales (Sentinel-2 bandas espectrales)
// En lugar de usar una paleta, usaremos una combinación RGB de bandas
var minerales = ee.ImageCollection('COPERNICUS/S2')
    .filterDate('2023-01-01', '2023-12-31')
    .filterBounds(region)
    .select(['B11', 'B12', 'B8'])  // Seleccionar tres bandas para visualización en RGB
    .mean()
    .clip(region);

var mineralesVis = {
  min: 500,
  max: 4000,
  bands: ['B11', 'B12', 'B8']  // Usar las tres bandas en RGB
};

Map.addLayer(minerales, mineralesVis, 'Minerales del Suelo');

// Muestra la región en el mapa
Map.centerObject(region, 8);

// Información de aptitud para siembra (simple lógica basada en valores de humedad y temperatura)

// Verificar si las imágenes de humedad y temperatura tienen bandas antes de realizar comparaciones
var humedadFinal = ee.Algorithms.If(humedad.bandNames().size().eq(0),
                                    ee.Image(0),  // Valor por defecto si no hay bandas
                                    humedad);

var aptitud = ee.Image(humedadFinal).gt(0.2)
    .and(ee.Image(temperaturaFinal).gt(15))
    .and(sequedad.lt(0.5));

var aptitudVis = {
  min: 0,
  max: 1,
  palette: ['red', 'green']
};

Map.addLayer(aptitud.updateMask(aptitud), aptitudVis, 'Aptitud para siembra');