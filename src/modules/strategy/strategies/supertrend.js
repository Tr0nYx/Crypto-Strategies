// Source: https://www.tradingview.com/script/r6dAP7yi/
// By https://www.tradingview.com/u/KivancOzbilgic/

const SignalResult = require('../dict/signal_result');
const talib = require('talib');

module.exports = class SuperTrend {
    getName() {
        return 'SuperTrend';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('rsi', 'rsi', options.period, {'length': options.rsi_length});
        indicatorBuilder.add('atr', 'atr', options.period, {'length': options.atrperiod});
    }

    period(indicatorPeriod, options) {
        var up1, dn1, trend;
        const lastSignal = indicatorPeriod.getLastSignal();
        var lastCandle = indicatorPeriod.getIndicator('candles').slice(-2, -1)[0];
        var candle = indicatorPeriod.getLatestIndicator('candles');
        var candles = indicatorPeriod.getIndicator('candles').slice(options.atrperiod * - 1);
        var src = (candle.high + candle.low) / 2;
        var atr = Math.max(Math.max(candle.high-candle.low, Math.abs(candle.high-lastCandle.close)), Math.abs(candle.low-lastCandle.close));
        if (options.changeAtr === 1){
            atr= indicatorPeriod.getLatestIndicator('atr');
        }

        var up = src - (options.atrmultiplier * atr);
        var dn = src + (options.atrmultiplier * atr);
        if (!indicatorPeriod.getStrategyContext().options.up) {
            up1 = up;
        } else {
            up1 = indicatorPeriod.getStrategyContext().options.up;
        }
        if (!indicatorPeriod.getStrategyContext().options.dn) {
            dn1 = dn;
        } else {
            dn1 = indicatorPeriod.getStrategyContext().options.dn;
        }
        if (lastCandle.close > up1) {
            indicatorPeriod.getStrategyContext().options.up = Math.max(up, up1);
        } else {
            indicatorPeriod.getStrategyContext().options.up = up;
        }
        if (lastCandle.close < dn1) {
            indicatorPeriod.getStrategyContext().options.dn = Math.min(dn, dn1);
        } else {
            indicatorPeriod.getStrategyContext().options.dn = dn;
        }
        var prevTrend = indicatorPeriod.getStrategyContext().options.trend;
        trend = 1;
        if (!indicatorPeriod.getStrategyContext().options.trend) {
            indicatorPeriod.getStrategyContext().options.trend = trend;
        }
        trend = indicatorPeriod.getStrategyContext().options.trend;
        if (trend === -1 && candle.close > dn1) {
            trend = 1;
        } else if (trend === 1 && candle.close < up1) {
            trend = -1;
        }
        indicatorPeriod.getStrategyContext().options.trend = trend;

        var buySignal = trend === 1 && prevTrend === -1;
        var sellSignal = trend === -1 && prevTrend === 1;

        const debug = {
            trend: trend,
            prevTrend: prevTrend,
            dn1: dn1,
            up1: up1,
            close: candle.close,
            buySignal: buySignal,
            sellSignal: sellSignal,
        }
        if (trend === 1 && !lastSignal){
            return SignalResult.createSignal('long', debug);
        }
        if (trend === -1 && !lastSignal){
            return SignalResult.createSignal('short', debug);
        }
        if (sellSignal){
            if (lastSignal === 'long'){
                return SignalResult.createSignal('close', debug);
            }
            if (lastSignal !== 'short'){
                return SignalResult.createSignal('short', debug);
            }
        } else if (buySignal){
            if (lastSignal === 'short'){
                return SignalResult.createSignal('close', debug);
            }
            if (lastSignal !== 'long'){
                return SignalResult.createSignal('long', debug);
            }
        }
        return SignalResult.createEmptySignal(debug);
    }

    tr(values, length){
        console.log(values.length);
        var tr = talib.execute({
            name: "TRANGE",
            high: values.high,
            low: values.low,
            close: values.close,
            startIdx: 0,
            endIdx: length
        });

        return tr.result.outReal;
    }

    sma(values, length)
    {
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
                    return row.trend === 1 ? 'success' : 'danger';
                },
                type: 'icon'
            },
            {
                label: 'prevTrend',
                value: row => {
                    return row.prevTrend === 1 ? 'success' : 'danger';
                },
                type: 'icon'
            },
            {
                label: 'up1',
                value: 'up1'
            },
            {
                label: 'dn1',
                value: 'dn1'
            },
            {
                label: 'close',
                value: 'close'
            },
            {
                label: 'buySignal',
                value: 'buySignal'
            },
            {
                label: 'sellSignal',
                value: 'sellSignal'
            }
        ]
    }

    getOptions() {
        return {
            period: '15m',
            changeAtr: 1,
            atrperiod: 10,
            atrmultiplier: 3
        };
    }
}