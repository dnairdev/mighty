import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function showPlanChanges() {
  console.log('Fetching plan change history from HubSpot...\n');

  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Fetch contacts who have downgraded (premium → free)
    const downgradeResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'mighty_downgraded_to_free_at',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: [
        'email', 'firstname', 'lastname',
        'mighty_plan_name', 'mighty_subscription_status',
        'mighty_upgraded_to_premium_at',
        'mighty_downgraded_to_free_at',
        'mighty_member_joined',
        'mighty_days_to_convert',
        'mighty_conversion_type'
      ],
      sorts: [{ propertyName: 'mighty_downgraded_to_free_at', direction: 'DESCENDING' }],
      limit: 100
    });

    // Fetch contacts who upgraded (free → premium)
    const upgradeResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'mighty_upgraded_to_premium_at',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: [
        'email', 'firstname', 'lastname',
        'mighty_plan_name', 'mighty_subscription_status',
        'mighty_upgraded_to_premium_at',
        'mighty_downgraded_to_free_at',
        'mighty_member_joined',
        'mighty_days_to_convert'
      ],
      sorts: [{ propertyName: 'mighty_upgraded_to_premium_at', direction: 'DESCENDING' }],
      limit: 100
    });

    const downgrades = downgradeResponse.results;
    const upgrades = upgradeResponse.results;

    // ── PREMIUM → FREE DOWNGRADES ──────────────────────────────────────
    console.log('='.repeat(70));
    console.log('  PREMIUM → FREE DOWNGRADES');
    console.log('='.repeat(70));
    console.log(`Total: ${downgradeResponse.total}\n`);

    if (downgrades.length === 0) {
      console.log('No downgrades found. Run npm run sync-subscriptions first.\n');
    } else {
      for (const contact of downgrades) {
        const p = contact.properties;
        const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'No name';
        const joinedDate = p.mighty_member_joined || 'Unknown';
        const upgradedDate = p.mighty_upgraded_to_premium_at || 'N/A';
        const downgradedDate = p.mighty_downgraded_to_free_at;
        const plan = p.mighty_plan_name || 'Unknown';

        // Calculate time as premium member
        let timeAsPremium = '';
        if (upgradedDate !== 'N/A' && downgradedDate) {
          const days = Math.floor(
            (new Date(downgradedDate) - new Date(upgradedDate)) / (1000 * 60 * 60 * 24)
          );
          timeAsPremium = ` (${days} days as premium)`;
        }

        console.log(`${name} — ${p.email}`);
        console.log(`  Joined:      ${joinedDate}`);
        console.log(`  → Premium:   ${upgradedDate}`);
        console.log(`  → Free:      ${downgradedDate}${timeAsPremium}`);
        console.log(`  Plan was:    ${plan}`);
        console.log('');
      }
    }

    // ── FREE → PREMIUM UPGRADES ────────────────────────────────────────
    console.log('='.repeat(70));
    console.log('  FREE → PREMIUM UPGRADES');
    console.log('='.repeat(70));
    console.log(`Total: ${upgradeResponse.total}\n`);

    if (upgrades.length === 0) {
      console.log('No upgrades found. Run npm run sync-subscriptions first.\n');
    } else {
      for (const contact of upgrades) {
        const p = contact.properties;
        const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'No name';
        const joinedDate = p.mighty_member_joined || 'Unknown';
        const upgradedDate = p.mighty_upgraded_to_premium_at;
        const daysToConvert = p.mighty_days_to_convert || 'Unknown';
        const plan = p.mighty_plan_name || 'Unknown';
        const status = p.mighty_subscription_status || 'unknown';

        console.log(`${name} — ${p.email}`);
        console.log(`  Joined:       ${joinedDate}`);
        console.log(`  → Premium:    ${upgradedDate} (${daysToConvert} days after joining)`);
        console.log(`  Plan:         ${plan}`);
        console.log(`  Status now:   ${status}`);
        console.log('');
      }
    }

    // ── SUMMARY ────────────────────────────────────────────────────────
    console.log('='.repeat(70));
    console.log('  SUMMARY');
    console.log('='.repeat(70));
    console.log(`Free → Premium upgrades:    ${upgradeResponse.total}`);
    console.log(`Premium → Free downgrades:  ${downgradeResponse.total}`);

    const bothWays = downgrades.filter(d => d.properties.mighty_upgraded_to_premium_at);
    console.log(`Upgraded then downgraded:   ${bothWays.length} (went both ways)`);
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

showPlanChanges();
