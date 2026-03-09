import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

// Helper function to parse location into city, state, country
function parseLocation(locationString) {
  if (!locationString) {
    return { city: null, state: null, country: null };
  }

  const parts = locationString.split(',').map(p => p.trim());

  if (parts.length === 1) {
    // Just a city or country
    return { city: parts[0], state: null, country: null };
  } else if (parts.length === 2) {
    // Likely "City, State" (US) or "City, Country"
    const secondPart = parts[1];
    // If second part is 2 letters, likely a US state
    if (secondPart.length === 2) {
      return { city: parts[0], state: secondPart, country: 'USA' };
    } else {
      return { city: parts[0], state: null, country: secondPart };
    }
  } else if (parts.length === 3) {
    // "City, State, Country"
    return { city: parts[0], state: parts[1], country: parts[2] };
  }

  return { city: null, state: null, country: null };
}

async function syncSubscriptions() {
  console.log('Syncing subscription plans from Mighty Networks to HubSpot...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Step 1: Create properties in HubSpot if they don't exist
    console.log('Creating custom properties in HubSpot...\n');

    const customProperties = [
      {
        name: 'mighty_member_id',
        label: 'Mighty Member ID',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Unique member ID from Mighty Networks API'
      },
      {
        name: 'mighty_plan_name',
        label: 'Mighty Plan Name',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Full name of the subscription plan (e.g., PAC Premium Plan, The PAC App)'
      },
      {
        name: 'mighty_plan_type',
        label: 'Mighty Plan Type',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Type of plan: free, premium, or canceled'
      },
      {
        name: 'mighty_plan_price',
        label: 'Mighty Plan Price',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Plan price (e.g., $99/month, Free)'
      },
      {
        name: 'mighty_subscription_start',
        label: 'Mighty Subscription Start',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member purchased their current plan'
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
        name: 'mighty_member_joined',
        label: 'Mighty Member Joined',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member joined the network'
      },
      {
        name: 'mighty_days_to_convert',
        label: 'Mighty Days to Convert',
        type: 'number',
        fieldType: 'number',
        groupName: 'contactinformation',
        description: 'Number of days between joining and purchasing paid plan (0 = direct signup)'
      },
      {
        name: 'mighty_conversion_type',
        label: 'Mighty Conversion Type',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'How member became paid: Converted (was free first), Direct (paid immediately), or Free (not paid)'
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
        description: 'Member location from Mighty Networks (full)'
      },
      {
        name: 'mighty_city',
        label: 'Mighty City',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'City from member location'
      },
      {
        name: 'mighty_state',
        label: 'Mighty State',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'State/Province from member location'
      },
      {
        name: 'mighty_country',
        label: 'Mighty Country',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Country from member location'
      },
      {
        name: 'mighty_canceled_at',
        label: 'Mighty Canceled At',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member canceled their subscription'
      },
      {
        name: 'mighty_days_since_cancellation',
        label: 'Mighty Days Since Cancellation',
        type: 'number',
        fieldType: 'number',
        groupName: 'contactinformation',
        description: 'Number of days since member canceled (for win-back campaigns)'
      },
      {
        name: 'mighty_subscription_canceled_at',
        label: 'Mighty Subscription Canceled At',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member canceled their subscription'
      },
      {
        name: 'mighty_upgraded_to_premium_at',
        label: 'Mighty Upgraded to Premium At',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member switched from free to a paid plan (only set for Converted members, not Direct signups)'
      },
      {
        name: 'mighty_downgraded_to_free_at',
        label: 'Mighty Downgraded to Free At',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member canceled their paid subscription and returned to free (still in Mighty network)'
      }
    ];

    for (const property of customProperties) {
      try {
        await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
        console.log(`  Created: ${property.label}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  Already exists: ${property.label}`);
        } else {
          throw error;
        }
      }
    }
    console.log('');

    // Step 2: Fetch all subscriptions from Mighty Networks (includes plan data)
    console.log('Fetching subscriptions from Mighty Networks...\n');
    const subscriptions = await mightyClient.getAllSubscriptions();
    console.log(`\nFound ${subscriptions.length} total subscriptions\n`);

    // Step 3: Update subscription data for all contacts in HubSpot
    console.log('Updating subscription data in HubSpot...\n');

    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    // Track conversion stats
    let convertedCount = 0;
    let directCount = 0;
    let freeCount = 0;

    for (const member of subscriptions) {
      if (!member.email) {
        errorCount++;
        continue;
      }

      try {
        // Find contact in HubSpot
        let contact = await hubspotClient.findContactByEmail(member.email);

        // Extract plan data
        const planName = member.plan?.name || 'Unknown';
        const rawPlanType = member.plan?.type || 'unknown';
        const planAmount = member.plan?.amount || 0;
        const planInterval = member.plan?.interval || 'month';

        // Format price
        const planPrice = planAmount > 0
          ? `$${(planAmount / 100).toFixed(0)}/${planInterval}`
          : 'Free';

        const isCanceled = !!member.subscription?.canceled_at;
        const subscriptionStatus = isCanceled ? 'canceled' : rawPlanType === 'subscription' ? 'active' : 'free';

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

        // Extract dates
        const joinedDate = member.created_at ? member.created_at.split('T')[0] : null;
        const purchasedDate = member.subscription?.purchased_at
          ? member.subscription.purchased_at.split('T')[0]
          : (member.subscription?.current_period_start ? member.subscription.current_period_start.split('T')[0] : null);

        // Calculate conversion data (only for paid members)
        let daysToConvert = null;
        let conversionType = 'Free';

        if (rawPlanType === 'subscription' && joinedDate && purchasedDate) {
          const joined = new Date(member.created_at);
          const purchased = new Date(member.subscription?.purchased_at || member.subscription?.current_period_start);
          daysToConvert = Math.round((purchased - joined) / (1000 * 60 * 60 * 24));

          if (daysToConvert > 0) {
            conversionType = 'Converted';
            convertedCount++;
          } else {
            conversionType = 'Direct';
            daysToConvert = 0;
            directCount++;
          }
        } else {
          freeCount++;
        }

        // Extract cohort years from categories
        const cohortYears = member.categories && member.categories.length > 0
          ? member.categories.map(cat => cat.title).join(', ')
          : null;

        // Extract and parse location
        const location = member.location || null;
        const { city, state, country } = parseLocation(location);

        // Build properties object
        const properties = {
          mighty_member_id: member.member_id?.toString() || '',
          mighty_plan_name: planName,
          mighty_plan_type: planType,
          mighty_plan_price: planPrice,
          mighty_subscription_status: subscriptionStatus,
          mighty_conversion_type: conversionType
        };

        // Add optional fields if they exist
        if (purchasedDate) {
          properties.mighty_subscription_start = purchasedDate;
        }
        if (joinedDate) {
          properties.mighty_member_joined = joinedDate;
        }
        if (daysToConvert !== null) {
          properties.mighty_days_to_convert = daysToConvert;
        }
        if (cohortYears) {
          properties.mighty_cohort_years = cohortYears;
        }
        if (location) {
          properties.mighty_location = location;
        }
        if (city) {
          properties.mighty_city = city;
        }
        if (state) {
          properties.mighty_state = state;
        }
        if (country) {
          properties.mighty_country = country;
        }

        // Add free-to-premium upgrade date (only for members who converted, not direct signups)
        if (conversionType === 'Converted' && purchasedDate) {
          properties.mighty_upgraded_to_premium_at = purchasedDate;
        }

        // Add cancellation data if subscription was canceled
        if (isCanceled && member.subscription?.canceled_at) {
          const canceledDate = member.subscription.canceled_at.split('T')[0];
          properties.mighty_canceled_at = canceledDate;
          properties.mighty_subscription_canceled_at = canceledDate;

          // If they are still in Mighty (returned by API) but have a canceled paid plan,
          // they downgraded from premium to free
          if (rawPlanType === 'subscription') {
            properties.mighty_downgraded_to_free_at = canceledDate;
          }

          // Calculate days since cancellation
          const canceled = new Date(member.subscription.canceled_at);
          const now = new Date();
          const daysSince = Math.floor((now - canceled) / (1000 * 60 * 60 * 24));
          properties.mighty_days_since_cancellation = daysSince;
        }

        // Format output info
        const conversionInfo = rawPlanType === 'subscription'
          ? `${conversionType}${daysToConvert > 0 ? ` (${daysToConvert} days)` : ''}`
          : 'Free';

        if (contact) {
          // Update existing contact
          await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
            properties
          });
          updatedCount++;
          console.log(`  Updated: ${member.email} - ${planName} | ${conversionInfo}`);
        } else {
          // Create new contact
          const newProperties = {
            ...properties,
            email: member.email,
            firstname: member.first_name || '',
            lastname: member.last_name || ''
          };

          await hubspotClient.client.crm.contacts.basicApi.create({
            properties: newProperties
          });
          createdCount++;
          console.log(`  Created: ${member.email} - ${planName} | ${conversionInfo}`);
        }

      } catch (error) {
        console.log(`  Error: ${member.email}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('                    SYNC COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total subscriptions:    ${subscriptions.length}`);
    console.log(`Contacts updated:       ${updatedCount}`);
    console.log(`Contacts created:       ${createdCount}`);
    console.log(`Errors:                 ${errorCount}`);
    console.log('-'.repeat(60));
    console.log(`Paid - Converted:       ${convertedCount} (was free, then upgraded)`);
    console.log(`Paid - Direct:          ${directCount} (paid immediately)`);
    console.log(`Free members:           ${freeCount}`);
    console.log('='.repeat(60) + '\n');

    console.log('View in HubSpot:');
    console.log('  1. Go to Contacts > Contacts');
    console.log('  2. Click "Edit columns"');
    console.log('  3. Add the following columns:');
    console.log('     - Mighty Plan Name');
    console.log('     - Mighty Plan Type');
    console.log('     - Mighty Plan Price');
    console.log('     - Mighty Is Premium Member');
    console.log('     - Mighty Subscription Status');
    console.log('     - Mighty Member Joined');
    console.log('     - Mighty Days to Convert');
    console.log('     - Mighty Conversion Type\n');

  } catch (error) {
    console.error('Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncSubscriptions();
