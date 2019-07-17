'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.static('public'));

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

function Movie() {
  this.title
  this.overview
  this.average_votes
  this.total_votes
  this.image_url
  this.popularity
  this.released_on
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
  // const moviedbUrl = ``
}

function getYelp(req, res) { 
  const darkskyUrl =  `https://api.yelp.com/v3/businesses/search?location`;
}

function getHiking(req, res) { 
  
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
