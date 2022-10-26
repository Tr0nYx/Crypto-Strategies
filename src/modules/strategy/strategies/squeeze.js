// Source: https://www.tradingview.com/script/nqQ1DT5a-Squeeze-Momentum-Indicator-LazyBear/
// By: https://www.tradingview.com/u/LazyBear/

const SignalResult = require('../dict/signal_result');
const talib = require('talib');

module.exports = class Squeeze {
    getName() {
        return 'Squeeze';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('sma', 'sma', options.period, options);
        indicatorBuilder.add('ema', 'ema', options.period, {'length': options.lengthKC});
        indicatorBuilder.add('bb', 'bb', options.period, options);
        indicatorBuilder.add('atr', 'atr', options.period, options);
    }

    period(indicatorPeriod, options) {
        var highs = [], lows = [], color = '#cccccc', signal = 'none';
        const bbands = indicatorPeriod.getLatestIndicator('bb');
        const ema = indicatorPeriod.getLatestIndicator('ema');
        const atr = indicatorPeriod.getLatestIndicator('atr');
        const candle = indicatorPeriod.getLatestIndicator('candles');
        const lastCandles = indicatorPeriod.getIndicator('candles').slice(options.length * -1);
        if (!indicatorPeriod.getStrategyContext().options.emaAvg) {
            indicatorPeriod.getStrategyContext().options.emaAvg = [];
        }
        if (!indicatorPeriod.getStrategyContext().options.linReg) {
            indicatorPeriod.getStrategyContext().options.linReg = 0;
        }
        const lastSignal = indicatorPeriod.getLastSignal();
        var mid = ema;
        var upperKC = mid + (options.multKC * atr);
        var lowerKC = mid - (options.multKC * atr);
        var sqzOn = (bbands.lower > lowerKC) && (bbands.upper < upperKC)
        var sqzOff = (bbands.lower < lowerKC) && (bbands.upper > upperKC)
        for (var i = 0, len = lastCandles.length; i < len; i++) {
            highs[i] = lastCandles[i].high;
            lows[i] = lastCandles[i].low;
        }
        var highest = this.highest(highs, options.lengthKC);
        var lowest = this.lowest(lows, options.lengthKC);

        var hlavg = (highest + lowest) / 2;
        var emaAvg = (hlavg + ema) / 2;
        emaAvg = candle.close - emaAvg;
        const debug = {
            color: '#cccccc'
        };
        indicatorPeriod.getStrategyContext().options.emaAvg.push(emaAvg);
        if (indicatorPeriod.getStrategyContext().options.emaAvg.length < options.length) {
            return SignalResult.createEmptySignal(debug);
        }
        indicatorPeriod.getStrategyContext().options.emaAvg = indicatorPeriod.getStrategyContext().options.emaAvg.slice(options.length * -1);

        var calcLinReg = indicatorPeriod.getStrategyContext().options.emaAvg;
        var linReg = this.linReg(calcLinReg, options.length);
        debug.linReg = linReg;
        debug.emaAvg = indicatorPeriod.getStrategyContext().options.linReg;
        if (linReg > 0) {
            if (linReg > indicatorPeriod.getStrategyContext().options.linReg) {
                debug.color = '#05ffa6';
                signal = 'long';
            } else {
                debug.color = '#00945f';
                signal = 'close';
            }
        } else {
            if (linReg < indicatorPeriod.getStrategyContext().options.linReg) {
                debug.color = '#ff0a70';
                signal = 'short';
            } else {
                debug.color = '#990040';
                signal = 'close';
            }
        }

        /** Calc Trailing StopLoss START */
        var slsignal = this.calcTrailingStopLoss(indicatorPeriod, options, lastSignal, debug);
        if (slsignal === 'close') {
            indicatorPeriod.getStrategyContext().options.sl = 0;
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
            return SignalResult.createSignal('close', debug);
        }
        /** Calc Trailing StopLoss END */

        if (signal === 'close' && lastSignal) {
            indicatorPeriod.getStrategyContext().options.sl = 0;
            indicatorPeriod.getStrategyContext().options.high_watermark = 0;
            return SignalResult.createSignal('close', debug);
        }
        if (!lastSignal && signal !== 'close') {
            if (signal === 'long') {
                indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() - (atr[atr.length - 1] * options.stoplossatrfactor);
                return SignalResult.createSignal('long', debug);
            }
            if (signal === 'short' && options.only_long === 0) {
                indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() + (atr[atr.length - 1] * options.stoplossatrfactor);
                return SignalResult.createSignal('short', debug);
            }

        }
        indicatorPeriod.getStrategyContext().options.linReg = linReg;
        return SignalResult.createEmptySignal(debug);
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

    linReg(calcLinReg, length) {
        var linreg = talib.execute({
            name: "LINEARREG",
            startIdx: 0,
            endIdx: calcLinReg.length - 1,
            inReal: calcLinReg,
            optInTimePeriod: length
        });
        return linreg.result.outReal[0];
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
                label: 'color',
                value: 'color',
                type: 'color'
            },
            {
                label: 'linReg',
                value: 'linReg'
            },
            {
                label: 'emaAvg',
                value: 'emaAvg'
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
            length: 20,
            mult: 2.0,
            lengthKC: 20,
            multKC: 1.5,
            useTrueRange: 1,
            only_long: 1,
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