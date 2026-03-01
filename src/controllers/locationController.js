const db = require('../config/database');
const config = require('../config');
const { INDIA_LOCATIONS } = require('../data/indiaLocations');

const GOOGLE_API_KEY = config.google?.mapsApiKey || process.env.GOOGLE_MAPS_API_KEY || '';

const ensureIndiaLocationsSeeded = async () => {
  const [stateCountRow, cityCountRow] = await Promise.all([
    db('states').count('id as count').first(),
    db('cities').count('id as count').first(),
  ]);

  const stateCount = parseInt(stateCountRow?.count || 0, 10);
  const cityCount = parseInt(cityCountRow?.count || 0, 10);

  if (stateCount >= INDIA_LOCATIONS.length && cityCount >= 120) {
    return;
  }

  await db.transaction(async (trx) => {
    await trx('states')
      .insert(INDIA_LOCATIONS.map((state) => ({ name: state.name, code: state.code, is_active: true })))
      .onConflict('code')
      .ignore();

    const states = await trx('states').select('id', 'code');
    const stateIdByCode = states.reduce((acc, state) => {
      acc[state.code] = state.id;
      return acc;
    }, {});

    const cityRows = INDIA_LOCATIONS.flatMap((state) => {
      const stateId = stateIdByCode[state.code];
      if (!stateId) return [];
      return state.cities.map((cityName) => ({
        name: cityName,
        state_id: stateId,
        is_active: true,
      }));
    });

    if (cityRows.length > 0) {
      await trx('cities').insert(cityRows).onConflict(['name', 'state_id']).ignore();
    }
  });
};

// GET /api/locations/states
exports.getStates = async (req, res, next) => {
  try {
    await ensureIndiaLocationsSeeded();
    const states = await db('states').where({ is_active: true }).orderBy('name');
    res.json({ states });
  } catch (error) {
    next(error);
  }
};

// GET /api/locations/cities?state_id=
exports.getCities = async (req, res, next) => {
  try {
    await ensureIndiaLocationsSeeded();
    let query = db('cities')
      .select('cities.*', 'states.name as state_name')
      .leftJoin('states', 'cities.state_id', 'states.id')
      .where('cities.is_active', true);

    if (req.query.state_id) {
      query = query.where('cities.state_id', req.query.state_id);
    }

    const cities = await query.orderBy('cities.name');
    res.json({ cities });
  } catch (error) {
    next(error);
  }
};

// POST /api/locations/states (Admin)
exports.createState = async (req, res, next) => {
  try {
    const { name, code } = req.body;
    const [state] = await db('states').insert({ name, code }).returning('*');
    res.status(201).json({ state });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'State already exists' });
    }
    next(error);
  }
};

// POST /api/locations/cities (Admin)
exports.createCity = async (req, res, next) => {
  try {
    const { name, state_id, latitude, longitude } = req.body;
    const [city] = await db('cities').insert({ name, state_id, latitude, longitude }).returning('*');
    res.status(201).json({ city });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'City already exists in this state' });
    }
    next(error);
  }
};

// PUT /api/locations/states/:id (Admin)
exports.updateState = async (req, res, next) => {
  try {
    const [state] = await db('states')
      .where({ id: req.params.id })
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');
    if (!state) return res.status(404).json({ error: 'State not found' });
    res.json({ state });
  } catch (error) {
    next(error);
  }
};

// PUT /api/locations/cities/:id (Admin)
exports.updateCity = async (req, res, next) => {
  try {
    const [city] = await db('cities')
      .where({ id: req.params.id })
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');
    if (!city) return res.status(404).json({ error: 'City not found' });
    res.json({ city });
  } catch (error) {
    next(error);
  }
};

// GET /api/locations/places/autocomplete?input=
exports.placesAutocomplete = async (req, res, next) => {
  try {
    const { input } = req.query;
    if (!input) return res.json({ predictions: [] });
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_maps_api_key') {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ predictions: data.predictions || [] });
  } catch (error) {
    next(error);
  }
};

// GET /api/locations/places/details?place_id=
exports.placeDetails = async (req, res, next) => {
  try {
    const { place_id } = req.query;
    if (!place_id) return res.status(400).json({ error: 'place_id required' });
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_maps_api_key') {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=formatted_address,geometry,name&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const result = data.result || {};
    res.json({
      address: result.formatted_address || result.name || '',
      lat: result.geometry?.location?.lat || 0,
      lng: result.geometry?.location?.lng || 0,
      name: result.name || '',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/locations/distance?origins=lat,lng&destinations=lat,lng
exports.calculateDistance = async (req, res, next) => {
  try {
    const { origins, destinations } = req.query;
    if (!origins || !destinations) return res.status(400).json({ error: 'origins and destinations required' });
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_maps_api_key') {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const element = data.rows?.[0]?.elements?.[0];
    if (element?.status === 'OK') {
      res.json({
        distance_km: Math.round((element.distance.value / 1000) * 10) / 10,
        distance_text: element.distance.text,
        duration_text: element.duration.text,
        duration_seconds: element.duration.value,
      });
    } else {
      res.json({ distance_km: 0, distance_text: 'N/A', duration_text: 'N/A', duration_seconds: 0 });
    }
  } catch (error) {
    next(error);
  }
};
