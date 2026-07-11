import { IQuoteEngine, QuoteResult } from '../../interfaces/IQuoteEngine.js';

// ─── Pricing Table (edit here — never in the LLM prompt) ───────────────────
// Cost per watt-peak installed (MXN), including panels + inverter + labor + permits
const COST_PER_WP_MXN = 22;     // ~22 MXN/Wp (Q3 2025 market rate)
const PANEL_WP = 400;            // Standard 400 Wp panel
const CFE_RATE_MXN_KWH = 1.10;  // Average CFE tariff (DAC) — MXN per kWh
const SYSTEM_EFFICIENCY = 0.80;  // 80% net efficiency (inverter loss, shading, temp)
const PEAK_HOURS_DAY = 5.2;      // Average peak sun hours in Central Mexico
const EXTRA_LOAD_FACTOR = 1.25;  // 25% extra capacity if client plans new loads

export class SolarQuoteEngine implements IQuoteEngine {
  calculate(monthlyBillMxn: number, extraLoad = false): QuoteResult {
    // 1. Estimate monthly kWh from bill
    const monthlyKwh = monthlyBillMxn / CFE_RATE_MXN_KWH;

    // 2. Required system size in kWp
    let requiredKwp = monthlyKwh / (PEAK_HOURS_DAY * 30 * SYSTEM_EFFICIENCY);
    if (extraLoad) requiredKwp *= EXTRA_LOAD_FACTOR;

    // 3. Number of panels (round up)
    const panels = Math.ceil((requiredKwp * 1000) / PANEL_WP);
    const systemKwp = (panels * PANEL_WP) / 1000;

    // 4. Total cost
    const estimatedCost = Math.round(systemKwp * 1000 * COST_PER_WP_MXN / 1000) * 1000;

    // 5. Savings
    const annualSavings = monthlyBillMxn * 12 * 0.90; // 90% savings
    const monthlySavings = Math.round(annualSavings / 12);
    const roiYears = parseFloat((estimatedCost / annualSavings).toFixed(1));

    return {
      monthlyBill: monthlyBillMxn,
      panels,
      systemPowerKw: systemKwp,
      estimatedCost,
      roiYears,
      monthlySavings,
      annualSavings: Math.round(annualSavings),
      costFormatted: `$${estimatedCost.toLocaleString('es-MX')} MXN`,
      systemDescription: `${panels} paneles solares (sistema de ${systemKwp.toFixed(1)} kWp)`,
      disclaimer:
        'Este es un presupuesto preliminar. El costo final depende de la visita técnica sin costo en tu sitio (evaluación de inclinación del techo, sombras y trayectoria eléctrica).',
    };
  }
}
