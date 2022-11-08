const SignalResult = require('../dict/signal_result');
const talib = require('talib');

module.exports = class ADX_DI {
    getName() {
        return 'ADX DI';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('adx', 'adx', options.period, {
            length: options.length
        });
    }

    period(indicatorPeriod, options) {
        let debug;
        if (!indicatorPeriod.getStrategyContext().options.SmoothedTrueRange) {
            indicatorPeriod.getStrategyContext().options.SmoothedTrueRange = 0.0
        }
        if (!indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementPlus) {
            indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementPlus = 0.0
        }
        if (!indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementMinus) {
            indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementMinus = 0.0
        }
        if (!indicatorPeriod.getStrategyContext().options.DX) {
            indicatorPeriod.getStrategyContext().options.DX = [];
        }
        var candlesFull = indicatorPeriod.getIndicator('candles');

        if (candlesFull.length < options.length) {
            return;
        }
        var candle = candlesFull.slice(-1)[0];
        var prevcandle = candlesFull.slice(-2)[0];

        var TrueRange = Math.max(Math.max(candle.high - candle.low, Math.abs(candle.high - prevcandle.close)), Math.abs(candle.low - prevcandle.close));
        var DirectionalMovementPlus = candle.high - prevcandle.high > prevcandle.low - candle.low ? Math.max(candle.high - prevcandle.high, 0) : 0;
        var DirectionalMovementMinus = prevcandle.low - candle.low > candle.high - prevcandle.high ? Math.max(prevcandle.low - candle.low, 0) : 0;
        var SmoothedTrueRange = indicatorPeriod.getStrategyContext().options.SmoothedTrueRange;

        SmoothedTrueRange = SmoothedTrueRange - (SmoothedTrueRange / options.length) + TrueRange;
        indicatorPeriod.getStrategyContext().options.SmoothedTrueRange = SmoothedTrueRange;

        var SmoothedDirectionalMovementPlus = indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementPlus;
        SmoothedDirectionalMovementPlus = SmoothedDirectionalMovementPlus - (SmoothedDirectionalMovementPlus / options.length) + DirectionalMovementPlus;
        indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementPlus = SmoothedDirectionalMovementPlus;

        var SmoothedDirectionalMovementMinus = indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementMinus;
        SmoothedDirectionalMovementMinus = SmoothedDirectionalMovementMinus - (SmoothedDirectionalMovementMinus / options.length) + DirectionalMovementMinus;
        indicatorPeriod.getStrategyContext().options.SmoothedDirectionalMovementMinus = SmoothedDirectionalMovementMinus;
        var DIPlus = SmoothedDirectionalMovementPlus / SmoothedTrueRange * 100;
        var DIMinus = SmoothedDirectionalMovementMinus / SmoothedTrueRange * 100;
        var DX = Math.abs(DIPlus - DIMinus) / (DIPlus + DIMinus) * 100;
        if (Number.isNaN(DX)) {
            return SignalResult.createEmptySignal(debug);
        }
        indicatorPeriod.getStrategyContext().options.DX.push(DX);
        if (indicatorPeriod.getStrategyContext().options.DX.length < options.length) {
            return SignalResult.createEmptySignal(debug);
        }
        const lastSignal = indicatorPeriod.getLastSignal();
        var ADX = this.sma(indicatorPeriod.getStrategyContext().options.DX, options.length);

        debug = {
            'DIPlus': DIPlus,
            'DIMinus': DIMinus,
            'ADX': ADX[ADX.length - 1],
            'lastSignal': lastSignal
        }
        if (DIPlus > DIMinus) {
            if (ADX[ADX.length - 1] < options.adx_signal) {
                debug.trend = 'up';
                if (!lastSignal) {
                    return SignalResult.createSignal('long', debug);
                }
            }
            if (lastSignal === 'short') {
                return SignalResult.createSignal('close', debug);
            }
        }
        if (DIMinus > DIPlus) {
            if (ADX[ADX.length - 1] < options.adx_signal) {
                debug.trend = 'down';
                if (!lastSignal) {
                    return SignalResult.createSignal('short', debug);
                }
            }
            if (lastSignal === 'long') {
                return SignalResult.createSignal('close', debug);
            }
        }
        return SignalResult.createEmptySignal(debug);
    }

    sma(values, length) {
        var sma = talib.execute({
            name: "SMA",
            startIdx: 0,
            endIdx: values.length - 1,
            inReal: values,
            optInTimePeriod: length
        });
        return sma.result.outReal;
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
                label: 'DIPlus',
                value: 'DIPlus'
            },
            {
                label: 'DIMinus',
                value: 'DIMinus'
            },
            {
                label: 'ADX',
                value: 'ADX'
            }
        ];
    }

    getOptions() {
        return {
            period: '15m',
            length: 14,
            adx_signal: 20
        };
    }
}