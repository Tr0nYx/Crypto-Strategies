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
		if (!indicatorPeriod.getStrategyContext().options.FastAtrRsiTL){
			indicatorPeriod.getStrategyContext().options.FastAtrRsiTL = [];
		}
		if (!indicatorPeriod.getStrategyContext().options.trend){
			indicatorPeriod.getStrategyContext().options.trend = [0];
		}
		if (!indicatorPeriod.getStrategyContext().options.trend2){
			indicatorPeriod.getStrategyContext().options.trend2 = [0];
		}
		const lastSignal = indicatorPeriod.getLastSignal();
		var rsiFull = indicatorPeriod.getIndicator('rsi').slice(options.rsi_length * - 1);
		var rsi = rsiFull[rsiFull.length - 1];
		var Wilders_Period = options.rsi_length * 2 - 1;
		var RsiMa = this.ema(rsiFull.reverse(), options.rsi_smoothing_length);
		var AtrRsi = [];
		for (var i = 0, len = Wilders_Period; i < len; i++) {
			AtrRsi[i] = Math.abs(RsiMa[i - 1] - RsiMa[i]);
		}
		AtrRsi = AtrRsi.filter(Boolean);
		var MaAtrRsi = this.ema(AtrRsi, Wilders_Period);
		var dar = this.ema(MaAtrRsi, Wilders_Period);
		dar = dar.reverse();
		var DeltaFastAtrRsi = dar[dar.length - 1] * options.qqe_factor;
		var RSIndex = RsiMa;

		var newshortband = RSIndex[RSIndex.length - 1] + DeltaFastAtrRsi;
		var newlongband = RSIndex[RSIndex.length - 1] - DeltaFastAtrRsi;
		if (RSIndex[RSIndex.length - 2] > indicatorPeriod.getStrategyContext().options.longband && RSIndex[RSIndex.length - 1] > indicatorPeriod.getStrategyContext().options.longband){
			longband = Math.max(indicatorPeriod.getStrategyContext().options.longband, newlongband);
		} else {
			longband = newlongband;
		}
		if (RSIndex[RSIndex.length - 2] < indicatorPeriod.getStrategyContext().options.shortband && RSIndex[RSIndex.length - 1] < indicatorPeriod.getStrategyContext().options.shortband) {
			shortband = Math.min(indicatorPeriod.getStrategyContext().options.shortband, newshortband);
		} else {
			shortband = newshortband;
		}

		var cross_1 = indicatorPeriod.getStrategyContext().options.longband < RSIndex[RSIndex.length - 1] && longband > RSIndex[RSIndex.length - 1];
		var trend_cross = RSIndex[RSIndex.length - 1] < indicatorPeriod.getStrategyContext().options.shortband && RSIndex[RSIndex.length - 1] > shortband;
		var trend = indicatorPeriod.getStrategyContext().options.trend;
		if (trend_cross === true){
			trend.push(1);
		} else {
			if (cross_1 === true){
				trend.push(-1);
			} else {
				trend.push(trend[trend.length - 1]);
			}
		}
		var val;

		if (trend[trend.length - 1] === 1){
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
			dar: DeltaFastAtrRsi,
			shortband: shortband,
			longband: longband,
			FastAtrRsiTL: FastAtrRsiTL[FastAtrRsiTL.length - 1]
		};
		if (indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.length < options.bollinger_length){
			return SignalResult.createEmptySignal(debug);
		}

		var basis = this.sma(FastAtrRsiTL, options.bollinger_length);

		var dev = options.bollinger_mult * this.stdev(FastAtrRsiTL, options.bollinger_length);
		var upper = basis[basis.length - 1] + dev;
		var lower = basis[basis.length - 1] - dev;
		if (indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.length > options.bollinger_length){
			indicatorPeriod.getStrategyContext().options.FastAtrRsiTL = indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.slice(options.bollinger_length * -1);
		}
		debug.upper = upper;
		debug.lower = lower;

		// QQE2
		Wilders_Period2 = options.rsi_length2 * 2 - 1

		var rsi2Full = indicatorPeriod.getIndicator('rsi2').slice(options.rsi_length2 * - 1);
		var rsi2 = rsi2Full[rsi2Full.length - 1];
		var Wilders_Period2 = options.rsi_length2 * 2 - 1;
		var RsiMa2 = this.ema(rsi2Full.reverse(), options.rsi_smoothing_length2);
		var AtrRsi2 = [];
		for (var i = 0, len = Wilders_Period2; i < len; i++) {
			AtrRsi2[i] = Math.abs(RsiMa2[i - 1] - RsiMa2[i]);
		}
		AtrRsi2 = AtrRsi2.filter(Boolean);
		var MaAtrRsi2 = this.ema(AtrRsi2, Wilders_Period2);
		var dar2 = this.ema(MaAtrRsi2, Wilders_Period2);
		dar2 = dar2.reverse();
		var DeltaFastAtrRsi2 = dar2[dar2.length - 1] * options.qqe_factor2;
		var RSIndex2 = RsiMa2;

		var longband2 = 0;
		var shortband2 = 0;
		//var trend2 = 0;
		var newshortband2 = RSIndex2[RSIndex2.length - 1] + DeltaFastAtrRsi2;
		var newlongband2 = RSIndex2[RSIndex2.length - 1] - DeltaFastAtrRsi2;
		if (RSIndex2[RSIndex2.length - 2] > indicatorPeriod.getStrategyContext().options.longband2 && RSIndex2[RSIndex2.length - 1] > indicatorPeriod.getStrategyContext().options.longband2){
			longband2 = Math.max(indicatorPeriod.getStrategyContext().options.longband2, newlongband2);
		} else {
			longband2 = newlongband2;
		}
		if (RSIndex2[RSIndex2.length - 2] < indicatorPeriod.getStrategyContext().options.shortband2 && RSIndex2[RSIndex2.length - 1] < indicatorPeriod.getStrategyContext().options.shortband2) {
			shortband2 = Math.min(indicatorPeriod.getStrategyContext().options.shortband2, newshortband2);
		} else {
			shortband2 = newshortband2;
		}

		var cross_2 = indicatorPeriod.getStrategyContext().options.longband2 < RSIndex2[RSIndex2.length - 1] && longband2 > RSIndex2[RSIndex2.length - 1];
		var trend2_cross = RSIndex2[RSIndex2.length - 1] < indicatorPeriod.getStrategyContext().options.shortband2 && RSIndex2[RSIndex2.length - 1] > shortband2;

		var trend2 = indicatorPeriod.getStrategyContext().options.trend2;
		if (trend2_cross === true){
			trend2.push(1);
		} else {
			if (cross_2 === true){
				trend2.push(-1);
			} else {
				trend2.push(trend2[trend2.length - 1]);
			}
		}

		var FastAtrRsi2TL = trend2[trend2.length - 1] === 1 ? longband2 : shortband2;

		indicatorPeriod.getStrategyContext().options.longband2 = longband2;
		indicatorPeriod.getStrategyContext().options.shortband2 = shortband2;

		var signalLine = FastAtrRsi2TL - 50;
		var Greenbar1 = RsiMa2[RsiMa2.length - 1] - 50 > options.threshhold2
		var Greenbar2 = RsiMa[RsiMa.length - 1] - 50 > upper

		var Redbar1 = RsiMa2[RsiMa2.length - 1] - 50 < 0 - options.threshhold2
		var Redbar2 = RsiMa[RsiMa.length - 1] - 50 < lower
		if (Greenbar1 && Greenbar2){
			color = '#00c3ff';
		} else if (Redbar1 && Redbar2){
			color = '#ff0062';
		}
		debug.color = color;
		debug.signalLine = signalLine;
		indicatorPeriod.getStrategyContext().options.trend = trend;
		indicatorPeriod.getStrategyContext().options.trend2 = trend2;
		if (!lastSignal && color === '#00c3ff'){
			return SignalResult.createSignal('long', debug);
		}
		if (!lastSignal && color === '#ff0062' && options.only_long === 0){
			return SignalResult.createSignal('short', debug);
		}
		if (lastSignal){
			if (lastSignal === 'long' && (color === '#ff0062' || color === '#f3f3f3')){
				return SignalResult.createSignal('close', debug);
			}
			if (lastSignal === 'short' && (color === '#00c3ff' || color === '#f3f3f3')){
				return SignalResult.createSignal('close', debug);
			}
		}
		return SignalResult.createEmptySignal(debug);
	}

	stdev(values, length) {
		var stddev = talib.execute({
			name: "STDDEV",
			startIdx: 0,
			endIdx: values.length - 1,
			inReal: values,
			optInTimePeriod: length,
			optInNbDev: 1
		});
		return stddev.result.outReal[0];
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
	ema(values, period) {

		var k = 2 / (period + 1);
		var emaArray = [values[0]];
		for (var i = 1; i < values.length; i++) {
			emaArray.push((values[i] - emaArray[i - 1]) * k + emaArray[i - 1]);
		}
		return emaArray;
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
				label: 'dar',
				value: 'dar',
				type: 'number'
			},
			{
				label: 'shortband',
				value: 'shortband',
				type: 'number'
			},
			{
				label: 'longband',
				value: 'longband',
				type: 'number'
			},
			{
				label: 'FastAtrRsiTL',
				value: 'FastAtrRsiTL',
				type: 'number'
			},
			{
				label: 'upper',
				value: 'upper',
				type: 'number'
			},
			{
				label: 'lower',
				value: 'lower',
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
				label: 'trigger',
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
			qqe_factor: 1.61,
			threshhold: 3,
			rsi_length2: 6,
			rsi_smoothing_length2: 5,
			qqe_factor2: 1.61,
			threshhold2: 3,
			bollinger_length: 50,
			bollinger_mult: 0.35,
			useTrailingTakeProfit: 1,
			stoplossatrfactor: 1.5,
			takeprofitatrfactor: 3,
		};
	}
}