// Source: https://www.tradingview.com/script/TpUW4muw-QQE-MOD/
// By https://www.tradingview.com/u/Mihkel00/

const SignalResult = require('../dict/signal_result');
const talib = require('talib');

module.exports = class QQE_Mod {
    getName() {
        return 'QQE Mod';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('rsi', 'rsi', options.period, {'length': options.rsi_length});
        indicatorBuilder.add('rsi2', 'rsi', options.period, {'length': options.rsi_length2});
        // ATR for Stoploss
        indicatorBuilder.add('atr', 'atr', options.period);
        // ATR for Stoploss
    }

    period(indicatorPeriod, options) {
        var longband = 0, shortband = 0, FastAtrRsiTL = 0;
        var color = '#f3f3f3';
        if (!indicatorPeriod.getStrategyContext().options.FastAtrRsiTL) {
            indicatorPeriod.getStrategyContext().options.FastAtrRsiTL = [];
        }
        if (!indicatorPeriod.getStrategyContext().options.trend) {
            indicatorPeriod.getStrategyContext().options.trend = [0];
        }
        if (!indicatorPeriod.getStrategyContext().options.trend2) {
            indicatorPeriod.getStrategyContext().options.trend2 = [0];
        }
        if (!indicatorPeriod.getStrategyContext().options.longband) {
            indicatorPeriod.getStrategyContext().options.longband = [0];
        }
        if (!indicatorPeriod.getStrategyContext().options.shortband) {
            indicatorPeriod.getStrategyContext().options.shortband = [0];
        }
        const lastSignal = indicatorPeriod.getLastSignal();
        var rsiFull = indicatorPeriod.getIndicator('rsi');
        if (rsiFull.length < options.rsi_length) {
            return SignalResult.createEmptySignal();
        }

        var rsi = rsiFull[rsiFull.length - 1];

        var Wilders_Period = options.rsi_length * 2 - 1;
        if (rsiFull.length < options.rsi_smoothing_length) {
            return SignalResult.createEmptySignal();
        }
        var RsiMa = this.ema(rsiFull, options.rsi_smoothing_length);
        var AtrRsi = [];
        for (var i = 0, len = RsiMa.length; i <= len; i++) {
            AtrRsi[i] = Math.abs(RsiMa[i - 2] - RsiMa[i - 1]);
        }
        AtrRsi = AtrRsi.filter(Boolean);
		
        var MaAtrRsi = this.ema(AtrRsi, Wilders_Period);
        var dar = this.ema(MaAtrRsi, Wilders_Period);
        var DeltaFastAtrRsi = dar[dar.length - 1] * options.qqe_factor;
        var RSIndex = RsiMa;
        RSIndex = RSIndex.filter(Boolean);

        var newshortband = RSIndex[RSIndex.length - 1] + DeltaFastAtrRsi;
        var newlongband = RSIndex[RSIndex.length - 1] - DeltaFastAtrRsi;
        if (RSIndex[RSIndex.length - 2] > indicatorPeriod.getStrategyContext().options.longband && RSIndex[RSIndex.length - 1] > indicatorPeriod.getStrategyContext().options.longband) {
            longband = Math.max(indicatorPeriod.getStrategyContext().options.longband, newlongband);
        } else {
            longband = newlongband;
        }
        if (RSIndex[RSIndex.length - 2] < indicatorPeriod.getStrategyContext().options.shortband && RSIndex[RSIndex.length - 1] < indicatorPeriod.getStrategyContext().options.shortband) {
            shortband = Math.min(indicatorPeriod.getStrategyContext().options.shortband, newshortband);
        } else {
            shortband = newshortband;
        }
        var cross_1 = this.cross(indicatorPeriod.getStrategyContext().options.longband, RSIndex[RSIndex.length - 1], RSIndex[RSIndex.length - 2]);
        var trend_cross = this.cross(RSIndex[RSIndex.length - 1], indicatorPeriod.getStrategyContext().options.shortband, shortband);
        var trend = indicatorPeriod.getStrategyContext().options.trend;
        if (trend_cross === true) {
            trend.push(1);
        } else {
            if (cross_1 === true) {
                trend.push(-1);
            } else {
                trend.push(trend[trend.length - 1]);
            }
        }

        var val;

        if (trend[trend.length - 1] === 1) {
            val = longband - 50;
            indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.push(val);
        } else {
            val = shortband - 50;
            indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.push(val);
        }
        FastAtrRsiTL = indicatorPeriod.getStrategyContext().options.FastAtrRsiTL;
        indicatorPeriod.getStrategyContext().options.longband = longband;
        indicatorPeriod.getStrategyContext().options.shortband = shortband;
        const debug = {
            DeltaFastAtrRsi: DeltaFastAtrRsi,
            shortband: shortband,
            longband: longband,
            AtrRsi: AtrRsi[AtrRsi.length - 1],
            RSIndex: RSIndex[RSIndex.length - 1],
            RsiMa: RsiMa[RsiMa.length - 1],
            MaAtrRsi: MaAtrRsi[MaAtrRsi.length - 1],
            rsi: rsi,
            trend: trend[trend.length - 1],
            FastAtrRsiTL: FastAtrRsiTL[FastAtrRsiTL.length - 1] + 50
        };
        if (FastAtrRsiTL.length < options.bollinger_length) {
            return SignalResult.createEmptySignal(debug);
        }
        var basis = this.sma(FastAtrRsiTL, options.bollinger_length);

        var dev = options.bollinger_mult * this.stdev(FastAtrRsiTL, options.bollinger_length);
        var upper = basis[basis.length - 1] + dev;
        var lower = basis[basis.length - 1] - dev;

        if (indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.length > options.bollinger_length) {
            indicatorPeriod.getStrategyContext().options.FastAtrRsiTL = indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.slice(options.bollinger_length * -1);
        }
        debug.dev = dev;
        debug.upper = upper;
        debug.lower = lower;
        debug.basis = basis[basis.length - 1];


        // QQE2
        Wilders_Period2 = options.rsi_length2 * 2 - 1

        var rsi2Full = indicatorPeriod.getIndicator('rsi2');
        if (rsi2Full.length < options.rsi_length2) {
            return SignalResult.createEmptySignal();
        }
        var rsi2 = rsi2Full[rsi2Full.length - 1];
        var Wilders_Period2 = options.rsi_length2 * 2 - 1;
        var RsiMa2 = this.ema(rsi2Full, options.rsi_smoothing_length2);
        var AtrRsi2 = [];
        for (var i = 0, len = RsiMa2.length; i <= len; i++) {
            AtrRsi2[i] = Math.abs(RsiMa2[i - 2] - RsiMa2[i - 1]);
        }
        AtrRsi2 = AtrRsi2.filter(Boolean);
        var MaAtrRsi2 = this.ema(AtrRsi2, Wilders_Period2);
        var dar2 = this.ema(MaAtrRsi2, Wilders_Period2);
        var DeltaFastAtrRsi2 = dar2[dar2.length - 1] * options.qqe_factor2;
        var RSIndex2 = RsiMa2;

        var longband2 = 0;
        var shortband2 = 0;

        var newshortband2 = RSIndex2[RSIndex2.length - 1] + DeltaFastAtrRsi2;
        var newlongband2 = RSIndex2[RSIndex2.length - 1] - DeltaFastAtrRsi2;
        if (RSIndex2[RSIndex2.length - 2] > indicatorPeriod.getStrategyContext().options.longband2 && RSIndex2[RSIndex2.length - 1] > indicatorPeriod.getStrategyContext().options.longband2) {
            longband2 = Math.max(indicatorPeriod.getStrategyContext().options.longband2, newlongband2);
        } else {
            longband2 = newlongband2;
        }
        if (RSIndex2[RSIndex2.length - 2] < indicatorPeriod.getStrategyContext().options.shortband2 && RSIndex2[RSIndex2.length - 1] < indicatorPeriod.getStrategyContext().options.shortband2) {
            shortband2 = Math.min(indicatorPeriod.getStrategyContext().options.shortband2, newshortband2);
        } else {
            shortband2 = newshortband2;
        }

        var cross_2 = this.cross(indicatorPeriod.getStrategyContext().options.longband2, RSIndex2[RSIndex2.length - 1], RSIndex2[RSIndex2.length - 2]);
        var trend2_cross = this.cross(RSIndex2[RSIndex2.length - 1], indicatorPeriod.getStrategyContext().options.shortband2, shortband2);

        var trend2 = indicatorPeriod.getStrategyContext().options.trend2;
        if (trend2_cross === true) {
            trend2.push(1);
        } else {
            if (cross_2 === true) {
                trend2.push(-1);
            } else {
                trend2.push(trend2[trend2.length - 1]);
            }
        }
        debug.AtrRsi2 = AtrRsi2[AtrRsi2.length - 1];
        debug.MaAtrRsi2 = MaAtrRsi2[MaAtrRsi2.length - 1];
        debug.upper = upper;
        debug.lower = lower;
        debug.DeltaFastAtrRsi2 = DeltaFastAtrRsi2;

        var FastAtrRsi2TL = trend2[trend2.length - 1] === 1 ? longband2 : shortband2;

        indicatorPeriod.getStrategyContext().options.longband2 = longband2;
        indicatorPeriod.getStrategyContext().options.shortband2 = shortband2;

        var signalLine = FastAtrRsi2TL - 50;
        var Greenbar1 = RsiMa2[RsiMa2.length - 1] - 50 > options.threshhold2
        var Greenbar2 = RsiMa[RsiMa.length - 1] - 50 > upper

        var Redbar1 = RsiMa2[RsiMa2.length - 1] - 50 < 0 - options.threshhold2
        var Redbar2 = RsiMa[RsiMa.length - 1] - 50 < lower
        if (Greenbar1 && Greenbar2) {
            color = '#00c3ff';
        } else if (Redbar1 && Redbar2) {
            color = '#ff0062';
        }
        debug.color = color;
        debug.signalLine = signalLine;
        debug.RsiMa2 = RsiMa2[RsiMa2.length - 1];
        indicatorPeriod.getStrategyContext().options.trend = trend;
        indicatorPeriod.getStrategyContext().options.trend2 = trend2;

        /** Calc Trailing StopLoss START */
        if (options.useSLTP === 1) {
            var slsignal = this.calcTrailingStopLoss(indicatorPeriod, options, lastSignal, debug);
            if (slsignal === 'close') {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
        }
        var atr = indicatorPeriod.getLatestIndicator('atr');
        /** Calc Trailing StopLoss END */
        if (!lastSignal && color === '#00c3ff') {
            indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() - (atr[atr.length - 1] * options.stoplossatrfactor);
            return SignalResult.createSignal('long', debug);
        }
        if (!lastSignal && color === '#ff0062' && options.only_long === 0) {
            indicatorPeriod.getStrategyContext().options.sl = indicatorPeriod.getPrice() + (atr[atr.length - 1] * options.stoplossatrfactor);
            return SignalResult.createSignal('short', debug);
        }
        if (lastSignal) {
            if (lastSignal === 'long' && (color === '#ff0062' || (options.exitongrey === 1 && color === '#f3f3f3'))) {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
            if (lastSignal === 'short' && (color === '#00c3ff' || (options.exitongrey === 1 && color === '#f3f3f3'))) {
                indicatorPeriod.getStrategyContext().options.sl = 0;
                indicatorPeriod.getStrategyContext().options.high_watermark = 0;
                return SignalResult.createSignal('close', debug);
            }
        }
        return SignalResult.createEmptySignal(debug);
    }

    stdev(values, length) {
        var stddev = talib.execute({
            name: "STDDEV",
            startIdx: 0,
            endIdx: length,
            inReal: values,
            optInTimePeriod: length,
            optInNbDev: 1
        });
        return stddev.result.outReal[0];
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

    ema(values, length) {
		var k = 2 / (length + 1);
        var emaArray = [values[0]];
        for (var i = 1; i < values.length; i++) {
            emaArray.push((values[i] - emaArray[i - 1]) * k + emaArray[i - 1]);
        }
        return emaArray;
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

    cross(val, actValue, prevValue) {
        return (val <= prevValue && val >= actValue) || (val >= prevValue && val <= actValue);
    }

    getBacktestColumns() {
        return [
            {
                label: 'trend',
                value: 'trend',
                type: 'number'
            },
            {
                label: 'signalLine',
                value: 'signalLine',
                type: 'number'
            },
            {
                label: 'color',
                value: 'color',
                type: 'color'
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

        ];
    }

    getOptions() {
        return {
            period: '1h',
            only_long: 1,
            rsi_length: 6,
            rsi_smoothing_length: 5,
            qqe_factor: 3,
            threshhold: 3,
            bollinger_length: 50,
            bollinger_mult: 0.35,
            rsi_length2: 6,
            rsi_smoothing_length2: 5,
            qqe_factor2: 1.61,
            threshhold2: 3,
            exitongrey: 1,
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