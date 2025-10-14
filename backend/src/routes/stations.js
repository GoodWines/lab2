
import express from 'express';
import Station from '../models/Stations.js';
import { validateStation } from '../middleware/validation.js';

const router = express.Router();

// GET /api/stations - Отримати всі станції
router.get('/', async (req, res) => {
  try {
    const { city, status, page = 1, limit = 50 } = req.query;
    
    // Побудова фільтра
    const filter = {};
    if (city) filter.city_name = { $regex: city, $options: 'i' };
    if (status) filter.status = status;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { city_name: 1, station_name: 1 }
    };
    
    const stations = await Station.find(filter)
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
    
    const total = await Station.countDocuments(filter);
    
    res.json({
      success: true,
      data: stations,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stations/:id - Отримати станцію за ID
router.get('/:id', async (req, res) => {
  try {
    const station = await Station.findOne({ station_id: req.params.id });
    
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }
    
    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/stations - Створити нову станцію
router.post('/', validateStation, async (req, res) => {
  try {
    const stationData = {
      ...req.validatedData,
      location: {
        type: 'Point',
        coordinates: [req.validatedData.longitude, req.validatedData.latitude]
      }
    };
    
    const station = new Station(stationData); 
    await station.save();
    
    res.status(201).json({
      success: true,
      data: station
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/stations/:id - Оновити станцію
router.put('/:id', validateStation, async (req, res) => {
  try {
    const updateData = {
      ...req.validatedData,
      location: {
        type: 'Point',
        coordinates: [req.validatedData.longitude, req.validatedData.latitude]
      },
      'metadata.updated_at': new Date()
    };
    
    const station = await Station.findOneAndUpdate(
      { station_id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }
    
    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/stations/:id - Видалити станцію
router.delete('/:id', async (req, res) => {
  try {
    const station = await Station.findOneAndUpdate(
      { station_id: req.params.id },
      { status: 'inactive', 'metadata.updated_at': new Date() },
      { new: true }
    );
    
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Station marked as inactive',
      data: station
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stations/nearby/:longitude/:latitude - Знайти найближчі станції
router.get('/nearby/:longitude/:latitude', async (req, res) => {
  try {
    const { longitude, latitude } = req.params;
    const { maxDistance = 10000 } = req.query;
    
    const stations = await Station.findNearby(
      parseFloat(longitude),
      parseFloat(latitude),
      parseInt(maxDistance)
    );
    
    res.json({
      success: true,
      data: stations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;