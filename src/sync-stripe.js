import dotenv from 'dotenv';
import { StripeClient } from './clients/stripeClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncStripeToHubSpot() {
  console.log('Starting Stripe to HubSpot sync...\n');

  const stripeClient = new StripeClient(process.env.STRIPE_SECRET_KEY);
  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Step 1: Create HubSpot custom properties for Stripe data
    console.log('Step 1: Creating HubSpot custom properties...\n');
    await createStripeProperties(hubspotClient);

    // Step 2: Fetch all Stripe data
    console.log('\nStep 2: Fetching Stripe data...\n');
    const [customers, subscriptions, products, charges] = await Promise.all([
      stripeClient.getAllCustomers(),
      stripeClient.getAllSubscriptions(),
      stripeClient.getAllProducts(),
      stripeClient.getAllCharges()
    ]);

    // Create product lookup map
    const productMap = new Map(products.map(p => [p.id, p]));

    // Create subscription lookup by customer ID
    const subscriptionsByCustomer = new Map();
    for (const sub of subscriptions) {
      if (!subscriptionsByCustomer.has(sub.customer)) {
        subscriptionsByCustomer.set(sub.customer, []);
      }
      subscriptionsByCustomer.get(sub.customer).push(sub);
    }

    // Create charges lookup by customer ID
    const chargesByCustomer = new Map();
    for (const charge of charges) {
      if (!chargesByCustomer.has(charge.customer)) {
        chargesByCustomer.set(charge.customer, []);
      }
      chargesByCustomer.get(charge.customer).push(charge);
    }

    console.log(`\nFound ${customers.length} Stripe customers`);
    console.log(`Found ${subscriptions.length} Stripe subscriptions`);
    console.log(`Found ${products.length} Stripe products`);
    console.log(`Found ${charges.length} Stripe charges`);

    // Step 3: Match and sync to HubSpot
    console.log('\nStep 3: Matching Stripe customers with HubSpot contacts...\n');

    let matched = 0;
    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const customer of customers) {
      if (!customer.email) {
        console.log(`Skipping customer ${customer.id} - no email`);
        continue;
      }

      try {
        // Find HubSpot contact by email
        let hubspotContact = await hubspotClient.findContactByEmail(customer.email);

        // Get customer's subscriptions
        const customerSubs = subscriptionsByCustomer.get(customer.id) || [];

        // Get customer's charges (payments)
        const customerCharges = chargesByCustomer.get(customer.id) || [];

        // Build Stripe properties
        const stripeProperties = buildStripeProperties(customer, customerSubs, productMap, customerCharges);

        if (!hubspotContact) {
          notFound++;
          console.log(`Skipping ${customer.email} - not found in HubSpot`);
          continue;
        }

        // Update existing HubSpot contact
        matched++;

        await hubspotClient.client.crm.contacts.basicApi.update(hubspotContact.id, {
          properties: stripeProperties
        });

        updated++;
        console.log(`✓ Updated ${customer.email} - ${stripeProperties.stripe_subscription_status || 'no subscription'}`);

      } catch (error) {
        errors++;
        console.error(`✗ Error processing ${customer.email}:`, error.message);
      }
    }

    // Summary
    console.log('\n=== SYNC COMPLETE ===');
    console.log(`Total Stripe customers processed: ${customers.length}`);
    console.log(`Matched and updated: ${updated}`);
    console.log(`Not found in HubSpot: ${notFound}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Sync failed:', error.message);
    console.error(error.stack);
  }
}

function buildStripeProperties(customer, subscriptions, productMap, charges) {
  const properties = {
    stripe_customer_id: customer.id,
    stripe_customer_created: customer.created ? new Date(customer.created * 1000).toISOString().split('T')[0] : ''
  };

  // Find most recent successful payment
  if (charges && charges.length > 0) {
    const successfulCharges = charges.filter(c => c.status === 'succeeded').sort((a, b) => b.created - a.created);
    if (successfulCharges.length > 0) {
      const lastCharge = successfulCharges[0];
      properties.stripe_last_payment_date = new Date(lastCharge.created * 1000).toISOString().split('T')[0];
      properties.stripe_last_payment_amount = `$${(lastCharge.amount / 100).toFixed(2)}`;
    }
  }

  // If customer has subscriptions, add subscription data
  if (subscriptions.length > 0) {
    // Use the first active subscription, or the first subscription if none are active
    const activeSub = subscriptions.find(s => s.status === 'active') || subscriptions[0];

    properties.stripe_subscription_id = activeSub.id;
    properties.stripe_subscription_status = activeSub.status;

    // Get subscription start date
    if (activeSub.created) {
      properties.stripe_subscription_start = new Date(activeSub.created * 1000).toISOString().split('T')[0];
    }

    // Get current period dates if available
    if (activeSub.current_period_start) {
      properties.stripe_current_period_start = new Date(activeSub.current_period_start * 1000).toISOString().split('T')[0];
    }
    if (activeSub.current_period_end) {
      properties.stripe_current_period_end = new Date(activeSub.current_period_end * 1000).toISOString().split('T')[0];
    }

    // Get trial end date if in trial
    if (activeSub.trial_end) {
      properties.stripe_trial_end = new Date(activeSub.trial_end * 1000).toISOString().split('T')[0];
    }

    // Get plan/product details from first item
    if (activeSub.items && activeSub.items.data.length > 0) {
      const item = activeSub.items.data[0];
      const product = productMap.get(item.price.product);

      if (product) {
        properties.stripe_product_name = product.name;
      }

      // Price details
      if (item.price.unit_amount) {
        const amount = item.price.unit_amount / 100; // Convert cents to dollars
        const currency = item.price.currency?.toUpperCase() || 'USD';
        const interval = item.price.recurring?.interval || 'one-time';

        properties.stripe_price_amount = amount.toString();
        properties.stripe_price_currency = currency;
        properties.stripe_billing_interval = interval;
        properties.stripe_price_display = `$${amount}/${interval}`;
      }
    }

    // Count total subscriptions
    properties.stripe_total_subscriptions = subscriptions.length.toString();

    // Calculate overdue status
    const now = Date.now() / 1000; // Current time in Unix timestamp
    const isOverdue = activeSub.status === 'past_due' ||
                      (activeSub.current_period_end && activeSub.current_period_end < now && activeSub.status !== 'active');

    properties.stripe_is_overdue = isOverdue ? 'yes' : 'no';

    if (isOverdue && activeSub.current_period_end) {
      const daysOverdue = Math.floor((now - activeSub.current_period_end) / (24 * 60 * 60));
      properties.stripe_days_overdue = daysOverdue.toString();
    } else {
      properties.stripe_days_overdue = '0';
    }

  } else {
    // Customer exists but has no subscriptions
    properties.stripe_subscription_status = 'none';
    properties.stripe_total_subscriptions = '0';
    properties.stripe_is_overdue = 'n/a';
    properties.stripe_days_overdue = '0';
  }

  return properties;
}

async function createStripeProperties(hubspotClient) {
  const properties = [
    {
      name: 'stripe_customer_id',
      label: 'Stripe Customer ID',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Stripe customer ID'
    },
    {
      name: 'stripe_customer_created',
      label: 'Stripe Customer Created',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Date when customer was created in Stripe'
    },
    {
      name: 'stripe_subscription_id',
      label: 'Stripe Subscription ID',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Active Stripe subscription ID'
    },
    {
      name: 'stripe_subscription_status',
      label: 'Stripe Subscription Status',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Stripe subscription status (active, trialing, canceled, none)'
    },
    {
      name: 'stripe_subscription_start',
      label: 'Stripe Subscription Start',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Date when subscription started'
    },
    {
      name: 'stripe_current_period_start',
      label: 'Stripe Current Period Start',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Current billing period start date'
    },
    {
      name: 'stripe_current_period_end',
      label: 'Stripe Current Period End',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Current billing period end date'
    },
    {
      name: 'stripe_trial_end',
      label: 'Stripe Trial End Date',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Date when trial period ends'
    },
    {
      name: 'stripe_product_name',
      label: 'Stripe Product Name',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Name of the Stripe product/plan'
    },
    {
      name: 'stripe_price_amount',
      label: 'Stripe Price Amount',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Subscription price amount'
    },
    {
      name: 'stripe_price_currency',
      label: 'Stripe Currency',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Price currency (USD, etc.)'
    },
    {
      name: 'stripe_billing_interval',
      label: 'Stripe Billing Interval',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Billing interval (month, year, etc.)'
    },
    {
      name: 'stripe_price_display',
      label: 'Stripe Price Display',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Formatted price display (e.g., $99/month)'
    },
    {
      name: 'stripe_total_subscriptions',
      label: 'Stripe Total Subscriptions',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Total number of subscriptions for this customer'
    },
    {
      name: 'stripe_last_payment_date',
      label: 'Stripe Last Payment Date',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Date of most recent successful Stripe payment'
    },
    {
      name: 'stripe_last_payment_amount',
      label: 'Stripe Last Payment Amount',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Amount of last successful payment'
    },
    {
      name: 'stripe_is_overdue',
      label: 'Stripe Payment Overdue',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Whether payment is overdue (yes/no/n/a)'
    },
    {
      name: 'stripe_days_overdue',
      label: 'Stripe Days Overdue',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Number of days past payment due date'
    }
  ];

  for (const property of properties) {
    try {
      await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
      console.log(`  ✓ Created: ${property.label}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  - Already exists: ${property.label}`);
      } else {
        console.error(`  ✗ Error creating ${property.label}:`, error.message);
      }
    }
  }
}

syncStripeToHubSpot();
