import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function checkMemberDetails() {
  console.log('🔍 Checking detailed member endpoint...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get first member
    const membersResponse = await mightyClient.getNetworkMembers(1);
    const firstMember = membersResponse.items[0];

    console.log(`Checking detailed data for: ${firstMember.email}\n`);

    // Try to get detailed member data
    try {
      const detailedMember = await mightyClient.client.get(
        `/networks/${process.env.MIGHTY_NETWORK_ID}/members/${firstMember.id}`
      );

      console.log('Detailed member data:\n');
      console.log(JSON.stringify(detailedMember.data, null, 2));

    } catch (error) {
      console.log('Could not fetch detailed member data:', error.response?.status, error.message);
    }

    // Try to get profile questions
    console.log('\n\nChecking for profile questions...\n');
    try {
      const profileQuestions = await mightyClient.client.get(
        `/networks/${process.env.MIGHTY_NETWORK_ID}/profile_questions`
      );

      console.log('Profile questions:\n');
      console.log(JSON.stringify(profileQuestions.data, null, 2));

    } catch (error) {
      console.log('Could not fetch profile questions:', error.response?.status, error.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkMemberDetails();
