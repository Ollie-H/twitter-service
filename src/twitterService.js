/**
 * main.js
 * @author Ollie Husband
 */

import EventEmitter from 'events';
import OAuth from 'oauth-request';
import request from 'request-promise';
import { Server as WebSocketServer } from 'ws';

const eventEmitter = new EventEmitter();
const defaultOptions = {
  url: 'https://api.twitter.com/1.1/search/tweets.json',
  json: true,
  interval: 10,
  qs: {
    count: 15,
    query: '',
  },
};
const defaultConfig = {
  twitter: {
    CONSUMER_KEY: '',
    CONSUMER_SECRET: '',
    ACCESS_TOKEN: '',
    ACCESS_TOKEN_SECRET: '',
  },
  alchemy: {
    API_KEY: '',
  },
};

export class TwitterService {

  constructor(server, options = {}, config = {}) {
    this.options = Object.assign(defaultOptions, options);
    this.config = Object.assign(defaultConfig, config);

    if (
      !this.config.twitter.CONSUMER_KEY ||
      !this.config.twitter.CONSUMER_SECRET ||
      !this.config.twitter.ACCESS_TOKEN ||
      !this.config.twitter.ACCESS_TOKEN_SECRET) {
      throw new Error('Twitter access tokens are needed');
    }

    this.setupSockets(server);
    this.setupPolling();
  }

  setupSockets(server) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws) => {
      this.ws = ws;
    });
  }

  setupPolling() {
    const oAuth = new OAuth({
      consumer: {
        public: this.config.twitter.CONSUMER_KEY,
        secret: this.config.twitter.CONSUMER_SECRET,
      },
    });
    oAuth.setToken({
      public: this.config.twitter.ACCESS_TOKEN,
      secret: this.config.twitter.ACCESS_TOKEN_SECRET,
    });
    this.getTweets(oAuth);
  }

  getTweets(oAuth, sinceId, timeout = this.options.interval * 1000) {
    const options = this.options;
    if (sinceId) {
      options.qs.since_id = sinceId;
    }

    setTimeout(() => {
      if (!this.ws) {
        return;
      }
      oAuth.get(Object.assign({}, { ...options }), (err, res, data) => {
        if (!data || !data.statuses || data.statuses.length === 0) {
          if (data && data.errors && data.errors.code === 88) {
            // Rate limite exceded, waiting....
            this.getTweets(oAuth, sinceId, 1000 * 60);
            return;
          }
          // Tweet error
          this.getTweets(oAuth);
          return;
        }

        // Loop through tweets and do some stuffs
        data.statuses.forEach((tweet) => {
          this.processTweet(tweet);
        });

        // Re-call getTweets with ID of last status
        this.getTweets(oAuth, data.statuses[data.statuses.length - 1].id);
      });
    }, timeout);
  }

  processTweet(tweet) {
    let tweetData = tweet;
    if (this.options.useSentimentAnalysis && this.config.alchemy.API_KEY) {
      const alchameyUrl = `http://gateway-a.watsonplatform.net/calls/text/TextGetTextSentiment?apikey=${this.config.alchemy.API_KEY}&text=$&outputMode=json`;
      request(alchameyUrl.replace('$', encodeURIComponent(tweet.text)))
        .then((sentiment) => {
          tweetData = Object.assign(tweetData,
            { sentiment: (sentiment.docSentiment) ?
              sentiment.docSentiment.type : 'neutral' });
          this.ws.send(JSON.stringify(tweetData));
        })
        .catch((err) => {
          console.log(err);
        });
      return;
    }
    console.log(tweetData);
    eventEmitter.emit('getTweets', tweetData);
    this.ws.send(JSON.stringify(tweetData));
  }

}
