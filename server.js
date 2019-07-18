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
  console.log('got data from API');
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  let location;
  return superagent.get(geocodeUrl)
    .then(data => {
      location = new Location(req.query.data, JSON.parse(data.text));
      console.log(location)
      location.save()
        .then(result => {
          location.id = result.rows[0].id;
          return location;
        })
      res.send(location);
    })
    .catch(err => {
      errHandler(err, res);
    })
}

Location.prototype.save = function() {
  const SQL = `
    INSERT INTO locations 
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
      RETURNING id`;
  let values = Object.values(this);
  console.log('client.query return ', client.query(SQL, values));
  return client.query(SQL, values);
}

function getLocation(req, res) {

  const SQL = `SELECT * FROM locations WHERE search_query='${req.query.data}'`;

  return client.query(SQL)
    .then( result => {
      if (result.rowCount > 0) {
        console.log('this is how result look like ', result);
        console.log('Got data from SQL');
        res.send(result.rows[0]);
      }
      else {
        Location.fetchLocation(req, res);
      }
    })
    .catch(err => console.log(err));
}

//////////////////// Location Handling is Above /////////////////////////////

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toDateString();
}

function Event(place) {
  this.link = place.url;
  this.name = place.name.text;
  this.event_date = new Date(place.start.local).toDateString();
  this.summary = place.summary;
}

function Movie(movie) {
  this.title = movie.title;
  this.overview = movie.overview;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  this.image_url = `"https://image.tmdb.org/t/p/w200_and_h300_bestv2${movie.poster_path}`;
  this.popularity = movie.popularity;
  this.released_on = movie.release_date;
}

function Restaurant(place) {
  this.name = place.name;
  this.image_url = place.image_url;
  this.price = place.price;
  this.rating = place.rating;
  this.url = place.url;
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
}

function errHandler(err, res) {
  console.error('error: ', err);
  if (res) { res.status(500).send('Sorry, something is wrong!');}
}

function getWeather(req, res) {
  console.log(req.originalUrl.split('?')[0]);
  const darkskyUrl =  `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

  return superagent.get(darkskyUrl)
    .then(data => {
      const weatherEntries = data.body.daily.data.map(day => {
        return new Weather(day)
      })
      res.send(weatherEntries);
    })
    .catch(err => {
      res.send(err);
    })
}

function getMovies(req, res) {
  console.log(req.originalUrl.split('?')[0]);
  const moviedbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIEDB_API_KEY}&query=${req.search_query}`;

  return superagent.get(moviedbUrl)
    .then(data => {
      const movies = [];
      for (let i = 0; i < 20; i++) {
        movies.push(new Movie(data.body.results[i]));
      }
      res.send(movies);
    })
    .catch(err => {
      res.send(err);
    })
}

function getYelp(req, res) {
  console.log(req.originalUrl.split('?')[0]);
  const yelpUrl = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${req.query.data.latitude}&longitude=${req.query.data.longitude}`;

  return superagent.get(yelpUrl).set('AUTHORIZATION', `BEARER ${process.env.YELP_API_KEY}`)
    .then(data => {
      const restaurants = [];
      for (let i = 0; i < 20; i++) {
        restaurants.push(new Restaurant(data.body.businesses[i]));
      }
      res.send(restaurants);
    })
    .catch(err => {
      res.send(err);
    })
}

function getHiking(req, res) {
  console.log(req.originalUrl.split('?')[0]);
  const hikingUrl = `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}&lon=${req.query.data.longitude}&key=${process.env.HIKING_API_KEY}`;

  return superagent.get(hikingUrl)
    .then(data => {
      const hikingTrails = [];
      for (let i = 0; i < 10; i++) {
        hikingTrails.push(new Trails(data.body.trails[i]));
      }
      res.send(hikingTrails);
    })
    .catch(err => {
      res.send(err);
    })
}

function getEvents(req, res) {
  console.log(req.originalUrl.split('?')[0].slice(1));
  const eventbriteUrl = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${req.query.data.longitude}&location.latitude=${req.query.data.latitude}&token=${process.env.EVENTBRITE_API_KEY}`;

  return superagent.get(eventbriteUrl)
    .then(data => {
      const eventsNearby = [];
      for (let i = 0; i < 20; i++) {
        eventsNearby.push(new Event(data.body.events[i]));
      }
      res.send(eventsNearby);
    })
    .catch(err => {
      res.send(err);
    })
}


//////////////////////////////////////////////////////////////////


function getInfo(req, res) {
  const source = req.originalUrl.split('?')[0].slice(1);


  const SQL = `SELECT * FROM ${source} WHERE location_id=${req.query.data.id}`;

  return client.query(SQL)
    .then( result => {
      if (result.rowCount > 0) {
        // console.log('this is how result look like ', result);
        console.log('Got data from SQL');
        res.send(result.rows[0]);
      }
      else {
        fetchInfo(req, res);
      }
    })
    .catch(err => console.log(err));
}


function fetchInfo(req, res, source) {
  const sourceUrl = infoObject(req, source);
  let info;
  return superagent.get(sourceUrl)
    .then(data => {
      console.log('got data from API');
      const newInfo = createNewInfoObject(source, data);
      save(newInfo)
        .then(result => {
          newInfo.id = result.rows[0].id;
          return newInfo;
        })
      res.send(newInfo);
    })
    .catch(err => {
      errHandler(err, res);
    })
}

function save(object) {
  let keys = Object.keys(object);
  let VALUES = keys.map((element, index) => `$${index + 1}`).join(',');
  const SQL = `
    INSERT INTO locations 
      (${keys.join(',')})
      VALUES(${VALUES})
      RETURNING id`;
  let values = Object.values(object);
  console.log('client.query return ', client.query(SQL, values));
  return client.query(SQL, values)
}

function createNewInfoObject(source, data) {
  switch (source) {
  case 'weather':
    return data.body.daily.data.map(day => {
      return new Weather(day)
    });

  case 'movies':
    const movies = [];
    for (let i = 0; i < 20; i++) {
      movies.push(new Movie(data.body.results[i]));
    }
    return movies;

  case 'yelp':
    const restaurants = [];
    for (let i = 0; i < 20; i++) {
      restaurants.push(new Restaurant(data.body.businesses[i]));
    }
    return restaurants;

  case 'trails':
    const hikingTrails = [];
    for (let i = 0; i < 10; i++) {
      hikingTrails.push(new Trails(data.body.trails[i]));
    }
    return hikingTrails;

  case 'events':
    const eventsNearby = [];
    for (let i = 0; i < 20; i++) {
      eventsNearby.push(new Event(data.body.events[i]));
    }
    return eventsNearby;
  }
}


const infoObject = function(req, source) {
  switch (source) {
  case 'weather':
    return `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

  case 'movies':
    return `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIEDB_API_KEY}&query=${req.search_query}`;

  case 'yelp':
    return `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${req.query.data.latitude}&longitude=${req.query.data.longitude}`;

  case 'trails':
    return `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}&lon=${req.query.data.longitude}&key=${process.env.HIKING_API_KEY}`;

  case 'events':
    return `https://www.eventbriteapi.com/v3/events/search?location.longitude=${req.query.data.longitude}&location.latitude=${req.query.data.latitude}&token=${process.env.EVENTBRITE_API_KEY}`;
  }
}

app.get('/location', getLocation);
app.get('/weather', getInfo);
app.get('/movies', getInfo);
// app.get('/yelp', getInfo);
app.get('/trails', getInfo);
app.get('/events', getInfo);

app.listen(PORT, () => console.log(`App is up on ${PORT}`));
