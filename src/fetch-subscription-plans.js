import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function fetchSubscriptionPlans() {
  console.log('Fetching Active Subscription Plans from Mighty Networks...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Fetch all subscriptions (this endpoint includes plan data)
    const allSubscriptions = await mightyClient.getAllSubscriptions();
    console.log(`\nTotal subscriptions fetched: ${allSubscriptions.length}\n`);

    // Aggregate subscription plans
    const planCounts = {};
    const planDetails = {};

    for (const member of allSubscriptions) {
      const planName = member.plan?.name || 'No Plan';
      const planType = member.plan?.type || 'unknown';
      const isCanceled = !!member.subscription?.canceled_at;

      if (!planCounts[planName]) {
        planCounts[planName] = 0;
        planDetails[planName] = {
          type: planType,
          amount: member.plan?.amount || 0,
          currency: member.plan?.currency || 'usd',
          interval: member.plan?.interval || 'N/A',
          activeCount: 0,
          canceledCount: 0
        };
      }

      planCounts[planName]++;

      if (isCanceled) {
        planDetails[planName].canceledCount++;
      } else {
        planDetails[planName].activeCount++;
      }
    }

    // Sort by count (descending)
    const sortedPlans = Object.entries(planCounts)
      .sort((a, b) => b[1] - a[1]);

    // Display results
    console.log('=' .repeat(90));
    console.log('ACTIVE SUBSCRIPTION PLANS SUMMARY');
    console.log('=' .repeat(90));
    console.log('');

    // Summary table
    console.log('Plan Name'.padEnd(55) + 'Type'.padStart(12) + 'Count'.padStart(8) + 'Active'.padStart(8) + 'Canceled'.padStart(10));
    console.log('-'.repeat(93));

    let totalActive = 0;
    let totalCanceled = 0;

    for (const [planName, count] of sortedPlans) {
      const details = planDetails[planName];
      console.log(
        planName.substring(0, 54).padEnd(55) +
        details.type.padStart(12) +
        count.toString().padStart(8) +
        details.activeCount.toString().padStart(8) +
        details.canceledCount.toString().padStart(10)
      );
      totalActive += details.activeCount;
      totalCanceled += details.canceledCount;
    }

    console.log('-'.repeat(93));
    console.log(
      'TOTAL'.padEnd(55) +
      ''.padStart(12) +
      allSubscriptions.length.toString().padStart(8) +
      totalActive.toString().padStart(8) +
      totalCanceled.toString().padStart(10)
    );

    // Plan type breakdown
    console.log('\n');
    console.log('=' .repeat(90));
    console.log('PLAN TYPE BREAKDOWN');
    console.log('=' .repeat(90));
    console.log('');

    const typeBreakdown = {};
    for (const member of allSubscriptions) {
      const planType = member.plan?.type || 'unknown';
      if (!typeBreakdown[planType]) {
        typeBreakdown[planType] = 0;
      }
      typeBreakdown[planType]++;
    }

    for (const [type, count] of Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])) {
      const percentage = ((count / allSubscriptions.length) * 100).toFixed(1);
      console.log(`  ${type.padEnd(20)} ${count.toString().padStart(6)} members (${percentage}%)`);
    }

    // Premium vs Free breakdown
    console.log('\n');
    console.log('=' .repeat(90));
    console.log('PREMIUM VS FREE BREAKDOWN');
    console.log('=' .repeat(90));
    console.log('');

    let premiumCount = 0;
    let freeCount = 0;
    let canceledCount = 0;

    for (const member of allSubscriptions) {
      const planType = member.plan?.type || 'unknown';
      const isCanceled = !!member.subscription?.canceled_at;

      if (planType === 'subscription' && !isCanceled) {
        premiumCount++;
      } else if (planType === 'subscription' && isCanceled) {
        canceledCount++;
      } else {
        freeCount++;
      }
    }

    console.log(`  Premium (active paid)     ${premiumCount.toString().padStart(6)} members (${((premiumCount / allSubscriptions.length) * 100).toFixed(1)}%)`);
    console.log(`  Canceled (was paid)       ${canceledCount.toString().padStart(6)} members (${((canceledCount / allSubscriptions.length) * 100).toFixed(1)}%)`);
    console.log(`  Free/Non-paid             ${freeCount.toString().padStart(6)} members (${((freeCount / allSubscriptions.length) * 100).toFixed(1)}%)`);

    // List all unique plan names (for reference)
    console.log('\n');
    console.log('=' .repeat(90));
    console.log('UNIQUE PLAN NAMES');
    console.log('=' .repeat(90));
    console.log('');

    for (const [planName, count] of sortedPlans) {
      const details = planDetails[planName];
      const priceInfo = details.amount > 0
        ? `$${(details.amount / 100).toFixed(2)}/${details.interval}`
        : 'Free';
      console.log(`  - ${planName} (${count}) [${details.type}] ${priceInfo}`);
    }

    console.log('\nDone!');

  } catch (error) {
    console.error('Error fetching subscription plans:', error.message);
    console.error(error.stack);
  }
}

fetchSubscriptionPlans();
