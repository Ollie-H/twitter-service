/**
 * main.js
 * @author Ollie Husband
 */

import OAuth from 'oauth-request';
import url from 'url';
import {MongoClient} from 'mongodb';
import {Server as WebSocketServer} from 'ws';
import {KEYS} from './config/keys';

const mongoUrl = 'mongodb://localhost:27017/tweets';
const defaultOptions = {
  url: 'https://api.twitter.com/1.1/search/tweets.json',
  json: true,
  qs: {
    count: 15,
    query: encodeURIComponent(`test`)
  }
}

export class TwitterService {

  constructor(server, options = {}) {
    this.wss = new WebSocketServer({ server: server });
    this.options = Object.assign(defaultOptions, options);
    this.setupDB();
    this.setupPolling();
    this.setupEvents();
  }

  setupDB() {
    MongoClient.connect(mongoUrl), (err, db) => {
      console.log('Mongodb running');
      let collection = db.get('userlist');
      this.addTweets = (tweets, callback) => {
        return collection.insertMany(tweets, callback);
      }
    };
  }

  setupPolling() {

    const options = this.options;

    const oAuth = new OAuth({
      consumer: {
        public: KEYS.twitter.CONSUMER_KEY,
        secret: KEYS.twitter.CONSUMER_SECRET
      }
    });

    oAuth.setToken({
      public: KEYS.twitter.ACCESS_TOKEN,
      secret: KEYS.twitter.ACCESS_TOKEN_SECRET
    });

    setInterval(() => {

      console.log(Object.assign({}, {...options}));
      oAuth.get(Object.assign({}, {...options}), (err, res, data) => {
        // console.log(data);
        if (!data.statuses || data.statuses.length === 0) {
          return;
        }
        let tweets = data.statuses.forEach((tweet) => {
          this.syncTweet({
            id: tweet.id,
            text: tweet.text
          });
        });
      });

    }, 15000);


  } 

  setupEvents() {
    this.wss.on('connection', (ws) => {
      console.log('Sockets connection established');
      this.syncTweet = (tweet) => {
        console.log(tweet);
        ws.send(tweet.text);
      }
    });
    
  }
}