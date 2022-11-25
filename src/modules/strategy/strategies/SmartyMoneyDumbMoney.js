const SignalResult = require('../dict/signal_result');

module.exports = class SmartyMoneyDumbMoney {
    getName() {
        return 'Smarty Money Dumb Money';
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('roc', 'roc', options.period, {length: 1});
    }

    period(indicatorPeriod, options) {
        var pvi, nvi, prevCandle, candle, xcloseH1, ppvi, pnvi;
        var candles = indicatorPeriod.getIndicator('candles');
        var roc = indicatorPeriod.getLatestIndicator('roc') * 100;
        var signal = 'none';
        const debug = {};
        const lastSignal = indicatorPeriod.getLastSignal();
        if (!candles || candles.length < 20) {
            return SignalResult.createEmptySignal(debug);
        }
        if (!indicatorPeriod.getStrategyContext().options.pvi) {
            indicatorPeriod.getStrategyContext().options.pvi = [0];
        }
        if (!indicatorPeriod.getStrategyContext().options.nvi) {
            indicatorPeriod.getStrategyContext().options.nvi = [0];
        }
        prevCandle = candles.slice(-2)[0];
        candle = candles.slice(-1)[0];
        xcloseH1 = prevCandle.close;

        var apvi = indicatorPeriod.getStrategyContext().options.pvi;
        var emapvi = this.ema(apvi, 255);
        var emapvi = emapvi[emapvi.length - 1];
        debug.emapvi = emapvi;
        pvi = apvi[apvi.length - 1];
        if (candle.volume > prevCandle.volume) {
            pvi = pvi + roc;
        }
        indicatorPeriod.getStrategyContext().options.pvi.push(pvi);
        var pvi = pvi - emapvi;
        debug.pvi = pvi;

        var anvi = indicatorPeriod.getStrategyContext().options.nvi;
        var emanvi = this.ema(anvi, 255);
        var emanvi = emanvi[emanvi.length - 1];
        debug.emanvi = emanvi;
        nvi = anvi[anvi.length - 1];
        if (candle.volume < prevCandle.volume) {
            nvi = nvi + roc;
        }
        indicatorPeriod.getStrategyContext().options.nvi.push(nvi);
        var nvi = nvi - emanvi;
        debug.nvi = nvi;
        debug.roc = roc;

        if (nvi > pvi && !lastSignal) {
            return SignalResult.createSignal('short', debug);
        }
        if (pvi > nvi && !lastSignal) {
            return SignalResult.createSignal('long', debug);
        }
        if ((lastSignal === 'long' && pvi < nvi) || (lastSignal === 'short' && nvi < pvi)) {
            return SignalResult.createSignal('close', debug);
        }
        return SignalResult.createEmptySignal(debug);
    }

    ema(values, length) {
        var k = 2 / (length + 1);
        var emaArray = [values[0]];
        for (var i = 1; i < values.length; i++) {
            emaArray.push((values[i] - emaArray[i - 1]) * k + emaArray[i - 1]);
        }
        return emaArray;
    }

    getBacktestColumns() {
        return [
            {
                label: 'atr',
                value: 'atr'
            },
            {
                label: 'roc',
                value: 'roc'
            },
            {
                label: 'pvi',
                value: 'pvi'
            },
            {
                label: 'nvi',
                value: 'nvi'
            },
            {
                label: 'emapvi',
                value: 'emapvi'
            },
            {
                label: 'emanvi',
                value: 'emanvi'
            }
        ];
    }

    getOptions() {
        return {
            period: '15m'
        };
    }
}