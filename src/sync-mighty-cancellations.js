import dotenv from 'dotenv';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function parseCancellationsCSV(filePath) {
  const records = [];
  const parser = createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  );

  for await (const record of parser) {
    records.push(record);
  }

  return records;
}

async function syncMightyCancellations() {
  console.log('Syncing Mighty Networks cancellation dates to HubSpot...\n');

  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Step 1: Create/verify the cancellation date property exists
    console.log('Step 1: Creating HubSpot property for cancellation date...\n');

    const property = {
      name: 'mighty_subscription_canceled_at',
      label: 'Mighty Subscription Canceled At',
      type: 'date',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'Date when the Mighty Networks subscription was canceled (from cancellation report)'
    };

    try {
      await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
      console.log(`  ✓ Created: ${property.label}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  - Already exists: ${property.label}`);
      } else {
        throw error;
      }
    }

    // Step 2: Parse the CSV file
    console.log('\nStep 2: Parsing cancellations CSV...');
    const csvPath = '/Users/diyanair/Desktop/mighty/PAC Central - Canceled Subscriptions Report (all time) - PAC Central - Canceled Subscriptions Report (all time).csv';
    const records = await parseCancellationsCSV(csvPath);
    console.log(`Found ${records.length} cancellation records\n`);

    // Step 3: Group by User ID and get the most recent cancellation for each user
    console.log('Step 3: Processing cancellation data...');

    const cancellationsByUserId = new Map();
    let activeCount = 0;
    let canceledCount = 0;

    for (const record of records) {
      const userId = record['User ID']?.trim();
      const status = record['Subscription Status']?.trim();
      const canceledDate = record['Subscription Canceled Date (UTC)']?.trim();
      const email = record['User Email']?.trim();
      const userName = record['User Name']?.trim();

      if (!userId) continue;

      // Only process canceled subscriptions
      if (status === 'canceled' && canceledDate) {
        canceledCount++;

        // If we already have a cancellation for this user, keep the most recent one
        if (cancellationsByUserId.has(userId)) {
          const existing = cancellationsByUserId.get(userId);
          const existingDate = new Date(existing.canceledDate);
          const currentDate = new Date(canceledDate);

          if (currentDate > existingDate) {
            cancellationsByUserId.set(userId, {
              userId,
              email,
              userName,
              canceledDate
            });
          }
        } else {
          cancellationsByUserId.set(userId, {
            userId,
            email,
            userName,
            canceledDate
          });
        }
      } else if (status === 'active') {
        activeCount++;
      }
    }

    console.log(`  Total records: ${records.length}`);
    console.log(`  Canceled subscriptions: ${canceledCount}`);
    console.log(`  Active subscriptions: ${activeCount}`);
    console.log(`  Unique users with cancellations: ${cancellationsByUserId.size}\n`);

    // Step 4: Fetch all HubSpot contacts with Mighty member IDs
    console.log('Step 4: Fetching HubSpot contacts...');

    const allContacts = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
      const response = await hubspotClient.client.crm.contacts.basicApi.getPage(
        100,
        after,
        ['email', 'firstname', 'lastname', 'mighty_member_id', 'mighty_subscription_status']
      );

      allContacts.push(...response.results);

      if (response.paging?.next?.after) {
        after = response.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allContacts.length} contacts in HubSpot\n`);

    // Step 5: Match and update contacts
    console.log('Step 5: Updating contacts with cancellation dates...\n');

    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    let errors = 0;

    for (const [userId, cancellationData] of cancellationsByUserId) {
      try {
        // Find contact with matching mighty_member_id
        const contact = allContacts.find(c => c.properties.mighty_member_id === userId);

        if (contact) {
          // Format the date as YYYY-MM-DD for HubSpot
          const canceledDate = new Date(cancellationData.canceledDate);
          const formattedDate = canceledDate.toISOString().split('T')[0];

          await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
            properties: {
              mighty_subscription_canceled_at: formattedDate,
              mighty_subscription_status: 'canceled'
            }
          });

          updated++;
          console.log(`✓ Updated: ${cancellationData.userName} (${cancellationData.email})`);
          console.log(`  Mighty ID: ${userId} | Canceled: ${formattedDate}\n`);
        } else {
          notFound++;
          console.log(`✗ Not found in HubSpot: ${cancellationData.userName} (Mighty ID: ${userId})`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error updating ${cancellationData.email}: ${error.message}\n`);
      }
    }

    // Summary
    console.log('='.repeat(80));
    console.log('                    SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log(`\nUnique users with cancellations:  ${cancellationsByUserId.size}`);
    console.log(`Contacts updated in HubSpot:      ${updated}`);
    console.log(`Not found in HubSpot:             ${notFound}`);
    console.log(`Errors:                           ${errors}\n`);

    if (updated > 0) {
      console.log('✅ Cancellation dates have been synced to HubSpot.');
      console.log('\nYou can now create lists in HubSpot using:');
      console.log('  - "Mighty Subscription Canceled At" (date field)');
      console.log('  - "Mighty Subscription Status" is "canceled"\n');
    }

  } catch (error) {
    console.error('Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncMightyCancellations();
