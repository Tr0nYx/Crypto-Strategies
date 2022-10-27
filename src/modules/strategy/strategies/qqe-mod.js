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
		// ATR for Stoploss
		indicatorBuilder.add('atr', 'atr', options.period);
		// ATR for Stoploss
	}

	period(indicatorPeriod, options) {
		var longband = [], shortband = [], FastAtrRsiTL = 0;
		var color = '#f3f3f3';
		if (!indicatorPeriod.getStrategyContext().options.FastAtrRsiTL){
			indicatorPeriod.getStrategyContext().options.FastAtrRsiTL = [];
		}
		if (!indicatorPeriod.getStrategyContext().options.trend){
			indicatorPeriod.getStrategyContext().options.trend = [0];
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
			longband.push(Math.max(indicatorPeriod.getStrategyContext().options.longband, newlongband));
		} else {
			longband.push(newlongband);
		}
		if (RSIndex[RSIndex.length - 2] < indicatorPeriod.getStrategyContext().options.shortband && RSIndex[RSIndex.length - 1] < indicatorPeriod.getStrategyContext().options.shortband) {
			shortband.push(Math.max(indicatorPeriod.getStrategyContext().options.shortband, newshortband));
		} else {
			shortband.push(newshortband);
		}

		var cross_1 = indicatorPeriod.getStrategyContext().options.longband < RSIndex[RSIndex.length - 1] && longband > RSIndex[RSIndex.length - 1];
		var cross_2 = RSIndex[RSIndex.length - 1] < indicatorPeriod.getStrategyContext().options.shortband && RSIndex[RSIndex.length - 1] > shortband;

		var trend = indicatorPeriod.getStrategyContext().options.trend;
		if (cross_2 === true){
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
			val = longband[longband.length - 1] - 50;
			indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.push(val);
		} else {
			val = shortband[shortband.length - 1] - 50;
			indicatorPeriod.getStrategyContext().options.FastAtrRsiTL.push(val);
		}
		FastAtrRsiTL = indicatorPeriod.getStrategyContext().options.FastAtrRsiTL;
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
		var signalLine = RsiMa[RsiMa.length - 1] - 50;
		if (signalLine > upper && signalLine > options.threshhold){
			color = '#00c3ff';
		} else if (signalLine < lower && signalLine - options.threshhold){
			color = '#ff0062';
		}
		debug.color = color;
		debug.signalLine = signalLine;
		indicatorPeriod.getStrategyContext().options.trend = trend;
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
			bollinger_length: 50,
			bollinger_mult: 0.35,
			useTrailingTakeProfit: 1,
			stoplossatrfactor: 1.5,
			takeprofitatrfactor: 3,
		};
	}
}