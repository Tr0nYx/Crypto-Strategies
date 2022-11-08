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
        var atr = indicatorPeriod.getLatestIndicator('atr');
        var lastCandle = indicatorPeriod.getIndicator('candles').slice(-2, -1)[0];
        var candle = indicatorPeriod.getLatestIndicator('candles');
        var candles = indicatorPeriod.getIndicator('candles');

        var tr = this.tr(candles, options.atrperiod);
        var atr2 = this.sma(tr, options.atrperiod);
        console.log("atr",atr);
        if (options.changeAtr == 1){
            atr = atr2[atr2.length - 1];
        }
        console.log("atr2",atr2);
        var up = (candle.high + candle.low) / 2 - (options.atrmultiplier * atr);
        var dn = (candle.high + candle.low) / 2 + (options.atrmultiplier * atr);
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
        }
        if (lastCandle.close < dn1) {
            indicatorPeriod.getStrategyContext().options.dn = Math.min(dn, dn1);
        }
        var prevTrend = indicatorPeriod.getStrategyContext().options.trend;
        trend = 1;
        if (!indicatorPeriod.getStrategyContext().options.trend) {
            indicatorPeriod.getStrategyContext().options.trend = trend;
        } else {
            trend = indicatorPeriod.getStrategyContext().options.trend;
        }

        if (trend === -1 && candle.close > dn1) {
            trend = 1;
        } else if (trend === 1 && candle.close < up1) {
            trend = -1;
        }
        indicatorPeriod.getStrategyContext().options.trend = trend;

        var buySignal = trend == 1 && prevTrend == -1;
        var sellSignal = trend == -1 && prevTrend == 1;

        const debug = {
            trend: trend,
            prevTrend: prevTrend
        }
        if (sellSignal){
            if (lastSignal === 'long'){
                return SignalResult.createSignal('close', debug);
            }
            if (lastSignal === 'short'){
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
        var tr = talib.execute({
            name: "TRANGE",
            high: values.high,
            low: values.low,
            close: values.close,
            startIdx: 0,
            endIdx: values.length - 1
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
/*
//@version=4
study("Supertrend", overlay = true, format=format.price, precision=2, resolution="")

Periods = input(title="ATR Period", type=input.integer, defval=10)
src = input(hl2, title="Source")
Multiplier = input(title="ATR Multiplier", type=input.float, step=0.1, defval=3.0)
changeATR= input(title="Change ATR Calculation Method ?", type=input.bool, defval=true)
showsignals = input(title="Show Buy/Sell Signals ?", type=input.bool, defval=true)
highlighting = input(title="Highlighter On/Off ?", type=input.bool, defval=true)
atr2 = sma(tr, Periods)
atr= changeATR ? atr(Periods) : atr2
up=src-(Multiplier*atr)
up1 = nz(up[1],up)
up := close[1] > up1 ? max(up,up1) : up
dn=src+(Multiplier*atr)
dn1 = nz(dn[1], dn)
dn := close[1] < dn1 ? min(dn, dn1) : dn
trend = 1
trend := nz(trend[1], trend)
trend := trend == -1 and close > dn1 ? 1 : trend == 1 and close < up1 ? -1 : trend
upPlot = plot(trend == 1 ? up : na, title="Up Trend", style=plot.style_linebr, linewidth=2, color=color.green)
buySignal = trend == 1 and trend[1] == -1
plotshape(buySignal ? up : na, title="UpTrend Begins", location=location.absolute, style=shape.circle, size=size.tiny, color=color.green, transp=0)
plotshape(buySignal and showsignals ? up : na, title="Buy", text="Buy", location=location.absolute, style=shape.labelup, size=size.tiny, color=color.green, textcolor=color.white, transp=0)
dnPlot = plot(trend == 1 ? na : dn, title="Down Trend", style=plot.style_linebr, linewidth=2, color=color.red)
sellSignal = trend == -1 and trend[1] == 1
plotshape(sellSignal ? dn : na, title="DownTrend Begins", location=location.absolute, style=shape.circle, size=size.tiny, color=color.red, transp=0)
plotshape(sellSignal and showsignals ? dn : na, title="Sell", text="Sell", location=location.absolute, style=shape.labeldown, size=size.tiny, color=color.red, textcolor=color.white, transp=0)
mPlot = plot(ohlc4, title="", style=plot.style_circles, linewidth=0)
longFillColor = highlighting ? (trend == 1 ? color.green : color.white) : color.white
shortFillColor = highlighting ? (trend == -1 ? color.red : color.white) : color.white
fill(mPlot, upPlot, title="UpTrend Highligter", color=longFillColor)
fill(mPlot, dnPlot, title="DownTrend Highligter", color=shortFillColor)
alertcondition(buySignal, title="SuperTrend Buy", message="SuperTrend Buy!")
alertcondition(sellSignal, title="SuperTrend Sell", message="SuperTrend Sell!")
changeCond = trend != trend[1]
alertcondition(changeCond, title="SuperTrend Direction Change", message="SuperTrend has changed direction!")
