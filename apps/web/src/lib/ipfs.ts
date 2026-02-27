/**
 * IPFS Integration for PLP
 * Handles metadata storage and retrieval with organized groups
 */

import { getIPFSConfig } from './environment';
import { createClientLogger } from './logger';

const logger = createClientLogger();

export interface ProjectMetadata {
  name: string;
  description: string;
  category: string;
  projectType: string;
  projectStage: string;
  location?: string;
  teamSize: number;
  tokenSymbol: string;
  marketDuration: number;
  minimumStake: number;
  socialLinks: {
    website?: string;
    github?: string;
    linkedin?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  videoUrl?: string; // YouTube or X/Twitter video URL
  additionalNotes?: string;
  image?: string;
  documents?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PinataGroup {
  id: string;
  name: string;
}

export interface PinataMetadata {
  name: string;
  group_id?: string;
}

export interface PinataFile {
  id: string;
  ipfs_pin_hash: string;
  size: number;
  user_id: string;
  date_pinned: string;
  date_unpinned: string | null;
  metadata: {
    name: string;
    keyvalues?: Record<string, string>;
  };
  mime_type: string;
  number_of_files: number;
}

class IPFSUtils {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataJwt: string;
  private pinataGatewayUrl: string;
  private useJwt: boolean;
  private groups: {
    metadata: string | null;
    images: string | null;
    documents: string | null;
  };

  constructor() {
    const ipfsConfig = getIPFSConfig();
    // Check for both client-side (NEXT_PUBLIC_*) and server-side environment variables
    this.pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || process.env.PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || process.env.PINATA_SECRET_KEY || '';
    this.pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT || process.env.PINATA_JWT || '';
    this.pinataGatewayUrl = ipfsConfig.gatewayUrl;
    
    // Prioritize JWT over API key/secret
    this.useJwt = !!this.pinataJwt;
    
    // Initialize groups - will be created on first use
    this.groups = {
      metadata: null,
      images: null,
      documents: null
    };
    
    logger.info('IPFS Configuration', {
      hasJwt: !!this.pinataJwt,
      hasApiKey: !!this.pinataApiKey,
      hasSecretKey: !!this.pinataSecretKey,
      gatewayUrl: this.pinataGatewayUrl,
      usingJwt: this.useJwt,
      jwtLength: this.pinataJwt.length,
      apiKeyLength: this.pinataApiKey.length,
      secretKeyLength: this.pinataSecretKey.length
    });
  }

  /**
   * Ensure groups exist, create them if they don't
   */
  private async ensureGroups(): Promise<void> {
    const hasCredentials = this.useJwt || (this.pinataApiKey && this.pinataSecretKey);
    
    if (!hasCredentials) {
      logger.warn('No Pinata credentials, skipping group creation');
      return;
    }

    try {
      // Check if groups already exist
      if (this.groups.metadata && this.groups.images && this.groups.documents) {
        return;
      }

      const groupNames = {
        metadata: 'PLP-Project-Metadata',
        images: 'PLP-Project-Images', 
        documents: 'PLP-Project-Documents'
      };

      for (const [type, groupName] of Object.entries(groupNames)) {
        if (!this.groups[type as keyof typeof this.groups]) {
          try {
            const groupId = await this.createGroup(groupName);
            this.groups[type as keyof typeof this.groups] = groupId;
            logger.info(`Created Pinata group: ${groupName}`, { groupId, type });
          } catch (error) {
            logger.warn(`Failed to create group ${groupName}, continuing without group organization`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to ensure groups exist', error);
    }
  }

  /**
   * Create a Pinata group
   */
  private async createGroup(groupName: string): Promise<string> {
    const url = 'https://api.pinata.cloud/groups';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.useJwt) {
      headers['Authorization'] = `Bearer ${this.pinataJwt}`;
    } else {
      headers['pinata_api_key'] = this.pinataApiKey;
      headers['pinata_secret_api_key'] = this.pinataSecretKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: groupName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create group: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Upload project metadata to IPFS
   */
  async uploadProjectMetadata(metadata: ProjectMetadata): Promise<string> {
    try {
      // Check if we have any Pinata credentials
      const hasCredentials = this.useJwt || (this.pinataApiKey && this.pinataSecretKey);
      
      if (!hasCredentials) {
        logger.warn('No Pinata credentials configured, using mock IPFS hash');
        return this.generateMockIPFSUri();
      }

      // Ensure groups exist
      await this.ensureGroups();

      let ipfsHash: string;

      if (this.useJwt) {
        // Use JWT-based upload (newer method)
        ipfsHash = await this.uploadMetadataWithJwt(metadata);
      } else {
        // Use API key/secret upload (legacy method)
        ipfsHash = await this.uploadMetadataWithApiKeys(metadata);
      }
      
      logger.info('Project metadata uploaded to IPFS', {
        projectName: metadata.name,
        ipfsHash,
        pinataUrl: `${this.pinataGatewayUrl}/ipfs/${ipfsHash}`,
        method: this.useJwt ? 'JWT' : 'API_KEYS',
        groupId: this.groups.metadata
      });

      return `ipfs://${ipfsHash}`;
    } catch (error) {
      logger.error('Failed to upload metadata to IPFS', error);
      // Fallback to mock URI for development
      return this.generateMockIPFSUri();
    }
  }

  /**
   * Upload metadata using JWT (recommended method)
   */
  private async uploadMetadataWithJwt(metadata: ProjectMetadata): Promise<string> {
    const pinataMetadata: PinataMetadata = {
      name: `${metadata.name}-metadata.json`,
    };

    // Add to metadata group if available
    if (this.groups.metadata) {
      pinataMetadata.group_id = this.groups.metadata;
      logger.info('Assigning metadata to group', { 
        groupId: this.groups.metadata, 
        fileName: pinataMetadata.name 
      });
    } else {
      logger.warn('No metadata group available for assignment');
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata,
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata JWT API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  /**
   * Upload metadata using API keys (legacy method)
   */
  private async uploadMetadataWithApiKeys(metadata: ProjectMetadata): Promise<string> {
    const pinataMetadata: PinataMetadata = {
      name: `${metadata.name}-metadata.json`,
    };

    // Add to metadata group if available
    if (this.groups.metadata) {
      pinataMetadata.group_id = this.groups.metadata;
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': this.pinataApiKey,
        'pinata_secret_api_key': this.pinataSecretKey,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata,
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  /**
   * Retrieve project metadata from IPFS
   */
  async retrieveProjectMetadata(ipfsUri: string): Promise<ProjectMetadata | null> {
    try {
      const hash = ipfsUri.replace('ipfs://', '');
      const url = `${this.pinataGatewayUrl}/ipfs/${hash}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }

      const metadata = await response.json();
      
      logger.info('Project metadata retrieved from IPFS', {
        ipfsUri,
        projectName: metadata.name
      });

      return metadata;
    } catch (error) {
      logger.error('Failed to retrieve metadata from IPFS', error);
      return null;
    }
  }

  /**
   * Upload image to IPFS
   */
  async uploadImage(file: File): Promise<string> {
    try {
      // Check if we have any Pinata credentials
      const hasCredentials = this.useJwt || (this.pinataApiKey && this.pinataSecretKey);
      
      if (!hasCredentials) {
        logger.warn('No Pinata credentials configured, using mock image hash');
        return this.generateMockIPFSUri('image');
      }

      // Ensure groups exist
      await this.ensureGroups();

      let ipfsHash: string;

      if (this.useJwt) {
        // Use JWT-based upload (newer method)
        ipfsHash = await this.uploadImageWithJwt(file);
      } else {
        // Use API key/secret upload (legacy method)
        ipfsHash = await this.uploadImageWithApiKeys(file);
      }
      
      logger.info('Image uploaded to IPFS', {
        fileName: file.name,
        ipfsHash,
        pinataUrl: `${this.pinataGatewayUrl}/ipfs/${ipfsHash}`,
        method: this.useJwt ? 'JWT' : 'API_KEYS',
        groupId: this.groups.images
      });

      return `ipfs://${ipfsHash}`;
    } catch (error) {
      logger.error('Failed to upload image to IPFS', error);
      // Fallback to mock URI for development
      return this.generateMockIPFSUri('image');
    }
  }

  /**
   * Upload image using JWT (recommended method)
   */
  private async uploadImageWithJwt(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const metadata: PinataMetadata = {
      name: file.name,
    };

    // Add to images group if available
    if (this.groups.images) {
      metadata.group_id = this.groups.images;
      logger.info('Assigning image to group', { 
        groupId: this.groups.images, 
        fileName: metadata.name 
      });
    } else {
      logger.warn('No images group available for assignment');
    }

    formData.append('pinataMetadata', JSON.stringify(metadata));
    
    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.pinataJwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata JWT API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  /**
   * Upload image using API keys (legacy method)
   */
  private async uploadImageWithApiKeys(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const metadata: PinataMetadata = {
      name: file.name,
    };

    // Add to images group if available
    if (this.groups.images) {
      metadata.group_id = this.groups.images;
    }

    formData.append('pinataMetadata', JSON.stringify(metadata));
    
    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': this.pinataApiKey,
        'pinata_secret_api_key': this.pinataSecretKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  /**
   * Upload document to IPFS (for additional files like whitepapers, etc.)
   */
  async uploadDocument(file: File): Promise<string> {
    try {
      // Check if we have any Pinata credentials
      const hasCredentials = this.useJwt || (this.pinataApiKey && this.pinataSecretKey);
      
      if (!hasCredentials) {
        logger.warn('No Pinata credentials configured, using mock document hash');
        return this.generateMockIPFSUri('document');
      }

      // Ensure groups exist
      await this.ensureGroups();

      let ipfsHash: string;

      if (this.useJwt) {
        // Use JWT-based upload (newer method)
        ipfsHash = await this.uploadDocumentWithJwt(file);
      } else {
        // Use API key/secret upload (legacy method)
        ipfsHash = await this.uploadDocumentWithApiKeys(file);
      }
      
      logger.info('Document uploaded to IPFS', {
        fileName: file.name,
        ipfsHash,
        pinataUrl: `${this.pinataGatewayUrl}/ipfs/${ipfsHash}`,
        method: this.useJwt ? 'JWT' : 'API_KEYS',
        groupId: this.groups.documents
      });

      return `ipfs://${ipfsHash}`;
    } catch (error) {
      logger.error('Failed to upload document to IPFS', error);
      // Fallback to mock URI for development
      return this.generateMockIPFSUri('document');
    }
  }

  /**
   * Upload document using JWT (recommended method)
   */
  private async uploadDocumentWithJwt(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const metadata: PinataMetadata = {
      name: file.name,
    };

    // Add to documents group if available
    if (this.groups.documents) {
      metadata.group_id = this.groups.documents;
    }

    formData.append('pinataMetadata', JSON.stringify(metadata));
    
    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.pinataJwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata JWT API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  /**
   * Upload document using API keys (legacy method)
   */
  private async uploadDocumentWithApiKeys(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const metadata: PinataMetadata = {
      name: file.name,
    };

    // Add to documents group if available
    if (this.groups.documents) {
      metadata.group_id = this.groups.documents;
    }

    formData.append('pinataMetadata', JSON.stringify(metadata));
    
    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': this.pinataApiKey,
        'pinata_secret_api_key': this.pinataSecretKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  /**
   * Get all groups for this account
   */
  async getGroups(): Promise<PinataGroup[]> {
    const hasCredentials = this.useJwt || (this.pinataApiKey && this.pinataSecretKey);
    
    if (!hasCredentials) {
      logger.warn('No Pinata credentials, cannot fetch groups');
      return [];
    }

    try {
      const url = 'https://api.pinata.cloud/groups';
      
      const headers: Record<string, string> = {};

      if (this.useJwt) {
        headers['Authorization'] = `Bearer ${this.pinataJwt}`;
      } else {
        headers['pinata_api_key'] = this.pinataApiKey;
        headers['pinata_secret_api_key'] = this.pinataSecretKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.groups || [];
    } catch (error) {
      logger.error('Failed to fetch groups', error);
      return [];
    }
  }

  /**
   * Get files in a specific group
   */
  async getGroupFiles(groupId: string): Promise<PinataFile[]> {
    const hasCredentials = this.useJwt || (this.pinataApiKey && this.pinataSecretKey);
    
    if (!hasCredentials) {
      logger.warn('No Pinata credentials, cannot fetch group files');
      return [];
    }

    try {
      const url = `https://api.pinata.cloud/data/pinList?group_id=${groupId}`;
      
      const headers: Record<string, string> = {};

      if (this.useJwt) {
        headers['Authorization'] = `Bearer ${this.pinataJwt}`;
      } else {
        headers['pinata_api_key'] = this.pinataApiKey;
        headers['pinata_secret_api_key'] = this.pinataSecretKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch group files: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.rows || [];
    } catch (error) {
      logger.error('Failed to fetch group files', error);
      return [];
    }
  }

  /**
   * Generate mock IPFS URI for development
   */
  private generateMockIPFSUri(type: string = 'metadata'): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const mockHash = `mock_${type}_${timestamp}_${randomId}`;
    
    logger.info('Generated mock IPFS URI', { mockHash, type });
    
    return `ipfs://${mockHash}`;
  }

  /**
   * Validate IPFS URI format
   */
  isValidIPFSUri(uri: string): boolean {
    return uri.startsWith('ipfs://') && uri.length > 7;
  }

  /**
   * Get HTTP gateway URL from IPFS URI
   */
  getGatewayUrl(ipfsUri: string): string {
    if (!this.isValidIPFSUri(ipfsUri)) {
      throw new Error('Invalid IPFS URI');
    }
    
    const hash = ipfsUri.replace('ipfs://', '');
    return `${this.pinataGatewayUrl}/ipfs/${hash}`;
  }
}

// Export singleton instance
export const ipfsUtils = new IPFSUtils();

// Export the class for testing
export { IPFSUtils };
