'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.static('front-end'));

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));


//////////////////// Location Stuff Is Below ////////////////////////////

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.results[0].formatted_address;
  this.latitude = res.results[0].geometry.location.lat;
  this.longitude = res.results[0].geometry.location.lng
}

Location.fetchLocation = (req, res) => {
  console.log('got data from API from location');
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  let location;
  return superagent.get(geocodeUrl)
    .then(data => {
      location = new Location(req.query.data, JSON.parse(data.text));
      location.save()
        .then(result => {
          location.id = result.rows[0].id;
          return location;
        })
        .then(location => {
          console.log('this is location ', location);
          res.send(location);
        })
    })
    .catch(err => {
      console.log('fetchLocation() ', err);
    })
}

Location.prototype.save = function() {
  const SQL = `
    INSERT INTO locations 
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
      RETURNING id;`;
  let values = Object.values(this);
  return client.query(SQL, values);
}

function getLocation(req, res) {

  const SQL = `SELECT * FROM locations WHERE search_query='${req.query.data}';`;

  return client.query(SQL)
    .then( result => {
      if (result.rowCount > 0) {
        // console.log('this is how result look like ', result);
        console.log('Got data from SQL from location');
        res.send(result.rows[0]);
      }
      else {
        Location.fetchLocation(req, res);
      }
    })
    .catch(err => console.log('getLocation', err));
}

//////////////////// Location Handling is Above /////////////////////////////

///////////////////// Constructor Functions Below //////////////////////////// 

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toDateString();
  this.created_time = new Date().getTime();
}

function Event(place) {
  this.link = place.url;
  this.name = place.name.text;
  this.event_date = new Date(place.start.local).toDateString();
  this.summary = place.summary;
  this.created_time = new Date().getTime();
}

function Movie(film) {
  this.title = film.title;
  this.overview = film.overview;
  this.average_votes = film.vote_average;
  this.total_votes = film.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w500${film.poster_path}`;
  this.popularity = film.popularity;
  this.released_on = film.release_date;
  this.created_time = new Date().getTime();
}

function Restaurant(place) {
  this.name = place.name;
  this.image_url = place.image_url;
  this.price = place.price;
  this.rating = place.rating;
  this.url = place.url;
  this.created_time = new Date().getTime();
}

function Trails(place) {
  this.name = place.name;
  this.location = place.location;
  this.stars = place.stars;
  this.star_votes = place.starVotes;
  this.summary = place.summary;
  this.trail_url = place.url;
  this.conditions = place.conditionDetails;
  this.condition_date = place.conditionDate.split(' ')[0];
  this.condition_time = place.conditionDate.split(' ')[1];
  this.created_time = new Date().getTime();
}

//////////////////////////Constructor Function Above /////////////////////////////////


////////////////////////// Other APIS below ///////////////////////////////////////////


function getInfo(req, res) {
  const source = req.originalUrl.split('?')[0].slice(1);

  const SQL = `SELECT * FROM ${source} WHERE location_id=${req.query.data.id};`;
  // console.log('SQL ', SQL);

  return client.query(SQL)
    .then( result => {
      if (result.rowCount > 0) {
        console.log('Got data from SQL');
        // console.log(result.rows);
        // res.send(result.rows);
        cacheInvalidation(result, source, req, res);
      }
      else {
        fetchInfo(req, res, source);
      }
    })
    .catch(err => console.log('getInfo()', err));
}

function fetchInfo(req, res, source) {
  const sourceUrl = getUrl(req, source);

  return superagent.get(sourceUrl).set('Authorization', `Bearer ${authorizationHeader(source)}`)
    .then(data => {
      console.log('got data from API');
      const newInfo = createNewInfoObject(source, data, req.query.data.id);
      // save(newInfo, req.query.data.id);
      res.send(newInfo);
    })
    .catch(err => {
      console.log('fetchInfo() ', err);
    })
}

function save(object, id, source) {
  let keys = Object.keys(object);
  let VALUES = keys.map((element, index) => `$${index + 1}`).join(',');
  // console.log('VALUES', VALUES);
  const SQL = `
    INSERT INTO ${source} 
      (${keys.join(',')},location_id)
      VALUES(${VALUES},$${keys.length+1});`;   
  let values = Object.values(object);
  values.push(id);
  // console.log('values', values);
  client.query(SQL, values);
}

function createNewInfoObject(source, data, id) {
  switch (source) {
  case 'weather':
    return data.body.daily.data.map(day => {
      const newObject = new Weather(day);
      save(newObject, id, source);
      return newObject;
    });

  case 'movies':
    const movies = [];
    for (let i = 0; i < 20; i++) {
      movies.push(new Movie(data.body.results[i]));
      save(movies[i], id, source);
    }
    return movies;

  case 'yelp':
    const restaurants = [];
    for (let i = 0; i < 20; i++) {
      restaurants.push(new Restaurant(data.body.businesses[i]));
      save(restaurants[i], id, source);
    }
    return restaurants;

  case 'trails':
    const hikingTrails = [];
    for (let i = 0; i < 10; i++) {
      hikingTrails.push(new Trails(data.body.trails[i]));
      save(hikingTrails[i], id, source);
    }
    return hikingTrails;

  case 'events':
    const eventsNearby = [];
    for (let i = 0; i < 20; i++) {
      eventsNearby.push(new Event(data.body.events[i]));
      save(eventsNearby[i], id, source);
    }
    return eventsNearby;
  }
}

const getUrl = function(req, source) {
  switch (source) {
  case 'weather':
    return `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

  case 'movies':
    return `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIEDB_API_KEY}&query=${req.query.data.search_query}`;

  case 'yelp':
    return `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${req.query.data.latitude}&longitude=${req.query.data.longitude}`;

  case 'trails':
    return `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}&lon=${req.query.data.longitude}&key=${process.env.HIKING_API_KEY}`;

  case 'events':
    return `https://www.eventbriteapi.com/v3/events/search?location.longitude=${req.query.data.longitude}&location.latitude=${req.query.data.latitude}`
  }
}

function authorizationHeader(source) { 
  if (source === 'yelp') { 
    return `${process.env.YELP_API_KEY}`;
  } else if (source === 'events') { 
    return `${process.env.EVENTBRITE_API_KEY}`;
  }
}

function cacheInvalidation(result, source, req, res) { 
  console.log('source is ', source);
  if (source === 'weather' || source === 'movies' || source === 'events') {
    const expiredTimeDay = 10000;
    if ((new Date().getTime() - expiredTimeDay) > result.rows[0].created_time) { 
      deleteInvalidData(source, req);
      fetchInfo(req, res, source);
    } else { 
      res.send(result.rows);
    }
  } else if (source === 'yelp' || source === 'trails') {
    const expiredTimeWeek = 60000;
    if ((new Date().getTime() - expiredTimeWeek) > result.rows[0].created_time) { 
      deleteInvalidData(source, req);
      fetchInfo(req, res, source);
    } else { 
      res.send(result.rows);
    }
  } 
}

function deleteInvalidData(source, req) { 
  const SQL = `DELETE FROM ${source} WHERE location_id=${req.query.data.id};`
  client.query(SQL);
}

/////////////////////////////////// Other API above ///////////////////////////////////

app.get('/location', getLocation);
app.get('/weather', getInfo);
app.get('/movies', getInfo);
app.get('/yelp', getInfo);
app.get('/trails', getInfo);
app.get('/events', getInfo);

app.listen(PORT, () => console.log(`App is up on ${PORT}`));
