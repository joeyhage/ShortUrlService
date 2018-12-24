'use strict';

const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');

const app = express();
const Schema = mongoose.Schema;

mongoose.connect(
  process.env.MONGO_URI,
  {useNewUrlParser: true}
).then(() => {
  console.log('MongoDB Connected');
}).catch(err => {
  console.error(err);
});

const ShortUrl = mongoose.model('ShortUrl', new Schema({
  original_url: {type: String, required: true},
  short_url: {type: Number, required: true}
}));

app.use(cors());
app.use(express.urlencoded({extended: true}));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

app.post('/api/shorturl/new', function (req, res) {
  if (!req.body || !req.body.url) {
    return res.json({error: 'Unable to parse URL from body.'});
  }
  const url = req.body.url.toLowerCase();
  dns.lookup(url.replace(/https?:\/\//gi, ''), err => {
    if (err) {
      console.log(err);
      return res.json({error: 'Invalid URL'});
    }
    lookupUrl(url, (err, data) => {
      if (err) {
        throw new Error(err);
      }
      if (data) {
        return res.json(formatShortUrlResponse(data));
      } else {
        ShortUrl.findOne().sort({short_url: -1}).exec((err, data) => {
          if (err) {
            throw new Error(err);
          }
          const shortUrl = new ShortUrl({original_url: url, short_url: (data && data.short_url) ? parseInt(data.short_url) + 1 : 1});
          shortUrl.save((err, data) => {
            if (err) {
              throw new Error(err);
            }
            return res.json(formatShortUrlResponse(data));
          });
        });
      }
    });
  });
});

app.get('/api/shorturl/:shorturl', function (req, res) {
  const url = req.params.shorturl;
  ShortUrl.findOne().where({short_url: parseInt(url)}).exec((err, data) => {
    if (err) {
      throw new Error(err);
    }
    if (data && data.original_url) {
      res.redirect(data.original_url);
    } else {
      res.json({error: 'No URL found for short URL: ' + url});
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.json({error: 'Unexpected error'});
});

app.listen(process.env.PORT || 3000, function () {
  console.log('Node.js listening ...');
});

const lookupUrl = (url, done) => {
  ShortUrl.findOne().where({original_url: url}).exec(done);
};

const formatShortUrlResponse = ({original_url, short_url}) => ({original_url, short_url});