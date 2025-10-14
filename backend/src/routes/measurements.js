
import express from 'express';
import Measurement from '../models/Measurement.js';
import Station from '../models/Stations.js';
import { validateMeasurement, validateSaveEcoBotData } from '../middleware/validation.js';

const router = express.Router();

// GET /api/measurements - Отримати вимірювання
router.get('/', async (req, res) => {
  try {
    const {
      station_id,
      start_date,
      end_date,
      pollutant,
      page = 1,
      limit = 100
    } = req.query;
    
    // Побудова фільтра
    const filter = {};
    if (station_id) filter.station_id = station_id;
    if (start_date || end_date) {
      filter.measurement_time = {};
      if (start_date) filter.measurement_time.$gte = new Date(start_date);
      if (end_date) filter.measurement_time.$lte = new Date(end_date);
    }
    if (pollutant) filter['pollutants.pollutant'] = pollutant;
    
    const measurements = await Measurement.find(filter)
      .sort({ measurement_time: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      // .populate('station_id', 'station_name city_name');
    
    const total = await Measurement.countDocuments(filter);
    
    res.json({
      success: true,
      data: measurements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/measurements/latest - Останні вимірювання по всіх станціях
router.get('/latest', async (req, res) => {
  try {
    const latestMeasurements = await Measurement.aggregate([
      {
        $sort: { measurement_time: -1 }
      },
      {
        $group: {
          _id: '$station_id',
          latest_measurement: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latest_measurement' }
      }
    ]);
    
    res.json({
      success: true,
      data: latestMeasurements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/measurements - Створити нове вимірювання
router.post('/', validateMeasurement, async (req, res) => {
  try {
    // Перевірка існування станції
    const station = await Station.findOne({ station_id: req.validatedData.station_id });
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }
    
    const measurement = new Measurement(req.validatedData);
    await measurement.save();
    
    // Оновлення часу останнього вимірювання на станції
    await station.updateLastMeasurement();
    
    // Перевірка перевищень
    const exceedances = measurement.checkThresholds();
    
    res.status(201).json({
      success: true,
      data: measurement,
      exceedances: exceedances.length > 0 ? exceedances : undefined
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/measurements/import/saveecobot - Імпорт даних SaveEcoBot
router.post('/import/saveecobot', validateSaveEcoBotData, async (req, res) => {
  try {
    const saveEcoBotData = Array.isArray(req.body) ? req.body : [req.body];
    const results = {
      stations_created: 0,
      stations_updated: 0,
      measurements_created: 0,
      errors: []
    };
    
    for (const stationData of saveEcoBotData) {
      try {
        // Перетворення SaveEcoBot формату в наш формат
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
        
        // Створення або оновлення станції
        let station = await Station.findOne({ station_id: stationInfo.station_id });
        if (!station) {
          station = new Station(stationInfo);
          await station.save();
          results.stations_created++;
        } else {
          await Station.findOneAndUpdate(
            { station_id: stationInfo.station_id },
            stationInfo,
            { new: true }
          );
          results.stations_updated++;
        }
        
        // Обробка вимірювань
        for (const pollutantData of stationData.pollutants) {
          if (pollutantData.time && pollutantData.value !== null) {
            const measurementTime = new Date(pollutantData.time);
            
            // Перевірка чи існує вже таке вимірювання
            const existingMeasurement = await Measurement.findOne({
              station_id: stationData.id,
              measurement_time: measurementTime
            });
            
            if (!existingMeasurement) {
              const measurement = new Measurement({
                station_id: stationData.id,
                measurement_time: measurementTime,
                pollutants: [{
                  pollutant: pollutantData.pol,
                  value: pollutantData.value,
                  unit: pollutantData.unit,
                  averaging_period: pollutantData.averaging
                }],
                metadata: {
                  source: 'SaveEcoBot',
                  original_data: pollutantData
                }
              });
              
              await measurement.save();
              results.measurements_created++;
            }
          }
        }
        
        // Оновлення часу останнього вимірювання
        await station.updateLastMeasurement();
        
      } catch (error) {
        results.errors.push({
          station_id: stationData.id,
          error: error.message
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'SaveEcoBot data imported successfully',
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/measurements/statistics/:station_id - Статистика по станції
router.get('/statistics/:station_id', async (req, res) => {
  try {
    const { station_id } = req.params;
    const { start_date, end_date, pollutant } = req.query;
    
    if (!pollutant) {
      return res.status(400).json({
        success: false,
        error: 'start_date, end_date, and pollutant are required'
      });
    }
    
    const statistics = await Measurement.getStatistics(
      station_id, start_date, end_date, pollutant
    );
    
    res.json({
      success: true,
      data: statistics[0] || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;