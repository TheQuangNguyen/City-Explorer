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
  this.time = new Date(day.time * 1000).toDateString;
}

function searchToLatLong(req, res) { 
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.data}&key=${process.env.GEOCODE_API_KEY}`;

  console.log(geocodeUrl);
  return superagent.get(geocodeUrl)
    .then(res => { 
      const location = new Location(req.query.data, JSON.parse(res.text));
      console.log(location);
      res.send(location);
    })
    .catch(err => { 
      res.send(err);
    })
}

function getWeather(req, res) { 
  const darkskyUrl =  `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

  return superagent.get(darkskyUrl)
    .then(res => {
      const weatherEntries = res.body.daily.data.map(day => {
        return new Weather(day)
      })

      req.send(weatherEntries);
    })
    .catch(err => {
      res.send(err);
    })
}

function getMovies(req, res) {
  const moviedbUrl = ``
}

function getYelp(req, res) { 

}

function getHiking(req, res) { 

}

function getEvents(req, res) { 
  
}

app.get('/location', searchToLatLong);
app.get('/weather', getWeather);
app.get('./movies', getMovies);
app.get('./yelp', getYelp);
app.get('./trails', getHiking);
app.get('./events', getEvents);

app.listen(PORT, () => console.log(`App is up on ${PORT}`));
