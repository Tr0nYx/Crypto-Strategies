const SignalResult = require('../dict/signal_result');

module.exports = class kdj {
    getName() {
        return 'kdj';
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('rsi', 'rsi', '15m');

    }

    period(indicatorPeriod, options) {
        var candlesFull = indicatorPeriod.getIndicator('candles');
        var curCandle = candlesFull.slice(-1)[0];
        var c = curCandle.close;
        if (!indicatorPeriod.getStrategyContext().options.bcwsma) {
            indicatorPeriod.getStrategyContext().options.bcwsma = 1;
        }
        var candles = candlesFull.slice(options.period * -1);
        var h = this.highest(candles, options.period);
        var l = this.lowest(candles, options.period);
        var RSV = 100 * ((c - l) / (h - l));
        var pK = this.bcwsma(RSV, options.signal, 1, indicatorPeriod)
        var pD = this.bcwsma(pK, options.signal, 1, indicatorPeriod)
        var pJ = 3 * pK - 2 * pD
        var currentValues = {
            h: h,
            l: l,
            RSV: RSV,
            pK: pK,
            pD: pD,
            pJ: pJ
        };
        const emptySignal = SignalResult.createEmptySignal(currentValues);

        // entry or exit
        if (!indicatorPeriod.getLastSignal()) {
            if (pJ > pD) {
                emptySignal.setSignal('long');
            }
            if (pJ < pD) {
                emptySignal.setSignal('short');
            }
        }

        // close on profit or lose
        if (indicatorPeriod.getLastSignal()) {
            if (indicatorPeriod.getProfit() > 3) {
                // take profit
                emptySignal.addDebug('message', 'TP');
                if (pJ < pD) {
                    emptySignal.setSignal('close');
                }
            } else if (indicatorPeriod.getProfit() < -1) {
                // stop loss
                emptySignal.addDebug('message', 'SL');
                emptySignal.setSignal('close');
            }
        }

        return emptySignal;
    }

    bcwsma(s, l, m, indicatorPeriod) {
        var _s = s
        var _l = l
        var _m = m
        var _bcwsma = indicatorPeriod.getStrategyContext().options.bcwsma;
        var _bcwsma = (_m * _s + (_l - _m) * _bcwsma) / _l;
        indicatorPeriod.getStrategyContext().options.bcwsma = _bcwsma;
        return _bcwsma;
    }

    lowest(candles, period) {
        var low = 999999999;
        for (var i = 1, val; (val = candles[i]) !== undefined; ++i) {
            if (val.low < low) {
                low = val.low;
            }
        }
        return low;
    }

    highest(candles, period) {
        var high = 0;
        for (var i = 1, val; (val = candles[i]) !== undefined; ++i) {
            if (val.high > high) {
                high = val.high;
            }
        }
        return high;
    }

    getBacktestColumns() {
        return [
            {
                label: 'k',
                value: 'pK'
            },
            {
                label: 'd',
                value: 'pD'
            },
            {
                label: 'j',
                value: 'pJ'
            }
        ];
    }

    getOptions() {
        return {
            timeperiod: '15m',
            period: 9,
            signal: 3

        };
    }

    getTickPeriod() {
        return '1m';
    }
};