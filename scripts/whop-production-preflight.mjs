// Operator-only, GET-only probe. Supply secrets via the process environment; never CLI arguments.
import { inspectProductionPlan, productionPlanExpectation } from '../server/whop-production.ts';
import { WhopError } from '../server/whop.ts';
const config = productionPlanExpectation(process.env);
if (!config) {
  console.error('WHOP_PRODUCTION_PREFLIGHT_NOT_CONFIGURED');
  process.exitCode = 1;
} else {
  try {
    const plan = await inspectProductionPlan(config);
    console.log(JSON.stringify({ check: 'production-plan', passed: true, ...plan, checkoutCreated: false, paymentCreated: false, creditGranted: false }));
  } catch (error) {
    console.error(error instanceof WhopError ? error.code : 'WHOP_PRODUCTION_PREFLIGHT_UNAVAILABLE');
    process.exitCode = 1;
  }
}
