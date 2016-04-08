import http from 'http';
import express from 'express';
import path from 'path';
import {TwitterService} from '../src/twitterService';

const app = express();
const port = process.env.PORT || 5000;

app.use('/', (req, res) => {
  res.status(200).sendFile(path.join(__dirname + '/index.html'));
});

const server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

const twitterService = new TwitterService(server, {
  url: 'https://api.twitter.com/1.1/search/tweets.json',
  method: 'GET',
  json: true,
  qs: {
    count: 1,
    q: encodeURIComponent('"hillary clinton" OR clinton OR "bernie Sanders"' +
      ' OR sanders OR OR "ted cruz" OR cruz OR "john kasich" OR kasich OR "donald trump" OR trump')
  }
});