
import mongoose from 'mongoose';

const StationSchema = new mongoose.Schema({
  // Ідентифікатор станції (з SaveEcoBot)
  station_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  
  // Назва міста
  city_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Назва станції
  station_name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Локальна назва
  local_name: {
    type: String,
    trim: true
  },
  
  // Часовий пояс
  timezone: {
    type: String,
    default: '+0300'
  },
  
  // Геолокація
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 &&  // longitude
                 coords[1] >= -90 && coords[1] <= 90;      // latitude
        },
        message: 'Invalid coordinates format'
      }
    }
  },
  
  // Платформа (напр. SaveDnipro)
  platform_name: {
    type: String,
    default: 'SaveEcoBot'
  },
  
  // Статус станції
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  
  // Параметри, які вимірює станція
  measured_parameters: [{
    type: String,
    enum: ['PM2.5', 'PM10', 'Temperature', 'Humidity', 'Pressure', 'Air Quality Index', 'NO2', 'SO2', 'CO', 'O3']
  }],
  
  // Метадані
  metadata: {
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    data_source: { type: String, default: 'SaveEcoBot' },
    last_measurement: Date
  }
}, {
  timestamps: true
});

// Індекси для оптимізації
StationSchema.index({ location: '2dsphere' }); // Геопросторовий індекс
StationSchema.index({ city_name: 1, status: 1 });
StationSchema.index({ 'metadata.last_measurement': -1 });

// Методи схеми
StationSchema.methods.updateLastMeasurement = function() {
  this.metadata.last_measurement = new Date();
  this.metadata.updated_at = new Date();
  return this.save();
};

StationSchema.statics.findNearby = function(longitude, latitude, maxDistance = 10000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    },
    status: 'active'
  });
};

export default mongoose.model('Station', StationSchema);