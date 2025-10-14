import mongoose from 'mongoose'; // Імпорт mongoose для роботи з MongoDB

// Схема для окремого забруднювача
const PollutantSchema = new mongoose.Schema({
  pollutant: {
    type: String,
    required: true,
    enum: ['PM2.5', 'PM10', 'Temperature', 'Humidity', 'Pressure', 'Air Quality Index', 'NO2', 'SO2', 'CO', 'O3']
  },
  value: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'Value must be a valid number'
    }
  },
  unit: {
    type: String,
    required: true,
    enum: ['ug/m3', 'Celcius', '%', 'hPa', 'aqi', 'mg/m3', 'ppm']
  },
  averaging_period: {
    type: String,
    default: '2 minutes',
    enum: ['1 minute', '2 minutes', '5 minutes', '15 minutes', '1 hour', '24 hours']
  },
  quality_flag: {
    type: String,
    enum: ['valid', 'invalid', 'estimated', 'preliminary'],
    default: 'preliminary'
  }
}, { _id: false });

// Схема вимірювання
const AirQualitySchema = new mongoose.Schema({
  station_id: {
    type: String,
    required: true,
    index: true
  },
  measurement_time: {
    type: Date,
    required: true,
    index: true
  },
  pollutants: [PollutantSchema],
  metadata: {
    source: {
      type: String,
      default: 'SaveEcoBot'
    },
    import_time: {
      type: Date,
      default: Date.now
    },
    original_data: mongoose.Schema.Types.Mixed,
    processing_notes: String
  }
}, {
  timestamps: true
});

// Індекси
AirQualitySchema.index({ station_id: 1, measurement_time: -1 });
AirQualitySchema.index({ measurement_time: -1 });
AirQualitySchema.index({ 'pollutants.pollutant': 1, measurement_time: -1 });
AirQualitySchema.index({ station_id: 1, measurement_time: 1 }, { unique: true });

// Методи
AirQualitySchema.methods.checkThresholds = function() {
  const thresholds = {
    'PM2.5': { warning: 25, alert: 35, emergency: 75 },
    'PM10': { warning: 50, alert: 75, emergency: 150 },
    'Air Quality Index': { warning: 50, alert: 100, emergency: 150 }
  };

  const exceedances = [];

  this.pollutants.forEach(pollutant => {
    const threshold = thresholds[pollutant.pollutant];
    if (threshold) {
      let severity = 'normal';
      if (pollutant.value > threshold.emergency) severity = 'emergency';
      else if (pollutant.value > threshold.alert) severity = 'alert';
      else if (pollutant.value > threshold.warning) severity = 'warning';

      if (severity !== 'normal') {
        exceedances.push({
          pollutant: pollutant.pollutant,
          value: pollutant.value,
          threshold: threshold[severity],
          severity,
          ratio: (pollutant.value / threshold[severity]).toFixed(2)
        });
      }
    }
  });

  return exceedances;
};

AirQualitySchema.statics.getLatestByStation = function(stationId) {
  return this.findOne({ station_id: stationId }).sort({ measurement_time: -1 });
};

AirQualitySchema.statics.getStatistics = async function(stationId, startDate, endDate, pollutant) {
  const matchStage = {
    station_id: stationId,
    measurement_time: { $gte: new Date(startDate), $lte: new Date(endDate) },
    'pollutants.pollutant': pollutant
  };

  return await this.aggregate([
    { $match: matchStage },
    { $unwind: '$pollutants' },
    { $match: { 'pollutants.pollutant': pollutant } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avg: { $avg: '$pollutants.value' },
        min: { $min: '$pollutants.value' },
        max: { $max: '$pollutants.value' },
        latest: { $last: '$measurement_time' }
      }
    }
  ]);
};

export default mongoose.model('AirQuality', AirQualitySchema);