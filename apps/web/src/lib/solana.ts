export {
  solanaConnection,
  getSolanaConnection,
  setNetwork,
  getNetwork,
  getCurrentRpcEndpoint,
  refreshSolanaConnection,
  simulateSolanaTransaction,
  sendSolanaTransaction,
  getSolanaAccountInfo,
  getSolanaBalance,
  getSolanaNetworkStatus,
  sendRawTransaction,
} from '@pnl/shared/solana';

import { solanaConnection } from '@pnl/shared/solana';
export default solanaConnection;
