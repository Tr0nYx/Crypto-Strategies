// Source: https://www.tradingview.com/script/hXp5irRI-Fisher-Multi-Pack-DW/
// By https://www.tradingview.com/u/DonovanWall/
const SignalResult = require('../dict/signal_result');
const talib = require('talib');

module.exports = class FisherMultiPack {
    getName() {
        return 'FisherMultiPack';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('rsi', 'rsi', options.period, {'length': options.timeperiod});
        indicatorBuilder.add('stoch_rsi', 'stoch_rsi', options.period, {'length': options.timeperiod});
        indicatorBuilder.add('stoch', 'stoch', options.period, {'length': options.timeperiod});
        indicatorBuilder.add('cci', 'cci', options.period, {'length': options.timeperiod});
        // ATR for Stoploss
        indicatorBuilder.add('atr', 'atr', options.period, {'length': options.timeperiod});
        // ATR for Stoploss
    }

    period(indicatorPeriod, options) {
        var candles = indicatorPeriod.getIndicator('candles').slice(0, -1);
        var rsi = indicatorPeriod.getLatestIndicator('rsi');
        var stoch = indicatorPeriod.getLatestIndicator('stoch');
        var atr = indicatorPeriod.getLatestIndicator('atr');
        var cci = indicatorPeriod.getLatestIndicator('cci');
        if (!indicatorPeriod.getStrategyContext().options.oscillator) {
            indicatorPeriod.getStrategyContext().options.oscillator = 0;
        }
        const lastSignal = indicatorPeriod.getLastSignal();
        if (!candles ||
            !rsi ||
            !stoch ||
            !atr ||
            candles.length < options.timeperiod
        ) {
            return SignalResult.createEmptySignal(debug);
        }

        var signal = 'none';
        const debug = {
            rsi: 0
        }
        var oscillator;
        if (options.oscillator_type === 1) {
            oscillator = this.fish(indicatorPeriod, options, debug);
            debug.rsi = oscillator[oscillator.length - 1];
        } else if (options.oscillator_type === 2) {
            oscillator = this.ifishrsi(indicatorPeriod, options);
            debug.rsi = rsi;
        } else if (options.oscillator_type === 3) {
            oscillator = this.ifishstoch(indicatorPeriod, options);
            rsi = stoch.stoch_k;
            debug.rsi = rsi;
        } else if (options.oscillator_type === 4) {
            oscillator = this.ifishcci(indicatorPeriod, options);
            debug.rsi = cci;
        }
        var oscillator_ema = this.ema(oscillator, options.ema_smoothing);
        oscillator_ema = oscillator_ema[oscillator_ema.length - 1];
        oscillator = oscillator[oscillator.length - 1];

        debug.oscillator = oscillator;
        debug.oscillator_ema = oscillator_ema;
        debug.trend_type = 'none';
        debug.color = '#cccccc';
        debug.prev_osc = indicatorPeriod.getStrategyContext().options.oscillator;
        var tdist = this.cmean(indicatorPeriod, oscillator_ema);
        var hth = tdist;
        var lth = tdist * -1;
        debug.hth = hth;
        debug.lth = lth;
        debug.atr = atr[atr.length - 1];

        if (oscillator_ema > 0 && oscillator_ema >= indicatorPeriod.getStrategyContext().options.oscillator && oscillator_ema >= hth) {
            debug.trend_type = 'bullpower';
            debug.color = '#05ffa6';
            signal = 'none';
            debug.trend = 'up';
        }
        if (oscillator_ema > 0 && oscillator_ema > indicatorPeriod.getStrategyContext().options.oscillator && oscillator_ema < hth) {
            debug.trend_type = 'bullforming';
            debug.color = '#05fff1';
            signal = 'long';
            debug.trend = 'up';
        }
        if (oscillator_ema > 0 && oscillator_ema < indicatorPeriod.getStrategyContext().options.oscillator) {
            debug.trend_type = 'bullpullback';
            debug.color = '#00945f';
            signal = 'none';
            debug.trend = 'none';
        }

        if (oscillator_ema < 0 && oscillator_ema <= indicatorPeriod.getStrategyContext().options.oscillator && oscillator_ema <= lth) {
            debug.trend_type = 'bearpower';
            debug.color = '#ff0a70';
            signal = 'none';
            debug.trend = 'down';
        }
        if (oscillator_ema < 0 && oscillator_ema < indicatorPeriod.getStrategyContext().options.oscillator && oscillator_ema > lth) {
            debug.trend_type = 'bearforming';
            debug.color = '#ff0ae2';
            signal = 'short';
            debug.trend = 'down';
        }
        if (oscillator_ema < 0 && oscillator_ema > indicatorPeriod.getStrategyContext().options.oscillator) {
            debug.trend_type = 'bearpullback';
            debug.color = '#990040';
            signal = 'none';
            debug.trend = 'down';
        }
        /** Calc Trailing StopLoss START */
        var slsignal = this.calcTrailingStopLoss(indicatorPeriod, options, lastSignal, debug);
        if (slsignal === 'close') {
            indicatorPeriod.getStrategyContext().options.sl = 0;
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
            return SignalResult.createSignal('close', debug);
        }
        /** Calc Trailing StopLoss END */
        indicatorPeriod.getStrategyContext().options.oscillator = oscillator_ema;
        if (signal === 'long') {
            if (lastSignal === 'short') {
                if (options.onlystoploss === 0) {
                    return SignalResult.createSignal('close', debug);
                }
            } else if (lastSignal !== 'long') {
                indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() - (atr[atr.length - 1] * options.stoplossatrfactor);
                return SignalResult.createSignal('long', debug);
            }
        } else if (signal === 'short') {
            if (lastSignal === 'long') {
                if (options.onlystoploss === 0) {
                    return SignalResult.createSignal('close', debug);
                }
            } else if (lastSignal !== 'short' && options.only_long === 0) {
                indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() + (atr[atr.length - 1] * options.stoplossatrfactor);
                return SignalResult.createSignal('short', debug);
            }
        }
        return SignalResult.createEmptySignal(debug);
    }

    fish(indicatorPeriod, options, debug) {
        var val1 = [], val, val2, x, fish = [];
        var candles = indicatorPeriod.getIndicator('candles').slice(options.timeperiod * -1);
        const minMax = candles.reduce(
            (accumulator, currentValue) => {
                return [Math.min(currentValue.low, accumulator[0]), Math.max(currentValue.high, accumulator[1])];
            },
            [Number.MAX_VALUE, Number.MIN_VALUE]
        );
        var lowval = minMax[0];
        var highval = minMax[1];
        for (var i = 0, len = candles.length; i < len; i++) {
            if (val1.length === 0) {
                val1[i] = 0.66 * ((x - lowval) / Math.max(highval - lowval, 0.001) - 0.5) + 0.67 * 0;
            } else {
                val1[i] = 0.66 * ((x - lowval) / Math.max(highval - lowval, 0.001) - 0.5) + 0.67 * val1[i + 1];
            }
            val2 = val1[i] > 0.99 ? 0.999 : val1[i] < -0.99 ? -0.999 : val1[i];
            if (fish.length === 0) {
                fish[i] = 0.5 * Math.log((1 + val2) / Math.max(1 - val2, 0.001)) + 0.5 * 0;
            } else {
                fish[i] = 0.5 * Math.log((1 + val2) / Math.max(1 - val2, 0.001)) + 0.5 * fish[i + 1];
            }
            //console.log("Math.max(highval - lowval, 0.001)",Math.max(highval - lowval, 0.001));
        }
        return fish;
    }

    ifishrsi(indicatorPeriod, options) {
        var rsiv = [], i = 0;
        for (const value of indicatorPeriod.visitLatestIndicators(options.timeperiod + 1)) {
            rsiv[i] = options.alpha * (value.rsi - 50);
            i++;
        }

        var wmarv = this.wma(rsiv.reverse(), options.timeperiod);
        var ifishrsi = [];
        for (var i = 0, len = wmarv.length; i < len; i++) {
            ifishrsi[i] = (Math.exp(2 * wmarv[i]) - 1) / (Math.exp(2 * wmarv[i]) + 1)
        }
        return ifishrsi;
    }

    ifishstoch(indicatorPeriod, options) {
        var stoch = [], i = 0;
        for (const value of indicatorPeriod.visitLatestIndicators(options.timeperiod + 1)) {
            stoch[i] = options.alpha * (value.stoch.stoch_k - 50);
            i++;
        }
        var wmasv = this.wma(stoch.reverse(), options.timeperiod);

        var ifishstoch = [];
        for (var i = 0, len = wmasv.length; i < len; i++) {
            ifishstoch[i] = (Math.exp(2 * wmasv[i]) - 1) / (Math.exp(2 * wmasv[i]) + 1)
        }
        return ifishstoch;
    }

    ifishcci(indicatorPeriod, options) {
        var cciv = [], i = 0;
        for (const value of indicatorPeriod.visitLatestIndicators(options.timeperiod + 1)) {
            cciv[i] = options.alpha * (value.cci - 50);
            i++;
        }

        var wmarv = this.wma(cciv.reverse(), options.timeperiod);
        var ifishcci = [];
        for (var i = 0, len = wmarv.length; i < len; i++) {
            ifishcci[i] = (Math.exp(2 * wmarv[i]) - 1) / (Math.exp(2 * wmarv[i]) + 1)
        }
        return ifishcci;
    }

    cmean(indicatorPeriod, x) {
        x = Math.abs(x);
        if (!indicatorPeriod.getStrategyContext().options.xsum) {
            indicatorPeriod.getStrategyContext().options.xsum = 0.0;
        }
        if (!indicatorPeriod.getStrategyContext().options.tsum) {
            indicatorPeriod.getStrategyContext().options.tsum = 0.0;
        }
        indicatorPeriod.getStrategyContext().options.xsum = indicatorPeriod.getStrategyContext().options.xsum + x;
        indicatorPeriod.getStrategyContext().options.tsum = indicatorPeriod.getStrategyContext().options.tsum + 1;
        return indicatorPeriod.getStrategyContext().options.xsum / indicatorPeriod.getStrategyContext().options.tsum;
    }

    wma(values, length) {
        var wma = talib.execute({
            name: "WMA",
            startIdx: 0,
            endIdx: values.length - 1,
            inReal: values,
            optInTimePeriod: length
        });

        return wma.result.outReal;
    }


    ema(values, length) {
        var k = 2 / (length + 1);
        var emaArray = [values[0]];
        for (var i = 1; i < values.length; i++) {
            emaArray.push((values[i] - emaArray[i - 1]) * k + emaArray[i - 1]);
        }
        return emaArray;
    }

    lowest(candles, period) {
        for (var i = 1, val; (val = candles[i]) !== undefined; ++i) {
            if (val.close < low) {
                low = val.close;
            }
        }
        return low;
    }

    highest(candles, period) {
        for (var i = 1, val; (val = candles[i]) !== undefined; ++i) {
            if (val.close > high) {
                high = val.close;
            }
        }
        return high;
    }

    highest(array, length) {
        var highest = talib.execute({
            name: "MAX",
            startIdx: 0,
            endIdx: length,
            inReal: array,
            optInTimePeriod: length
        });
        return highest.result.outReal[0];
    }

    lowest(array, length) {
        var lowest = talib.execute({
            name: "MIN",
            startIdx: 0,
            endIdx: length,
            inReal: array,
            optInTimePeriod: length
        });
        return lowest.result.outReal[0];
    }

    calcTrailingStopLoss(indicatorPeriod, options, lastSignal, debug) {
        var sl = 0;
        this.profit = indicatorPeriod.getStrategyContext().getProfit();
        const price = indicatorPeriod.getPrice();
        if (!indicatorPeriod.getStrategyContext().options.high_watermark) {
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
        }
        if (!indicatorPeriod.getStrategyContext().options.sl) {
            indicatorPeriod.getStrategyContext().options.sl = 0;
        }
        if (this.profit > options.trailingstopenable &&
            (!indicatorPeriod.getStrategyContext().options.high_watermark || indicatorPeriod.getStrategyContext().options.high_watermark === 0)) {
            indicatorPeriod.getStrategyContext().options.high_watermark = this.profit;
        }
        if (this.profit > indicatorPeriod.getStrategyContext().options.high_watermark && indicatorPeriod.getStrategyContext().options.high_watermark > 0) {
            indicatorPeriod.getStrategyContext().options.high_watermark = this.profit;
        }
        this.watermark = indicatorPeriod.getStrategyContext().options.high_watermark;
        this.trigger = parseFloat(this.watermark) - options.trailingstoppercent;
        if (lastSignal && options.stoplossatr === 1 && options.trailingstoplossatr === 1) {
            var atr = indicatorPeriod.getIndicator('atr');
            if (lastSignal === 'long' && indicatorPeriod.getPrice() > indicatorPeriod.getStrategyContext().options.sl) {
                sl = indicatorPeriod.getPrice() - (atr[atr.length - 1] * options.stoplossatrfactor);
                if (sl > indicatorPeriod.getStrategyContext().options.sl) {
                    indicatorPeriod.getStrategyContext().options.sl = sl;
                }
            }
            if (lastSignal === 'short' && indicatorPeriod.getPrice() < indicatorPeriod.getStrategyContext().options.sl) {
                sl = indicatorPeriod.getPrice() + (atr[atr.length - 1] * options.stoplossatrfactor);
                if (sl < indicatorPeriod.getStrategyContext().options.sl) {
                    indicatorPeriod.getStrategyContext().options.sl = sl;
                }
            }
        }
        debug.watermark = this.watermark;
        debug.trigger = this.trigger;
        debug.stoploss = indicatorPeriod.getStrategyContext().options.sl;
        if (options.stoplossatr === 1) {
            if (lastSignal === 'long' && price < indicatorPeriod.getStrategyContext().options.sl) {
                debug._trigger = "profit below atr stoploss";
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return 'close';
            }
            if (lastSignal === 'short' && price > indicatorPeriod.getStrategyContext().options.sl) {
                debug._trigger = "profit above atr stoploss";
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return 'close';
            }
        }
        if (lastSignal && (this.profit < options.stoplosspercent * -1)) {
            indicatorPeriod.getStrategyContext().options.sl = 0;
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
            debug._trigger = "profit below stoplosspercent";
            return 'close';
        }
        if (lastSignal && indicatorPeriod.getStrategyContext().getProfit() < this.trigger) {
            indicatorPeriod.getStrategyContext().options.sl = 0;
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
            debug._trigger = "profit below trigger";
            return 'close';
        }
    }

    getBacktestColumns() {
        return [
            {
                label: 'trend',
                value: row => {
                    return row.trend === 'up' ? 'success' : 'danger';
                },
                type: 'icon'
            },
            {
                label: 'rsi',
                value: 'rsi',
                type: 'oscillator',
                range: [0, 100]
            },
            {
                label: 'oscillator_ema',
                value: 'oscillator_ema',
                type: 'oscillator',
                range: [-1, 1]
            },
            {
                label: 'hth',
                value: 'hth',
                type: 'histogram'
            },
            {
                label: 'lth',
                value: 'lth',
                type: 'histogram'
            },
            {
                label: 'color',
                value: 'color',
                type: 'color'
            },
            {
                label: 'atr stoploss',
                value: 'stoploss'
            },
            {
                label: 'watermark',
                value: 'watermark'
            },
            {
                label: 'Order Reason',
                value: '_trigger'
            },
            {
                label: 'trigger',
                value: 'trigger'
            }
        ];
    }

    getOptions() {
        return {
            period: '15m',
            oscillator_type: 2,
            timeperiod: 13,
            alpha: 0.1,
            only_long: 1,
            ema_smoothing: 1,
            multKC: 1.5,
            onlystoploss: 0,
            stoplossatr: 1,
            trailingstoplossatr: 1,
            stoplossatrfactor: 2,
            stoplosspercent: 1,
            trailingstopenable: 2,
            trailingstoppercent: 1
        };
    }
}
