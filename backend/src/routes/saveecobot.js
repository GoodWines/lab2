
import express from 'express';
// import fetch from 'node-fetch';
import Measurement from '../models/Measurement.js';
import Station from '../models/Stations.js';

const router = express.Router();

// GET /api/saveecobot/sync - Синхронізація даних з SaveEcoBot API
router.get('/sync', async (req, res) => {
  try {
    console.log('🔄 Starting SaveEcoBot data sync...');
    
    // Запит до SaveEcoBot API
    const response = await fetch(process.env.SAVEECOBOT_API || 'https://api.saveecobot.com/output.json');
    
    if (!response.ok) {
      throw new Error(`SaveEcoBot API error: ${response.statusText}`);
    }
    
    const saveEcoBotData = await response.json();
    console.log(`📊 Received ${saveEcoBotData.length} stations from SaveEcoBot`);
    
    const results = {
      stations_processed: 0,
      stations_created: 0,
      stations_updated: 0,
      measurements_created: 0,
      errors: []
    };
    
    // Обробка кожної станції 
    for (const stationData of saveEcoBotData) {
      try {
        results.stations_processed++;
        
        // Перетворення даних станції у формат моделі Station
        const stationInfo = {
          station_id: stationData.id,
          city_name: stationData.cityName,
          station_name: stationData.stationName,
          local_name: stationData.localName || '',
          timezone: stationData.timezone,
          location: {
            type: 'Point',
            coordinates: [parseFloat(stationData.longitude), parseFloat(stationData.latitude)]
          },
          platform_name: stationData.platformName,
          measured_parameters: stationData.pollutants.map(p => p.pol)
        };
        
        // Створення або оновлення станції в базі даних
        let station = await Station.findOne({ station_id: stationInfo.station_id });
        if (!station) {
          station = new Station(stationInfo); // Створення нової станції
          await station.save(); 
          results.stations_created++;
          console.log(`✅ Created station: ${stationInfo.station_id}`);
        } else {
          await Station.findOneAndUpdate( // Оновлення існуючої станції
            { station_id: stationInfo.station_id },
            { ...stationInfo, 'metadata.updated_at': new Date() },
            { new: true }
          );
          results.stations_updated++;
        }
        
        // Групування вимірювань по часу
        const measurementGroups = {};
        
        stationData.pollutants.forEach(pollutantData => { // Обробка кожного забруднювача
          if (pollutantData.time && pollutantData.value !== null && pollutantData.value !== undefined) {
            const timeKey = pollutantData.time; // Використання часу як ключа для групування
            
            if (!measurementGroups[timeKey]) { // Ініціалізація групи вимірювань для певного часу
              measurementGroups[timeKey] = { 
                measurement_time: new Date(pollutantData.time),
                pollutants: []
              }; 
            }
            
            measurementGroups[timeKey].pollutants.push({ // Додавання забруднювача до групи
              pollutant: pollutantData.pol,
              value: pollutantData.value,
              unit: pollutantData.unit,
              averaging_period: pollutantData.averaging,
              quality_flag: 'valid'
            });
          }
        });
        
        // Створення вимірювань
        for (const [timeKey, measurementGroup] of Object.entries(measurementGroups)) { // Обробка кожної групи вимірювань
          // Перевірка чи існує вже таке вимірювання
          const existingMeasurement = await Measurement.findOne({
            station_id: stationData.id,
            measurement_time: measurementGroup.measurement_time
          });
          
          if (!existingMeasurement && measurementGroup.pollutants.length > 0) { // Створення нового вимірювання, якщо його ще немає
            const measurement = new Measurement({ // Створення нового вимірювання
              station_id: stationData.id,
              measurement_time: measurementGroup.measurement_time,
              pollutants: measurementGroup.pollutants,
              metadata: {
                source: 'SaveEcoBot',
                original_data: stationData
              }
            });
            
            await measurement.save(); // Збереження вимірювання в базі даних
            results.measurements_created++; // Лічильник створених вимірювань
          }
        }
        
        // Оновлення часу останнього вимірювання
        await station.updateLastMeasurement();
        
      } catch (error) { // Обробка помилок для кожної станції
        console.error(`❌ Error processing station ${stationData.id}:`, error.message); // Логування помилки
        results.errors.push({ // Логування помилок
          station_id: stationData.id, // Ідентифікатор станції
          error: error.message // Повідомлення про помилку
        });
      }
    }
    
    console.log('✅ SaveEcoBot sync completed');
    console.log(`📊 Results:`, results);
    
    res.json({ // Відповідь з результатами синхронізації
      success: true,
      message: 'SaveEcoBot data synchronized successfully',
      results
    });
    
  } catch (error) { // Глобальна обробка помилок
    console.error('❌ SaveEcoBot sync failed:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to sync with SaveEcoBot: ${error.message}`
    });
  }
});

// GET /api/saveecobot/status - Статус синхронізації
router.get('/status', async (req, res) => { // Тимчасовий ендпоінт для перевірки статусу останньої синхронізації
  try {
    const totalStations = await Station.countDocuments(); // Загальна кількість станцій
    const activeStations = await Station.countDocuments({ status: 'active' }); // Кількість активних станцій
    const totalMeasurements = await Measurement.countDocuments(); // Загальна кількість вимірювань
    
    const lastMeasurement = await Measurement.findOne() // Останнє вимірювання
      .sort({ measurement_time: -1 }) // Сортування за часом вимірювання у спадному порядку
      .select('measurement_time metadata.source'); // Вибір полів measurement_time та metadata.source
    
    const stationsWithRecentData = await Measurement.aggregate([ // Кількість станцій з даними за останні 24 години
      {
        $match: { // Фільтрація вимірювань за останні 24 години
          measurement_time: { 
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Останні 24 години
          }
        }
      },
      {
        $group: { // Групування за station_id
          _id: '$station_id'
        }
      },
      {
        $count: 'stations_with_recent_data' // Підрахунок кількості унікальних станцій
      }
    ]);
    
    res.json({ // Відповідь з інформацією про статус
      success: true,
      data: {
        total_stations: totalStations,
        active_stations: activeStations,
        total_measurements: totalMeasurements,
        last_measurement_time: lastMeasurement?.measurement_time,
        last_measurement_source: lastMeasurement?.metadata?.source,
        stations_with_recent_data: stationsWithRecentData[0]?.stations_with_recent_data || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

