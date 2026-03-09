import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function inspectAllMemberFields() {
  console.log('🔍 Inspecting ALL available member fields...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get first member
    const membersResponse = await mightyClient.getNetworkMembers(1);
    const sampleMember = membersResponse.items[0];

    console.log(`Inspecting member: ${sampleMember.email}\n`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get all top-level fields
    console.log('📋 ALL AVAILABLE FIELDS:\n');

    const allFields = Object.keys(sampleMember).sort();

    for (const field of allFields) {
      const value = sampleMember[field];
      const type = typeof value;
      const preview = type === 'object' && value !== null
        ? JSON.stringify(value).substring(0, 100) + '...'
        : String(value);

      console.log(`${field}:`);
      console.log(`  Type: ${type}`);
      console.log(`  Value: ${preview}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📄 COMPLETE MEMBER OBJECT:\n');
    console.log(JSON.stringify(sampleMember, null, 2));
    console.log('\n═══════════════════════════════════════════════════════════\n');

    console.log('✅ Inspection complete!\n');
    console.log('Look through the fields above to identify "network access" or related fields.\n');
    console.log('Common access-related field names:');
    console.log('  - access_level');
    console.log('  - role');
    console.log('  - status');
    console.log('  - permissions');
    console.log('  - is_admin');
    console.log('  - is_moderator');
    console.log('  - network_access');
    console.log('  - member_type');
    console.log('  - joined_at');
    console.log('  - last_seen_at\n');

  } catch (error) {
    console.error('❌ Inspection failed:', error.message);
    console.error(error.stack);
  }
}

inspectAllMemberFields();
