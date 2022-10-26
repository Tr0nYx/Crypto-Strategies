// Source: https://www.tradingview.com/script/TpUW4muw-QQE-MOD/
// By https://www.tradingview.com/u/Mihkel00/

const SignalResult = require('../dict/signal_result');

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
		var longband = [0.0], shortband = [0.0], trend = [0], FastAtrRsiTL = 0;
		var color = '#f3f3f3';
		if (!indicatorPeriod.getStrategyContext().options.FastAtrRsiTL){
			indicatorPeriod.getStrategyContext().options.FastAtrRsiTL = [];
		}
		const lastSignal = indicatorPeriod.getLastSignal();
		var rsiFull = indicatorPeriod.getIndicator('rsi');
		var rsi = rsiFull[rsiFull.length - 1];
		var Wilders_Period = options.rsi_length * 2 - 1;
		var RsiMa = this.ema(rsiFull, options.rsi_smoothing_length);
		var AtrRsi = [];
		for (var i = 1, len = RsiMa.length - 1; i < len; i++) {
			AtrRsi[i] = Math.abs(RsiMa[i - 1] - RsiMa[i]);
		}
		AtrRsi = AtrRsi.filter(Boolean);
		var MaAtrRsi = this.ema(AtrRsi, Wilders_Period);
		var dar = this.ema(MaAtrRsi, Wilders_Period);
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
		debug.upper = upper;
		debug.lower = lower;
		if (RsiMa[RsiMa.length - 1] - 50 > upper){
			color = '#00c3ff';
		} else if (RsiMa[RsiMa.length - 1] - 50 < lower){
			color = '#ff0062';
		}
		debug.color = color;
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
	
	stdev(array, length) {
		const n = length;
		const mean = array.reduce((a, b) => a + b) / n
		return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
	}

	sma(values, period)
	{
		const res = [];
		let sum = 0;
		let count = 0;
        for (var i = 0; i < period; i++) {
			const el = values[i];
			sum += el;
			count++;
			const curr = sum / count;
			res[i] = curr;
			
        }
        return res;
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
            qqe_factor: 3,
            threshhold: 3,
			bollinger_length: 50,
			bollinger_mult: 0.35,
			useTrailingTakeProfit: 1,
			stoplossatrfactor: 1.5,
			takeprofitatrfactor: 3,
        };
    }
}