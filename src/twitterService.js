/**
 * main.js
 * @author Ollie Husband
 */

import OAuth from 'oauth-request';
import Request from 'request-promise';
import url from 'url';
import {MongoClient} from 'mongodb';
import {Server as WebSocketServer} from 'ws';
import {KEYS} from './config/keys';

const alchameyUrl = `http://gateway-a.watsonplatform.net/calls/text/TextGetTextSentiment?apikey=${KEYS.alchemy.API_KEY}&text=$&outputMode=json`;
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
    this.options = Object.assign(defaultOptions, options);
    this.setupSockets(server);
    this.setupDB();
    this.setupPolling();
  }

  setupSockets(server) {

    this.wss = new WebSocketServer({ server: server });
    this.wss.on('connection', (ws) => {
      console.log('Sockets connection established');
      this.ws = ws;
    });

  }

  setupDB() {

    MongoClient.connect(mongoUrl, (err, db) => {
      console.log('Mongodb running');
      this.db = db.collection('tweets');
    });

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

    this.getTweets(oAuth);

  } 

  getTweets(oAuth, sinceId, timeout = 15000) {
    
    let options = this.options;

    if (sinceId) {
      options.qs.since_id = sinceId;
    }

    setTimeout(() => {

      oAuth.get(Object.assign({}, {...options}), (err, res, data) => {

        if (!data || !data.statuses || data.statuses.length === 0) {
          if (data.errors && data.errors.code === 88) {
            console.log('Rate limite exceded, waiting....');
            this.getTweets(oAuth, sinceId, 1000 * 60);
            return;
          }
          console.log('Tweet error', data);
          this.getTweets(oAuth);
          return;
        }

        // Loop through tweets and do some stuffs
        data.statuses.forEach((tweet) => {
          this.processTweet(tweet)
        });

        // Re-call getTweets with ID of last status
        this.getTweets(oAuth,
          data.statuses[data.statuses.length-1].id);

      });

    }, timeout);

  }

  getCandidate(tweet) {

    console.log(tweet.match(/(clinton|sanders|cruz|kasich|trump)/igm));
    return tweet.match(/(clinton|sanders|cruz|kasich|trump)/igm);

  }

  processTweet(tweet) {

    Request(alchameyUrl.replace('$', encodeURIComponent(tweet.text)))
      .then((sentiment) => {

        sentiment = JSON.parse(sentiment);
        console.log(tweet.text, sentiment.docSentiment);

        let tweetData = {
          _id: tweet.id,
          text: tweet.text,
          candidate: this.getCandidate(tweet.text.toLowerCase()),
          sentiment: (sentiment.docSentiment) ?
            sentiment.docSentiment.type : 'neutral',
          user: {
            name: tweet.user ? tweet.user.name : null,
            location: tweet.user ? tweet.user.location : null
          }
        }

        if (this.ws) {
          this.ws.send(tweet.text);
        }

        try {
          this.db.insertOne(tweetData)
            .then((success) => {
              console.log('Successfully added');
            });
        }
        catch(e) {
          console.log(e);
        }

    });

  }

}