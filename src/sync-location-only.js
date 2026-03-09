import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncLocationOnly() {
  console.log('💰 Syncing subscription and location data from Mighty Networks to HubSpot...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Step 1: Create properties in HubSpot if they don't exist
    console.log('🔧 Creating custom properties in HubSpot...\n');

    const customProperties = [
      {
        name: 'mighty_plan_type',
        label: 'Mighty Plan Type',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Type of plan: free, nonpaid, or subscription'
      },
      {
        name: 'mighty_is_premium',
        label: 'Mighty Is Premium Member',
        type: 'enumeration',
        fieldType: 'booleancheckbox',
        groupName: 'contactinformation',
        description: 'Whether member has a paid subscription plan',
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ]
      },
      {
        name: 'mighty_subscription_start',
        label: 'Mighty Subscription Start',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member subscription started'
      },
      {
        name: 'mighty_subscription_status',
        label: 'Mighty Subscription Status',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Subscription status: active or canceled'
      },
      {
        name: 'mighty_cohort_years',
        label: 'Mighty Cohort Years',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Member cohort years (e.g., 2024, 2025)'
      },
      {
        name: 'mighty_location',
        label: 'Mighty Location',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Member location from Mighty Networks'
      }
    ];

    for (const property of customProperties) {
      try {
        await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
        console.log(`✓ Created: ${property.label}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`✓ Already exists: ${property.label}`);
        } else {
          throw error;
        }
      }
    }
    console.log('');

    // Step 2: Fetch all members from Mighty Networks
    console.log('👥 Fetching members from Mighty Networks...\n');
    const members = await mightyClient.getAllMembers();
    console.log(`Found ${members.length} total members\n`);

    // Step 3: Update subscription and location data for all contacts in HubSpot
    console.log('🔄 Updating subscription and location data in HubSpot...\n');

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const member of members) {
      if (!member.email) {
        errorCount++;
        continue;
      }

      try {
        // Find contact in HubSpot
        const contact = await hubspotClient.findContactByEmail(member.email);
        if (!contact) {
          notFoundCount++;
          continue;
        }

        // Extract subscription data
        const rawPlanType = member.plan?.type || 'unknown';
        const isCanceled = !!member.subscription?.canceled_at;
        const subscriptionStatus = isCanceled ? 'canceled' : 'active';

        // Determine if premium (only active subscriptions are premium)
        const isPremium = rawPlanType === 'subscription' && !isCanceled;
        const isPremiumString = isPremium ? 'true' : 'false';

        // Map plan type to descriptive values
        let planType;
        if (rawPlanType === 'subscription' && !isCanceled) {
          planType = 'premium';
        } else if (rawPlanType === 'subscription' && isCanceled) {
          planType = 'canceled';
        } else {
          planType = 'free';
        }

        const subscriptionStart = member.subscription?.purchased_at
          ? member.subscription.purchased_at.split('T')[0]
          : (member.subscription?.current_period_start ? member.subscription.current_period_start.split('T')[0] : null);

        // Extract cohort years from categories
        const cohortYears = member.categories && member.categories.length > 0
          ? member.categories.map(cat => cat.title).join(', ')
          : null;

        // Extract location
        const location = member.location || null;

        // Build properties object
        const properties = {
          mighty_plan_type: planType,
          mighty_is_premium: isPremiumString,
          mighty_subscription_status: subscriptionStatus
        };

        // Add optional fields if they exist
        if (subscriptionStart) {
          properties.mighty_subscription_start = subscriptionStart;
        }
        if (cohortYears) {
          properties.mighty_cohort_years = cohortYears;
        }
        if (location) {
          properties.mighty_location = location;
        }

        // Update HubSpot
        await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
          properties
        });

        updatedCount++;

        // Show details
        const details = [];
        details.push(`Plan: ${planType}`);
        details.push(`Premium: ${isPremiumString}`);
        details.push(`Status: ${subscriptionStatus}`);
        if (location) details.push(`Location: ${location}`);

        console.log(`✓ ${member.email} - ${details.join(' | ')}`);

      } catch (error) {
        console.log(`✗ Error processing ${member.email}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n═══════════════════════════════════');
    console.log('       SYNC COMPLETE! 🎉           ');
    console.log('═══════════════════════════════════');
    console.log(`Total members: ${members.length}`);
    console.log(`Contacts updated: ${updatedCount}`);
    console.log(`Contacts not found in HubSpot: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('═══════════════════════════════════\n');

    console.log('✅ Subscription and location data synced to HubSpot!');
    console.log('   View in HubSpot by:');
    console.log('   1. Go to Contacts → Contacts');
    console.log('   2. Click "Edit columns"');
    console.log('   3. Add the following columns:');
    console.log('      - Mighty Plan Type');
    console.log('      - Mighty Is Premium Member');
    console.log('      - Mighty Subscription Start');
    console.log('      - Mighty Subscription Status');
    console.log('      - Mighty Cohort Years');
    console.log('      - Mighty Location\n');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncLocationOnly();
