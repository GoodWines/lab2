import express from 'express';
import AirQuality from '../models/AirQuality.js';
import Station from '../models/Stations.js';

const router = express.Router();

// ==============================
// GET /api/airquality
// Отримати всі вимірювання з фільтрацією
// ==============================
router.get('/', async (req, res) => {
  try {
    const { station_id, start_date, end_date, pollutant, page = 1, limit = 100 } = req.query;

    const filter = {};
    if (station_id) filter.station_id = station_id;
    if (start_date || end_date) {
      filter.measurement_time = {};
      if (start_date) filter.measurement_time.$gte = new Date(start_date);
      if (end_date) filter.measurement_time.$lte = new Date(end_date);
    }
    if (pollutant) filter['pollutants.pollutant'] = pollutant;

    const data = await AirQuality.find(filter)
      .sort({ measurement_time: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await AirQuality.countDocuments(filter);

    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================
// GET /api/airquality/latest
// Отримати останні вимірювання по всіх станціях
// ==============================
router.get('/latest', async (req, res) => {
  try {
    const latestMeasurements = await AirQuality.aggregate([
      { $sort: { measurement_time: -1 } },
      { $group: { _id: '$station_id', latest_measurement: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latest_measurement' } }
    ]);

    res.json({ success: true, data: latestMeasurements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================
// POST /api/airquality
// Додати нове вимірювання
// ==============================
router.post('/', async (req, res) => {
  try {
    const { station_id } = req.body;

    // Перевірка існування станції
    const station = await Station.findOne({ station_id });
    if (!station) return res.status(404).json({ success: false, error: 'Station not found' });

    const measurement = new AirQuality(req.body);
    await measurement.save();

    const exceedances = measurement.checkThresholds();

    res.status(201).json({ success: true, data: measurement, exceedances: exceedances.length ? exceedances : undefined });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==============================
// PUT /api/airquality/:id
// Оновити вимірювання за ID
// ==============================
router.put('/:id', async (req, res) => {
  try {
    const updated = await AirQuality.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Measurement not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==============================
// DELETE /api/airquality/:id
// Видалити вимірювання за ID
// ==============================
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await AirQuality.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Measurement not found' });
    res.json({ success: true, data: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;