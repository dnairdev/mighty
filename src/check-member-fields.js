import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function checkMemberFields() {
  console.log('🔍 Checking available member fields...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get first few members to see what fields are available
    const membersResponse = await mightyClient.getNetworkMembers(1);

    if (membersResponse.items && membersResponse.items.length > 0) {
      console.log('Sample member data structure:\n');
      console.log(JSON.stringify(membersResponse.items[0], null, 2));

      console.log('\n═══════════════════════════════════');
      console.log('Available fields:');
      console.log('═══════════════════════════════════\n');

      const fields = Object.keys(membersResponse.items[0]);
      fields.forEach(field => {
        const value = membersResponse.items[0][field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`- ${field}: ${type}`);
      });

      console.log('\n');
      console.log('Checking for phone number fields:');
      const phoneFields = fields.filter(f =>
        f.toLowerCase().includes('phone') ||
        f.toLowerCase().includes('mobile') ||
        f.toLowerCase().includes('tel')
      );

      if (phoneFields.length > 0) {
        console.log('✓ Found phone-related fields:', phoneFields.join(', '));
        phoneFields.forEach(field => {
          console.log(`  ${field}:`, membersResponse.items[0][field]);
        });
      } else {
        console.log('✗ No phone number fields found in member data');
      }

      // Check first 10 members to see if any have phone data
      console.log('\n\nChecking first 10 members for phone data:\n');
      membersResponse.items.slice(0, 10).forEach((member, i) => {
        const name = member.name || member.email || 'Unknown';
        console.log(`${i + 1}. ${name}`);

        phoneFields.forEach(field => {
          if (member[field]) {
            console.log(`   ${field}: ${member[field]}`);
          }
        });
      });

    } else {
      console.log('No members found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkMemberFields();
