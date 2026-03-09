import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function checkCancellationData() {
  console.log('Checking cancellation data in HubSpot...\n');

  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Search for contacts with cancellation data
    const searchResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'mighty_canceled_at',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: [
        'email',
        'firstname',
        'lastname',
        'mighty_canceled_at',
        'mighty_days_since_cancellation',
        'mighty_plan_name',
        'mighty_plan_price',
        'mighty_subscription_status'
      ],
      sorts: [
        {
          propertyName: 'mighty_canceled_at',
          direction: 'DESCENDING'
        }
      ],
      limit: 100
    });

    const totalCanceled = searchResponse.total;
    const contacts = searchResponse.results;

    console.log('='.repeat(70));
    console.log('              CANCELLATION DATA SUMMARY');
    console.log('='.repeat(70));
    console.log(`\nTotal contacts with cancellation data: ${totalCanceled}\n`);

    if (totalCanceled === 0) {
      console.log('No contacts found with cancellation data.');
      console.log('\nThis could mean:');
      console.log('  1. No members have canceled their subscriptions');
      console.log('  2. Canceled members were deleted before we started tracking');
      console.log('  3. The sync hasn\'t run since we added cancellation tracking\n');
      console.log('Run: npm run sync-subscriptions\n');
      return;
    }

    // Analyze cancellation timing
    const daysSinceMap = new Map();
    let recentCancellations = 0; // Last 30 days
    let mediumTerm = 0; // 31-90 days
    let longTerm = 0; // 90+ days

    for (const contact of contacts) {
      const daysSince = contact.properties.mighty_days_since_cancellation;
      if (daysSince) {
        const days = parseInt(daysSince);
        if (days <= 30) recentCancellations++;
        else if (days <= 90) mediumTerm++;
        else longTerm++;
      }
    }

    console.log('-'.repeat(70));
    console.log('CANCELLATION TIMELINE');
    console.log('-'.repeat(70));
    console.log(`Last 30 days:      ${recentCancellations} cancellations`);
    console.log(`31-90 days ago:    ${mediumTerm} cancellations`);
    console.log(`90+ days ago:      ${longTerm} cancellations`);
    console.log('');

    // Show recent cancellations (sample)
    console.log('-'.repeat(70));
    console.log('RECENT CANCELLATIONS (Most Recent First)');
    console.log('-'.repeat(70));
    console.log('');

    const sampleSize = Math.min(10, contacts.length);
    for (let i = 0; i < sampleSize; i++) {
      const contact = contacts[i];
      const props = contact.properties;

      const email = props.email || 'No email';
      const name = [props.firstname, props.lastname].filter(Boolean).join(' ') || 'No name';
      const canceledDate = props.mighty_canceled_at || 'Unknown';
      const daysSince = props.mighty_days_since_cancellation || 'Unknown';
      const planName = props.mighty_plan_name || 'Unknown';
      const planPrice = props.mighty_plan_price || 'Unknown';
      const status = props.mighty_subscription_status || 'Unknown';

      console.log(`${i + 1}. ${name} (${email})`);
      console.log(`   Plan: ${planName} - ${planPrice}`);
      console.log(`   Canceled: ${canceledDate} (${daysSince} days ago)`);
      console.log(`   Status: ${status}`);
      console.log('');
    }

    // Win-back campaign suggestions
    console.log('='.repeat(70));
    console.log('WIN-BACK CAMPAIGN OPPORTUNITIES');
    console.log('='.repeat(70));
    console.log('');

    if (recentCancellations > 0) {
      console.log(`✓ Recent cancellations (0-30 days): ${recentCancellations} contacts`);
      console.log('  → High-priority win-back: Still warm, likely to return');
      console.log('  → Suggested action: Personal outreach, special offer\n');
    }

    if (mediumTerm > 0) {
      console.log(`✓ Medium-term cancellations (31-90 days): ${mediumTerm} contacts`);
      console.log('  → Medium-priority win-back: May need stronger incentive');
      console.log('  → Suggested action: Survey + discount offer\n');
    }

    if (longTerm > 0) {
      console.log(`✓ Long-term cancellations (90+ days): ${longTerm} contacts`);
      console.log('  → Lower-priority win-back: Significant time elapsed');
      console.log('  → Suggested action: "What\'s new" campaign, major updates\n');
    }

    console.log('='.repeat(70));
    console.log('\nTo create targeted lists in HubSpot:');
    console.log('  1. Go to Contacts > Lists');
    console.log('  2. Create Active List with filter:');
    console.log('     "Mighty Days Since Cancellation" is less than 30');
    console.log('  3. Use for targeted re-engagement campaigns\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

checkCancellationData();
