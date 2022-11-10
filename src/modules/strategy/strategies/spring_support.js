const SignalResult = require('../dict/signal_result');

module.exports = class SpringSupport {
    getName() {
        return 'SpringSupport';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('rsi', 'rsi', options.period);
    }

    period(indicatorPeriod, options) {
        var highs = [], lows = [];

        const candles = indicatorPeriod.getIndicator('candles').slice(options.length * -1);
        for (var i = 0, len = options.length - 1; i < len; i++) {
            highs[i] = candles[i].high;
            lows[i] = candles[i].low;
        }
        highs.sort(function (a, b) {
            return a - b
        });
        lows.sort(function (a, b) {
            return b - a
        });

        var high = highs.slice(-3);
        var low = lows.slice(-3);
        const average_high = high.reduce((a, b) => a + b, 0) / high.length;
        const average_low = low.reduce((a, b) => a + b, 0) / low.length;
        //console.log(average_low);
        const lastSignal = indicatorPeriod.getLastSignal();

        const debug = {
            'high': average_high,
            'low': average_low,
            'lastSignal': lastSignal
        }

        /** Calc Trailing StopLoss START */
        if (options.useSLTP == 1) {
            var slsignal = this.calcSLTP(indicatorPeriod, options, lastSignal, debug);
            if (slsignal === 'close') {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
        }
        /** Calc Trailing StopLoss END */
        if (indicatorPeriod.getPrice() > average_high) {
            if (lastSignal === 'short') {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
            if (!lastSignal) {
                indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() - (indicatorPeriod.getPrice() / 100 * options.stoplosspercent);
                return SignalResult.createSignal('long', debug);
            }
        }
        if (indicatorPeriod.getPrice() < average_low) {
            if (lastSignal === 'long') {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
            if (!lastSignal) {
                indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() + (indicatorPeriod.getPrice() / 100 * options.stoplosspercent);
                return SignalResult.createSignal('short', debug);
            }
        }
        return SignalResult.createEmptySignal(debug);
    }

    calcSLTP(indicatorPeriod, options, lastSignal, debug) {
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
            if (lastSignal === 'long' && price > indicatorPeriod.getStrategyContext().options.sl) {
                slvalue = entry / 100 * options.stoplosspercent;
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
            if ((lastSignal === 'long' && price < stoploss) || (lastSignal === 'short' && price > stoploss)) {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                debug._trigger = "profit below stoploss";
                return 'close';
            }
            if ((lastSignal === 'long' && price < trigger) || (lastSignal === 'short' && price > trigger)) {
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
                label: 'trend',
                value: row => {
                    return row.trend === 1 ? 'success' : 'danger';
                },
                type: 'icon'
            },
            {
                label: 'high',
                value: 'high'
            },
            {
                label: 'low',
                value: 'low'
            },
            {
                label: 'stoploss',
                value: 'stoploss'
            },
            {
                label: 'watermark',
                value: 'watermark'
            },
            {
                label: 'trigger',
                value: 'trigger'
            },
            {
                label: 'Order Reason',
                value: '_trigger'
            }
        ]
    }

    getOptions() {
        return {
            period: '15m',
            length: 20,
            useSLTP: 1,
            useTrailingTP: 1,
            stoplosspercent: 2,
            trailingstopenable: 3,
            trailingstoppercent: 1
        };
    }
}