const SignalResult = require('../dict/signal_result');

module.exports = class Scalping {
    getName() {
        return 'Scalping';
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options.period) {
            throw Error('Invalid period');
        }
        indicatorBuilder.add('sma_short', options.ma_type, options.period, {'length':options.short_length});
        indicatorBuilder.add('sma_mid', options.ma_type, options.period, {'length':options.mid_length});
        indicatorBuilder.add('sma_long', options.ma_type, options.period, {'length':options.long_length});
        indicatorBuilder.add('stoch', 'stoch', options.period);
		// ATR for Stoploss
        indicatorBuilder.add('atr', 'atr', options.period);
		// ATR for Stoploss
    }

    period(indicatorPeriod, options) {
		const smaShortFull = indicatorPeriod.getIndicator('sma_short');
		const smaMidFull = indicatorPeriod.getIndicator('sma_mid');
		const smaLongFull = indicatorPeriod.getIndicator('sma_long');
		const smaShort = smaShortFull[smaShortFull.length - 1];
		const smaMid = smaMidFull[smaMidFull.length - 1];
		const smaLong = smaLongFull[smaLongFull.length - 1];
		const price = indicatorPeriod.getPrice();
		const stochFull = indicatorPeriod.getIndicator('stoch');
		const atrFull = indicatorPeriod.getIndicator('atr');
		const stoch = stochFull[stochFull.length - 1];
		const atr = atrFull[atrFull.length - 1];
		const lastSignal = indicatorPeriod.getLastSignal();
		const debug = {
			smaShort: smaShort,
			smaMid: smaMid,
			smaLong: smaLong,
			last_signal: lastSignal
		};
		indicatorPeriod.getStrategyContext().options.trend = 'none';
		if (
			price < smaShort && price < smaMid && price < smaLong
			)
		{
			indicatorPeriod.getStrategyContext().options.trend = 'down';
		}
		if (
			price > smaShort && price > smaMid && price > smaLong
		)
		{
			indicatorPeriod.getStrategyContext().options.trend = 'up';
		}
		debug.trend = indicatorPeriod.getStrategyContext().options.trend;
		debug.sl = indicatorPeriod.getStrategyContext().options.sl;
		debug.tp = indicatorPeriod.getStrategyContext().options.tp;
		if (indicatorPeriod.getStrategyContext().options.trend === 'up' &&
			stoch.stoch_k < 30 && !lastSignal)
		{
			indicatorPeriod.getStrategyContext().options.sl = price - atr * options.stoplossatrfactor;
			indicatorPeriod.getStrategyContext().options.tp = price + atr * options.takeprofitatrfactor;
			debug.sl = indicatorPeriod.getStrategyContext().options.sl;
			debug.tp = indicatorPeriod.getStrategyContext().options.tp;
			return SignalResult.createSignal('long', debug);
		}
		if (lastSignal === 'long' && (price < indicatorPeriod.getStrategyContext().options.sl || price > indicatorPeriod.getStrategyContext().options.tp))
		{
			if (price > indicatorPeriod.getStrategyContext().options.tp && options.useTrailingTakeProfit === 1){
				indicatorPeriod.getStrategyContext().options.sl = price - atr * options.stoplossatrfactor;
				indicatorPeriod.getStrategyContext().options.tp = price + atr * options.takeprofitatrfactor;
				debug.sl = indicatorPeriod.getStrategyContext().options.sl;
				debug.tp = indicatorPeriod.getStrategyContext().options.tp;
				return SignalResult.createEmptySignal(debug);
			}
			indicatorPeriod.getStrategyContext().options.sl = 0;
			indicatorPeriod.getStrategyContext().options.tp = 0;
			return SignalResult.createSignal('close', debug);
		}
		return SignalResult.createEmptySignal(debug);
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
                label: 'smaShort',
                value: 'smaShort',
				type: 'number'
            },
            {
                label: 'smaMid',
                value: 'smaMid',
				type: 'number'
            },
            {
                label: 'smaLong',
                value: 'smaLong',
				type: 'number'
            },
			{
                label: 'stoploss',
                value: 'sl',
				type: 'number'
            },
			{
                label: 'takeprofit',
                value: 'tp',
				type: 'number'
            },
			{
                label: 'trigger',
                value: '_trigger'
            }
        ];
    }
	getOptions() {
        return {
            period: '5m',
			ma_type: 'ema',
            short_length: '20',
            mid_length: '50',
            long_length: '100',
			useTrailingTakeProfit: 1,
			stoplossatrfactor: 1.5,
			takeprofitatrfactor: 3,
        };
    }
}