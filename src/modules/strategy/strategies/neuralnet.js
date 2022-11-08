// execute in main dir: npm convnetjs mathjs
// Taken from https://github.com/SirTificate/gekko-neuralnet/blob/fd4d22131e2823540720e4e219fdc1b1e156a44f/strategies/neuralnet.js
const SignalResult = require('../dict/signal_result');
const convnetjs = require('convnetjs');
const math = require('mathjs');

module.exports = class NeuralNet {
    getName() {
        return 'NeuralNet';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }

        indicatorBuilder.add('sma', 'sma', options.period);
        // ATR for Stoploss
        indicatorBuilder.add('atr', 'atr', options.period);
        // ATR for Stoploss
        this.hodl_threshold = options.hodl_threshold || 1;
        this.priceBuffer = [];
        this.batchsize = 1;
        this.scale = 1;
        this.predictionCount = 0;
        this.layer_neurons = 0;
        this.layer_activation = 'tanh';
        var layers = [];
        layers.push({type: 'input', out_sx: 1, out_sy: 1, out_depth: 1});
        layers.push({type: 'fc', num_neurons: this.layer_neurons, activation: this.layer_activation});
        layers.push({type: 'regression', num_neurons: 1});
        this.nn = new convnetjs.Net();
        this.nn.makeLayers(layers);
        if (options.method === 'sgd') {
            this.trainer = new convnetjs.SGDTrainer(this.nn, {
                learning_rate: options.learning_rate,
                momentum: options.momentum,
                batch_size: this.batchsize,
                l2_decay: options.decay
            });
        } else if (options.method === 'nesterov') {
            this.trainer = new convnetjs.Trainer(this.nn, {
                method: options.method,
                learning_rate: options.learning_rate,
                momentum: options.momentum,
                batch_size: this.batchsize,
                l2_decay: options.decay
            });
        } else {
            this.trainer = new convnetjs.Trainer(this.nn, {
                method: options.method,
                batch_size: this.batchsize,
                eps: 1e-6,
                ro: 0.95,
                l2_decay: options.decay
            });
        }
    }

    period(indicatorPeriod, options) {
        const smaFull = indicatorPeriod.getIndicator('sma');
        const sma = smaFull.slice(-1)[0];
        const candle = indicatorPeriod.getIndicator('candles').slice(-1)[0];
        const debug = {
            sma: sma
        };
        const lastSignal = indicatorPeriod.getLastSignal();
        /** Calc Trailing StopLoss START */
        if (options.useSLTP == 1) {
            var slsignal = this.calcTrailingStopLoss(indicatorPeriod, options, lastSignal, debug);
            if (slsignal === 'close') {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
        }
        var atr = indicatorPeriod.getLatestIndicator('atr');
        /** Calc Trailing StopLoss END */
        if (1 === this.scale && 1 < candle.high && 0 === this.predictionCount) {
            this.setNormalizeFactor(candle);
        }
        for (let i = 0; i < smaFull.length; i++) {
            this.priceBuffer.push(smaFull[i] / this.scale);
        }

        if (2 > this.priceBuffer.length) return;
        for (let tweakme = 0; tweakme < 10; ++tweakme)
            this.learn();
        while (options.price_buffer_len < this.priceBuffer.length) this.priceBuffer.shift();
        debug.predictionCount = this.predictionCount;
        if (this.predictionCount > options.min_predictions) {
            let prediction = this.predictCandle() * this.scale;
            let currentPrice = candle.close;
            let meanp = math.mean(prediction, currentPrice);
            let meanAlpha = (meanp - currentPrice) / currentPrice * 100;
            let signal = meanp < currentPrice;

            debug.meanAlpha = meanAlpha;
            debug.prediction = prediction;
            let signalSell = candle.close > indicatorPeriod.getStrategyContext().options.prevPrice || candle.close < (indicatorPeriod.getStrategyContext().options.prevPrice * options.hodl_threshold);
            if (signal === false && meanAlpha > options.threshold_buy) {
                if (!lastSignal) {
                    indicatorPeriod.getStrategyContext().options.prevPrice = candle.close;
                    return SignalResult.createSignal('long', debug);
                } else {
                    return SignalResult.createSignal('close', debug);
                }
            }
            if (signal === true && meanAlpha < options.threshold_sell && signalSell) {
                if (!lastSignal) {
                    indicatorPeriod.getStrategyContext().options.prevPrice = candle.close;
                    return SignalResult.createSignal('short', debug);
                } else {
                    return SignalResult.createSignal('close', debug);
                }
            }
        }
        return SignalResult.createEmptySignal(debug);
    }

    learn() {
        for (let i = 0; i < this.priceBuffer.length - 1; i++) {
            let data = [this.priceBuffer[i]];
            let current_price = [this.priceBuffer[i + 1]];
            let vol = new convnetjs.Vol(data);
            this.trainer.train(vol, current_price);
            this.predictionCount++;
        }
    }

    setNormalizeFactor(candle) {
        this.scale = Math.pow(10, Math.trunc(candle.high).toString().length + 2);
    }

    predictCandle() {
        let vol = new convnetjs.Vol(this.priceBuffer);
        let prediction = this.nn.forward(vol);
        return prediction.w[0];
    }

    calcTrailingStopLoss(indicatorPeriod, options, lastSignal, debug) {
        var sl = 0;
        var entry = indicatorPeriod.getStrategyContext().getEntry();
        const price = indicatorPeriod.getPrice();
        if (!indicatorPeriod.getStrategyContext().options.high_watermark) {
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
        }
        if (!indicatorPeriod.getStrategyContext().options.sl) {
            indicatorPeriod.getStrategyContext().options.sl = 0;
        }
        if (price > (entry + (entry / 100 * options.trailingstopenable)) && options.useTrailingTP === 1 &&
            (!indicatorPeriod.getStrategyContext().options.high_watermark || indicatorPeriod.getStrategyContext().options.high_watermark === 0)) {
            indicatorPeriod.getStrategyContext().options.high_watermark = price;
        }
        if (price > indicatorPeriod.getStrategyContext().options.high_watermark && indicatorPeriod.getStrategyContext().options.high_watermark > 0) {
            indicatorPeriod.getStrategyContext().options.high_watermark = price;
        }
        var watermark = indicatorPeriod.getStrategyContext().options.high_watermark;
        var trigger = watermark - (watermark / 100 * options.trailingstoppercent);
        if (lastSignal) {
            var slvalue;
            if (options.stoplossatr === 1) {
                var atr = indicatorPeriod.getIndicator('atr');
                slvalue = atr[atr.length - 1] * options.stoplossatrfactor;
            } else {
                slvalue = entry / 100 * options.stoplosspercent;
            }
            if (lastSignal === 'long' && price > indicatorPeriod.getStrategyContext().options.sl) {
                if (options.useTrailingTP === 1) {
                    sl = price - slvalue;
                } else {
                    sl = entry - slvalue;
                }
                if (sl > indicatorPeriod.getStrategyContext().options.sl) {
                    indicatorPeriod.getStrategyContext().options.sl = sl;
                }
            }
            if (lastSignal === 'short' && price < indicatorPeriod.getStrategyContext().options.sl) {
                if (options.useTrailingTP === 1) {
                    sl = price + slvalue;
                } else {
                    sl = entry + slvalue;
                }
                if (sl < indicatorPeriod.getStrategyContext().options.sl) {
                    indicatorPeriod.getStrategyContext().options.sl = sl;
                }
            }
        }
        debug.watermark = watermark;
        debug.trigger = trigger;
        debug.stoploss = indicatorPeriod.getStrategyContext().options.sl;
        var stoploss = indicatorPeriod.getStrategyContext().options.sl;
        if (lastSignal) {
            if (lastSignal && price < stoploss) {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                debug._trigger = "profit below stoploss";
                return 'close';
            }
            if (lastSignal && price < trigger) {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                debug._trigger = "profit below trigger";
                return 'close';
            }
        }
    }

    getBacktestColumns() {
        return [
            {
                label: 'sma',
                value: 'sma'
            },
            {
                label: 'meanAlpha',
                value: 'meanAlpha'
            },
            {
                label: 'prediction',
                value: 'prediction'
            },
            {
                label: 'predictionCount',
                value: 'predictionCount'
            },
            {
                label: 'Order Reason',
                value: '_trigger'
            },
            {
                label: 'Trigger Percentage',
                value: 'trigger'
            },
            {
                label: 'Watermark Percentage',
                value: 'watermark'
            },
        ];
    }

    getOptions() {
        return {
            period: '15m',
            method: 'adadelta',
            threshold_buy: 1.0,
            threshold_sell: -1.0,
            learning_rate: 1.2,
            momentum: 0.9,
            decay: 0.10,
            hodl_threshold: 1,
            price_buffer_len: 100,
            min_predictions: 1000,
            useSLTP: 0,
            useTrailingTP: 0,
            stoplossatr: 1,
            stoplossatrfactor: 1,
            trailingstoplossatr: 3,
            stoplosspercent: 2,
            trailingstopenable: 3,
            trailingstoppercent: 1
        };
    }
}