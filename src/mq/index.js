const Logger = require('node-json-logger');
const amqp = require('amqplib');
const { errString } = require('../utils');

const logger = new Logger();
const RETRY_HEADER_NAME = 'payments-num-failed-attempts';
const DEFAULT_RETRY_LIMIT = 5;

class Producer {
  constructor(channel, queueName) {
    this.channel = channel;
    this.queueName = queueName;
    this.initialized = false;
  }

  async init() {
    return this.channel.assertQueue(this.queueName);
  }

  publish(msgObj) {
    this._send(Buffer.from(JSON.stringify(msgObj)));
  }

  republish(msg, numAttempts) {
    this._send(msg.content, { [RETRY_HEADER_NAME]: numAttempts || 0 });
  }

  _send(msgBuf, headers) {
    this.channel.sendToQueue(this.queueName, msgBuf, {
      persistent: true,
      headers,
    });
  }
}

class Consumer {
  constructor(channel, queueName, stats, retryLimit) {
    this.channel = channel;
    this.queueName = queueName;
    this.stats = stats;
    this.retryLimit = retryLimit || DEFAULT_RETRY_LIMIT;
    this.producer = new Producer(channel, queueName);
  }

  async init() {
    return this.producer.init();
  }

  success(msg) {
    this.channel.ack(msg);
  }

  reject(msg) {
    this.channel.reject(msg, false);
  }

  fail(msg) {
    const prevAttempts = Consumer.getRetryNum(msg);
    if (!Number.isNaN(prevAttempts) && prevAttempts < this.retryLimit) {
      this.producer.republish(msg, prevAttempts + 1);
    } else {
      // TODO support for a DL queue

      logger.error(`message failed ${prevAttempts} times - message dropped`);
    }

    // Whether we re-enqueued an updated message or not, it's
    // now time to reject the old one.
    this.reject(msg);
  }

  consume(handler) {
    this.channel.prefetch(1);
    this.channel.consume(this.queueName, async (msg) => {
      // TODO built-in statsing
      this.stats.increment('msg_received');

      let msgHandled = false;
      const reject = () => {
        this.reject(msg);
        msgHandled = true;
        this.stats.increment('msg_rejected');
      };
      const fail = () => {
        this.fail(msg);
        msgHandled = true;
        this.stats.increment('msg_failed');
      };
      const success = () => {
        this.success(msg);
        msgHandled = true;
        this.stats.increment('msg_succeeded');
      };

      try {
        const msgObj = JSON.parse(msg.content);
        await handler(msgObj, reject, fail, success);
      } catch (error) {
        logger.error(`uncaught error handling message`, errString(error));
        fail();
        return;
      }

      if (!msgHandled) {
        logger.error(`message handler did not resolve - assuming success`);
        success();
      }
    });
  }

  static getRetryNum(msg) {
    const header = msg.properties.headers[RETRY_HEADER_NAME];
    if (!header) return 0;

    return Number(header);
  }
}

async function Connect(url) {
  const conn = await amqp.connect(url);
  return conn.createChannel();
}

module.exports = { Connect, Producer, Consumer };
