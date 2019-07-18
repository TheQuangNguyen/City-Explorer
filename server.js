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


function Location(query, res) { 
  this.search_query = query;
  this.formatted_query = res.results[0].formatted_address;
  this.latitude = res.results[0].geometry.location.lat;
  this.longitude = res.results[0].geometry.location.lng
}

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

function searchToLatLong(req, res) { 
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  let location;
  return superagent.get(geocodeUrl)
    .then(data => { 
      location = new Location(req.query.data, JSON.parse(data.text));
      res.send(location);
    })
    .catch(err => { 
      res.send(err);
    })
}

function getWeather(req, res) { 
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

app.get('/location', searchToLatLong);
app.get('/weather', getWeather);
app.get('/movies', getMovies);
app.get('/yelp', getYelp);
app.get('/trails', getHiking);
app.get('/events', getEvents);

app.listen(PORT, () => console.log(`App is up on ${PORT}`));
