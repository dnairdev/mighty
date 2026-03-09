import hubspot from '@hubspot/api-client';

export class HubSpotClient {
  constructor(accessToken) {
    this.client = new hubspot.Client({ accessToken });
  }

  async createOrUpdateContact(member) {
    try {
      const properties = {
        email: member.email || `user_${member.user_id}@mighty.placeholder`,
        firstname: member.first_name || member.name?.split(' ')[0] || '',
        lastname: member.last_name || member.name?.split(' ').slice(1).join(' ') || '',
        mighty_user_id: member.user_id?.toString() || '',
        mighty_member_since: member.created_at || '',
        mighty_spaces: member.spaces?.map(s => s.name).join(', ') || '',
        mighty_role: member.role || 'member'
      };

      // Try to find existing contact by email or mighty_user_id
      let contactId = null;

      if (member.email) {
        try {
          const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: member.email
              }]
            }],
            limit: 1
          });

          if (searchResponse.results.length > 0) {
            contactId = searchResponse.results[0].id;
          }
        } catch (searchError) {
          console.log('Contact not found, will create new one');
        }
      }

      if (contactId) {
        // Update existing contact
        const response = await this.client.crm.contacts.basicApi.update(contactId, {
          properties
        });
        console.log(`Updated contact: ${member.email || member.user_id}`);
        return response;
      } else {
        // Create new contact
        const response = await this.client.crm.contacts.basicApi.create({
          properties
        });
        console.log(`Created contact: ${member.email || member.user_id}`);
        return response;
      }
    } catch (error) {
      console.error('Error creating/updating contact:', error.message);
      throw error;
    }
  }

  async createTimelineEvent(contactId, eventType, eventData) {
    try {
      // Create a timeline event for member activity
      const event = {
        eventTemplateId: eventType,
        email: eventData.email,
        tokens: {
          activity_type: eventData.activityType || 'engagement',
          activity_description: eventData.description || '',
          space_name: eventData.spaceName || '',
          timestamp: eventData.timestamp || new Date().toISOString()
        }
      };

      // Note: Timeline events require a custom event type to be created in HubSpot first
      // This is a placeholder that will need the actual event type ID
      console.log('Timeline event to be created:', event);

      // Uncomment once timeline event type is set up in HubSpot
      // const response = await this.client.crm.timeline.eventsApi.create(event);
      // return response;

      return event;
    } catch (error) {
      console.error('Error creating timeline event:', error.message);
      throw error;
    }
  }

  async ensureCustomProperties() {
    try {
      const customProperties = [
        {
          name: 'mighty_user_id',
          label: 'Mighty User ID',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation'
        },
        {
          name: 'mighty_member_since',
          label: 'Mighty Member Since',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation'
        },
        {
          name: 'mighty_spaces',
          label: 'Mighty Spaces',
          type: 'string',
          fieldType: 'textarea',
          groupName: 'contactinformation'
        },
        {
          name: 'mighty_role',
          label: 'Mighty Role',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation'
        }
      ];

      for (const property of customProperties) {
        try {
          await this.client.crm.properties.coreApi.create('contacts', property);
          console.log(`Created custom property: ${property.name}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`Custom property already exists: ${property.name}`);
          } else {
            console.error(`Error creating property ${property.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring custom properties:', error.message);
    }
  }

  async createEngagementNote(contactId, noteBody, timestamp) {
    try {
      // Create note with association in one API call
      const noteInput = {
        properties: {
          hs_timestamp: timestamp || new Date().toISOString(),
          hs_note_body: noteBody,
          hubspot_owner_id: null
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202 // Contact to Note association
              }
            ]
          }
        ]
      };

      const response = await this.client.crm.objects.notes.basicApi.create(noteInput);
      return response;
    } catch (error) {
      console.error('Error creating engagement note:', error.message);
      return null;
    }
  }

  async findContactByEmail(email) {
    try {
      const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }],
        limit: 1
      });

      return searchResponse.results.length > 0 ? searchResponse.results[0] : null;
    } catch (error) {
      return null;
    }
  }

  async testConnection() {
    try {
      await this.client.crm.contacts.basicApi.getPage(1);
      return true;
    } catch (error) {
      return false;
    }
  }
}
