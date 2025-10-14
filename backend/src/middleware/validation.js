
import Joi from 'joi';

// Валідація створення станції
export const validateStation = (req, res, next) => {
  const schema = Joi.object({
    station_id: Joi.string().required().trim(),
    city_name: Joi.string().required().trim(),
    station_name: Joi.string().required().trim(),
    local_name: Joi.string().optional().trim(),
    timezone: Joi.string().optional(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    platform_name: Joi.string().optional(),
    measured_parameters: Joi.array().items(
      Joi.string().valid('PM2.5', 'PM10', 'Temperature', 'Humidity', 'Pressure', 'Air Quality Index', 'NO2', 'SO2', 'CO', 'O3')
    ).optional()
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }

  req.validatedData = value;
  next();
};

// Валідація створення вимірювання
export const validateMeasurement = (req, res, next) => {
  const pollutantSchema = Joi.object({
    pollutant: Joi.string().valid('PM2.5', 'PM10', 'Temperature', 'Humidity', 'Pressure', 'Air Quality Index', 'NO2', 'SO2', 'CO', 'O3').required(),
    value: Joi.number().required(),
    unit: Joi.string().valid('ug/m3', 'Celcius', '%', 'hPa', 'aqi', 'mg/m3', 'ppm').required(),
    averaging_period: Joi.string().optional(),
    quality_flag: Joi.string().valid('valid', 'invalid', 'estimated', 'preliminary').optional()
  });

  const schema = Joi.object({
    station_id: Joi.string().required(),
    measurement_time: Joi.date().iso().required(),
    pollutants: Joi.array().items(pollutantSchema).min(1).required()
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }

  req.validatedData = value;
  next();
};

// Валідація SaveEcoBot формату
export const validateSaveEcoBotData = (req, res, next) => {
  const schema = Joi.object({
    id: Joi.string().required(),
    cityName: Joi.string().required(),
    stationName: Joi.string().required(),
    localName: Joi.string().allow(''),
    timezone: Joi.string().required(),
    latitude: Joi.string().required(),
    longitude: Joi.string().required(),
    platformName: Joi.string().required(),
    pollutants: Joi.array().items(
      Joi.object({
        pol: Joi.string().required(),
        unit: Joi.string().required(),
        time: Joi.string().required(),
        value: Joi.number().required(),
        averaging: Joi.string().required()
      })
    ).required()
  });

  if (Array.isArray(req.body)) {
    // Валідація масиву станцій
    const errors = [];
    req.body.forEach((station, index) => {
      const { error } = schema.validate(station);
      if (error) {
        errors.push(`Station ${index}: ${error.details.map(d => d.message).join(', ')}`);
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed for SaveEcoBot data',
        details: errors
      });
    }
  } else {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
  }

  next();
};