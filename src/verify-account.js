import dotenv from 'dotenv';
import hubspot from '@hubspot/api-client';

dotenv.config();

async function verifyAccount() {
  console.log('Verifying HubSpot account details...\n');

  const client = new hubspot.Client({
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN
  });

  try {
    // Get account info
    const accountInfo = await client.apiRequest({
      method: 'GET',
      path: '/account-info/v3/api-usage/daily'
    });

    console.log('Account Info:');
    console.log('Token:', process.env.HUBSPOT_ACCESS_TOKEN.substring(0, 20) + '...');

    // Get portal ID
    const contactsPage = await client.crm.contacts.basicApi.getPage(1);

    // Count contacts with mighty_user_id
    const mightyContacts = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'mighty_user_id',
          operator: 'HAS_PROPERTY'
        }]
      }],
      limit: 100
    });

    console.log('\nContact Statistics:');
    console.log('Total contacts in account:', contactsPage.total);
    console.log('Mighty Networks contacts:', mightyContacts.total);
    console.log('\nIf you see 1,238 Mighty contacts, the sync worked!');
    console.log('If you see 0, the token might be for a different account.\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyAccount();
