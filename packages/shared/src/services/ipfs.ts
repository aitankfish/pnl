/**
 * IPFS Integration (shared)
 * Client-side IPFS metadata storage and retrieval
 */

import { getEnvConfig } from '../config/environment';
import { createClientLogger } from '../utils/logger';

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
  videoUrl?: string;
  additionalNotes?: string;
  image?: string;
  documents?: string[];
  createdAt: string;
  updatedAt: string;
}

export class IPFSClient {
  private _jwt: string | null = null;
  private _gatewayUrl: string | null = null;

  private get jwt(): string {
    if (this._jwt === null) {
      this._jwt = getEnvConfig().PINATA_JWT;
    }
    return this._jwt;
  }

  private get gatewayUrl(): string {
    if (this._gatewayUrl === null) {
      this._gatewayUrl = getEnvConfig().PINATA_GATEWAY_URL;
    }
    return this._gatewayUrl;
  }

  async uploadProjectMetadata(metadata: ProjectMetadata): Promise<string> {
    if (!this.jwt) {
      logger.warn('No Pinata JWT, using mock IPFS hash');
      return `ipfs://mock_metadata_${Date.now()}`;
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.jwt}` },
      body: JSON.stringify({ pinataContent: metadata, pinataMetadata: { name: `${metadata.name}-metadata.json` }, pinataOptions: { cidVersion: 1 } }),
    });

    if (!response.ok) throw new Error(`Pinata error: ${response.status} ${response.statusText}`);
    const result = await response.json();
    return `ipfs://${result.IpfsHash}`;
  }

  async retrieveProjectMetadata(ipfsUri: string): Promise<ProjectMetadata | null> {
    try {
      const hash = ipfsUri.replace('ipfs://', '');
      const response = await fetch(`${this.gatewayUrl}/ipfs/${hash}`);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      logger.error('Failed to retrieve metadata from IPFS', error);
      return null;
    }
  }

  async uploadImage(file: File): Promise<string> {
    if (!this.jwt) return `ipfs://mock_image_${Date.now()}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({ name: file.name }));
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.jwt}` },
      body: formData,
    });

    if (!response.ok) throw new Error(`Pinata error: ${response.status}`);
    const result = await response.json();
    return `ipfs://${result.IpfsHash}`;
  }

  isValidIPFSUri(uri: string): boolean {
    return uri.startsWith('ipfs://') && uri.length > 7;
  }

  getGatewayUrl(ipfsUri: string): string {
    const hash = ipfsUri.replace('ipfs://', '');
    return `${this.gatewayUrl}/ipfs/${hash}`;
  }
}

let _ipfsClient: IPFSClient | null = null;
export function getIpfsClient(): IPFSClient {
  if (!_ipfsClient) _ipfsClient = new IPFSClient();
  return _ipfsClient;
}
