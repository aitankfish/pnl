'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { ShoppingBag, Shirt, Coffee, Package, Sparkles, Loader2, RefreshCw, AlertCircle, Check, X, ChevronDown, CreditCard, ExternalLink } from 'lucide-react';
import { useSolPrice } from '@/hooks/useSolPrice';
import { useWallet } from '@/hooks/useWallet';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useWallets, useSignAndSendTransaction, useStandardWallets } from '@privy-io/react-auth/solana';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { useToast } from '@/lib/hooks/useToast';
import { getSolanaConnection } from '@/lib/solana';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// Payment receiving address for merch
const MERCH_PAYMENT_ADDRESS = 'BoK57Rf2NV1bdiFvvDeev1HPp5g2B72eH8SCoVkkSVsb';

interface ProductOption {
  name: string;
  type: string;
  values: Array<{ id: number; title: string }>;
}

interface ProductVariant {
  id: number;
  title: string;
  priceUSD: number;
  available: boolean;
}

interface ProductImage {
  src: string;
  variantIds: number[];
  isDefault: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  image: string | null;
  images: ProductImage[];
  priceUSD: number;
  priceRangeUSD: { min: number; max: number } | null;
  variants: ProductVariant[];
  options?: ProductOption[];
  visible: boolean;
}

type PaymentStatus = 'idle' | 'connecting' | 'preparing' | 'signing' | 'confirming' | 'creating_order' | 'success' | 'error';

export default function MerchPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Product modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [printifyOrderId, setPrintifyOrderId] = useState<string | null>(null);

  // Shipping address state
  const [shippingAddress, setShippingAddress] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  });

  const { solPrice, isLoading: solPriceLoading } = useSolPrice();
  const { primaryWallet, authenticated } = useWallet();
  const { showAuthModal } = useAuthModal();
  const { wallets } = useWallets();
  const { wallets: standardWallets } = useStandardWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { network } = useNetwork();
  const { showToast } = useToast();

  const categories = [
    { id: 'all', label: 'All', icon: Package },
    { id: 'apparel', label: 'Apparel', icon: Shirt },
    { id: 'accessories', label: 'Accessories', icon: Coffee },
  ];

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/printify/products');
      const result = await response.json();

      if (result.success) {
        setProducts(result.data || []);
      } else {
        setError(result.error || 'Failed to fetch products');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Convert USD to SOL
  const usdToSol = (usd: number): number => {
    if (!solPrice || solPrice === 0) return 0;
    return usd / solPrice;
  };

  const usdToSolString = (usd: number): string => {
    const sol = usdToSol(usd);
    return sol > 0 ? sol.toFixed(4) : '...';
  };

  // Filter products by category
  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  // Parse variant options from variant title (e.g., "Black / S" -> { Color: "Black", Size: "S" })
  const parseVariantOptions = (variant: ProductVariant, product: Product): Record<string, string> => {
    const options: Record<string, string> = {};
    if (!product.options || product.options.length === 0) return options;

    const parts = variant.title.split(' / ');
    product.options.forEach((opt, index) => {
      if (parts[index]) {
        options[opt.name] = parts[index];
      }
    });
    return options;
  };

  // Get image for selected variant
  const getVariantImage = useMemo(() => {
    if (!selectedProduct) return selectedProduct?.image || null;

    // If we have a selected variant, find an image that includes this variant
    if (selectedVariant) {
      const variantImage = selectedProduct.images.find(img =>
        img.variantIds.includes(selectedVariant.id)
      );
      if (variantImage) return variantImage.src;
    }

    // Fallback to default image or first image
    const defaultImg = selectedProduct.images.find(img => img.isDefault);
    if (defaultImg) return defaultImg.src;

    return selectedProduct.images[0]?.src || selectedProduct.image;
  }, [selectedProduct, selectedVariant]);

  // Get unique option values from variants
  const getOptionValues = useMemo(() => {
    if (!selectedProduct?.options) return {};

    const optionValues: Record<string, Set<string>> = {};
    selectedProduct.options.forEach(opt => {
      optionValues[opt.name] = new Set();
    });

    selectedProduct.variants.forEach(variant => {
      if (!variant.available) return;
      const parsed = parseVariantOptions(variant, selectedProduct);
      Object.entries(parsed).forEach(([key, value]) => {
        if (optionValues[key]) {
          optionValues[key].add(value);
        }
      });
    });

    // Convert to arrays
    const result: Record<string, string[]> = {};
    Object.entries(optionValues).forEach(([key, values]) => {
      result[key] = Array.from(values);
    });
    return result;
  }, [selectedProduct]);

  // Find matching variant based on selected options
  useEffect(() => {
    if (!selectedProduct) return;

    // If no options, use first available variant
    if (!selectedProduct.options || selectedProduct.options.length === 0) {
      const firstAvailable = selectedProduct.variants.find(v => v.available);
      setSelectedVariant(firstAvailable || null);
      return;
    }

    // Find variant matching all selected options
    const allOptionsSelected = selectedProduct.options.every(opt => selectedOptions[opt.name]);
    if (!allOptionsSelected) {
      setSelectedVariant(null);
      return;
    }

    const matchingVariant = selectedProduct.variants.find(variant => {
      if (!variant.available) return false;
      const variantOpts = parseVariantOptions(variant, selectedProduct);
      return selectedProduct.options!.every(opt =>
        variantOpts[opt.name] === selectedOptions[opt.name]
      );
    });

    setSelectedVariant(matchingVariant || null);
  }, [selectedOptions, selectedProduct]);

  // Check if shipping address is complete
  const isShippingComplete = () => {
    return (
      shippingAddress.fullName.trim() !== '' &&
      shippingAddress.email.trim() !== '' &&
      shippingAddress.address.trim() !== '' &&
      shippingAddress.city.trim() !== '' &&
      shippingAddress.country.trim() !== ''
    );
  };

  // Open product modal
  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setSelectedOptions({});
    setSelectedVariant(null);
    setPaymentStatus('idle');
    setPaymentError(null);
    setTxSignature(null);
    setPrintifyOrderId(null);
    setShippingAddress({
      fullName: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    });

    // Auto-select first option for each
    if (product.options) {
      const initialOptions: Record<string, string> = {};
      product.options.forEach(opt => {
        const firstAvailable = product.variants.find(v => v.available);
        if (firstAvailable) {
          const parsed = parseVariantOptions(firstAvailable, product);
          if (parsed[opt.name]) {
            initialOptions[opt.name] = parsed[opt.name];
          }
        }
      });
      setSelectedOptions(initialOptions);
    }
  };

  // Close product modal
  const closeProductModal = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setSelectedOptions({});
    setPaymentStatus('idle');
    setPaymentError(null);
    setShippingAddress({
      fullName: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    });
  };

  // Handle SOL payment
  const handlePayment = async () => {
    if (!selectedVariant || !selectedProduct) return;

    // Check shipping address
    if (!isShippingComplete()) {
      setPaymentError('Please fill in all required shipping fields.');
      return;
    }

    // Check wallet connection
    if (!authenticated || !primaryWallet) {
      showAuthModal();
      return;
    }

    const solAmount = usdToSol(selectedVariant.priceUSD);
    if (solAmount <= 0) {
      setPaymentError('Unable to calculate SOL price. Please try again.');
      return;
    }

    setPaymentStatus('preparing');
    setPaymentError(null);

    try {
      // Get connection and create transaction
      const connection = await getSolanaConnection();
      const fromPubkey = new PublicKey(primaryWallet.address);
      const toPubkey = new PublicKey(MERCH_PAYMENT_ADDRESS);

      // Create transfer transaction
      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
        })
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      setPaymentStatus('signing');

      // Get Solana wallet
      let solanaWallet;
      if (wallets && wallets.length > 0) {
        solanaWallet = wallets[0];
      } else if (standardWallets && standardWallets.length > 0) {
        const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
        if (!privyWallet) throw new Error('No Privy wallet found');
        solanaWallet = privyWallet;
      } else {
        throw new Error('No Solana wallet found');
      }

      // Serialize transaction
      const serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // Sign and send with Privy
      const result = await signAndSendTransaction({
        transaction: serializedTx,
        wallet: solanaWallet as any,
        chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });

      const signature = bs58.encode(result.signature);
      setTxSignature(signature);
      setPaymentStatus('confirming');

      // Wait for confirmation
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      // Create order on Printify
      setPaymentStatus('creating_order');

      try {
        const orderResponse = await fetch('/api/printify/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: selectedProduct.id,
            variantId: selectedVariant.id,
            quantity: 1,
            shippingAddress,
            txSignature: signature,
          }),
        });

        const orderResult = await orderResponse.json();

        if (orderResult.success) {
          setPrintifyOrderId(orderResult.data.orderId);
          console.log('Printify order created:', orderResult.data.orderId);
          showToast({
            type: 'success',
            title: 'Order Placed!',
            message: `Your order has been placed successfully. Order ID: ${orderResult.data.orderId}`,
            details: [`Shipping to: ${shippingAddress.city}, ${shippingAddress.country}`],
          });
        } else {
          // Log error but don't fail - payment was successful
          console.error('Failed to create Printify order:', orderResult.error);
          showToast({
            type: 'success',
            title: 'Payment Successful',
            message: 'Payment confirmed! Order creation pending - we\'ll process it manually.',
          });
        }
      } catch (orderErr) {
        console.error('Error creating Printify order:', orderErr);
        showToast({
          type: 'success',
          title: 'Payment Successful',
          message: 'Payment confirmed! Order creation pending - we\'ll process it manually.',
        });
      }

      setPaymentStatus('success');

    } catch (err: any) {
      console.error('Payment failed:', err);
      const errorMessage = err.message || 'Payment failed. Please try again.';
      setPaymentError(errorMessage);
      setPaymentStatus('error');
      showToast({
        type: 'error',
        title: 'Payment Failed',
        message: errorMessage,
      });
    }
  };

  // Get Solscan URL for transaction
  const getSolscanUrl = (signature: string) => {
    const cluster = network === 'devnet' ? '?cluster=devnet' : '';
    return `https://solscan.io/tx/${signature}${cluster}`;
  };

  return (
    <div className="min-h-screen pb-20">
      <Sidebar currentPage="merch" />

      <div className="pt-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500/20 to-orange-500/20 rounded-full border border-pink-500/30 mb-4">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="text-sm text-pink-300">Official Merch</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              P&L Merch Shop
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Wear your belief. Rep the revolution. Every purchase supports the P&L ecosystem.
            </p>
            {/* SOL Price Indicator */}
            {!solPriceLoading && solPrice && (
              <p className="text-gray-500 text-sm mt-2">
                1 SOL = ${solPrice.toFixed(2)} USD
              </p>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const count = cat.id === 'all'
                ? products.length
                : products.filter(p => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl transition-all
                    ${selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{cat.label}</span>
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      selectedCategory === cat.id ? 'bg-white/20' : 'bg-white/10'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Refresh Button */}
            <button
              onClick={fetchProducts}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
              title="Refresh products"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-pink-500 animate-spin mb-4" />
              <p className="text-gray-400">Loading products...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-red-400 font-semibold mb-1">Failed to load products</h3>
                  <p className="text-gray-400 text-sm mb-3">{error}</p>
                  <button
                    onClick={fetchProducts}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && !error && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="group bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-pink-500/50 transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => openProductModal(product)}
                >
                  {/* Product Image */}
                  <div className="aspect-square bg-gradient-to-br from-pink-500/10 to-orange-500/10 flex items-center justify-center overflow-hidden relative">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <ShoppingBag className="w-16 h-16 text-white/20 group-hover:text-white/40 transition-colors" />
                    )}
                    {/* Buy Icon Overlay */}
                    <button
                      className="absolute top-2 right-2 p-2 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full shadow-lg hover:scale-110 transition-transform opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductModal(product);
                      }}
                      title="Buy now"
                    >
                      <ShoppingBag className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-white font-semibold line-clamp-1 flex-1">{product.title}</h3>
                      <span className="text-xs px-2 py-0.5 bg-white/10 text-gray-400 rounded capitalize">
                        {product.category}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                      {product.description?.replace(/<[^>]*>/g, '') || 'Premium quality merch'}
                    </p>

                    {/* Prices */}
                    <div className="space-y-1">
                      {/* SOL Price */}
                      <div className="flex items-center justify-between">
                        <span className="text-purple-400 font-bold text-lg">
                          {product.priceRangeUSD
                            ? `${usdToSolString(product.priceRangeUSD.min)} - ${usdToSolString(product.priceRangeUSD.max)} SOL`
                            : `${usdToSolString(product.priceUSD)} SOL`
                          }
                        </span>
                      </div>
                      {/* USD Price (smaller) */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">
                          {product.priceRangeUSD
                            ? `$${product.priceRangeUSD.min.toFixed(2)} - $${product.priceRangeUSD.max.toFixed(2)}`
                            : `$${product.priceUSD.toFixed(2)}`
                          }
                        </span>
                        <span className="text-xs text-gray-600">
                          {product.variants?.length || 0} variants
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredProducts.length === 0 && products.length === 0 && (
            <div className="text-center py-20">
              <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No products yet</h3>
              <p className="text-gray-400 mb-6">
                Products will appear here once they&apos;re added to the Printify store.
              </p>
            </div>
          )}

          {/* No results for filter */}
          {!isLoading && !error && filteredProducts.length === 0 && products.length > 0 && (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No products in this category</h3>
              <p className="text-gray-400">
                Try selecting a different category or view all products.
              </p>
            </div>
          )}

          {/* Order Info & Support */}
          <div className="bg-gradient-to-br from-pink-500/10 to-orange-500/10 rounded-2xl border border-pink-500/30 p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-xl flex-shrink-0">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Order & Shipping</h3>
                  <p className="text-gray-400 text-sm">
                    You&apos;ll receive email updates from Printify when your order is confirmed, in production, and shipped with tracking info.
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h4 className="text-white font-medium mb-2">Need Help?</h4>
                <p className="text-gray-400 text-sm mb-3">
                  If you have any issues with your order, reach out to us on Discord with your wallet address or transaction signature.
                </p>
                <a
                  href="https://discord.gg/NGb97x4N"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865F2]/20 text-[#5865F2] rounded-lg border border-[#5865F2]/30 hover:bg-[#5865F2]/30 transition-colors text-sm font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Join our Discord
                </a>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <div className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/30">
                  Print-on-Demand
                </div>
                <div className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs rounded-lg border border-blue-500/30">
                  US & Canada Only
                </div>
                <div className="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded-lg border border-purple-500/30">
                  Pay with SOL
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeProductModal}
        >
          <div
            className="bg-gray-900 rounded-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-white/10 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{selectedProduct.title}</h2>
              <button
                onClick={closeProductModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Product Image - Updates based on selected variant */}
                <div className="aspect-square bg-gradient-to-br from-pink-500/10 to-orange-500/10 rounded-xl overflow-hidden relative">
                  {getVariantImage ? (
                    <img
                      src={getVariantImage}
                      alt={selectedProduct.title}
                      className="w-full h-full object-cover transition-opacity duration-300"
                      key={getVariantImage} // Force re-render on image change
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-20 h-20 text-white/20" />
                    </div>
                  )}
                  {/* Image loading indicator */}
                  {selectedVariant && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded-lg text-xs text-gray-300">
                      {selectedVariant.title}
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    {selectedProduct.description?.replace(/<[^>]*>/g, '') || 'Premium quality merch'}
                  </p>

                  {/* Variant Selectors */}
                  {selectedProduct.options && selectedProduct.options.length > 0 && (
                    <div className="space-y-3">
                      {selectedProduct.options.map((option) => (
                        <div key={option.name}>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            {option.name}
                          </label>
                          <div className="relative">
                            <select
                              value={selectedOptions[option.name] || ''}
                              onChange={(e) => setSelectedOptions(prev => ({
                                ...prev,
                                [option.name]: e.target.value
                              }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none cursor-pointer hover:border-pink-500/50 transition-colors"
                            >
                              <option value="" disabled>Select {option.name}</option>
                              {getOptionValues[option.name]?.map((value) => (
                                <option key={value} value={value} className="bg-gray-900">
                                  {value}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shipping Address Form */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-300">Shipping Address</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={shippingAddress.fullName}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))}
                        className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-pink-500/50 focus:outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email *"
                        value={shippingAddress.email}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, email: e.target.value }))}
                        className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-pink-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Street Address *"
                        value={shippingAddress.address}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, address: e.target.value }))}
                        className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-pink-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="City *"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-pink-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="State/Province"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-pink-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="ZIP/Postal Code"
                        value={shippingAddress.zipCode}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, zipCode: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-pink-500/50 focus:outline-none"
                      />
                      <div className="relative">
                        <select
                          value={shippingAddress.country}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer focus:border-pink-500/50 focus:outline-none"
                        >
                          <option value="" disabled className="bg-gray-900">Country *</option>
                          <option value="United States" className="bg-gray-900">United States</option>
                          <option value="Canada" className="bg-gray-900">Canada</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total</span>
                      {selectedVariant ? (
                        <div className="text-right">
                          <div className="text-purple-400 font-bold text-xl">
                            {usdToSolString(selectedVariant.priceUSD)} SOL
                          </div>
                          <div className="text-gray-500 text-sm">
                            ${selectedVariant.priceUSD.toFixed(2)} USD
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Select options</span>
                      )}
                    </div>
                  </div>

                  {/* Payment Status */}
                  {paymentStatus === 'success' && txSignature && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-green-400 mb-2">
                        <Check className="w-5 h-5" />
                        <span className="font-semibold">Order Placed Successfully!</span>
                      </div>
                      {printifyOrderId && (
                        <p className="text-purple-400 text-sm mb-2">
                          Order ID: <span className="font-mono">{printifyOrderId}</span>
                        </p>
                      )}
                      <p className="text-gray-400 text-sm mb-3">
                        Your order is being processed. Shipping to:
                      </p>
                      <div className="bg-black/20 rounded-lg p-3 mb-3 text-sm">
                        <p className="text-white font-medium">{shippingAddress.fullName}</p>
                        <p className="text-gray-400">{shippingAddress.address}</p>
                        <p className="text-gray-400">
                          {shippingAddress.city}{shippingAddress.state ? `, ${shippingAddress.state}` : ''} {shippingAddress.zipCode}
                        </p>
                        <p className="text-gray-400">{shippingAddress.country}</p>
                        <p className="text-gray-500 text-xs mt-1">{shippingAddress.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={getSolscanUrl(txSignature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
                        >
                          View Payment <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-gray-500 text-xs mt-3">
                        You&apos;ll receive shipping updates at {shippingAddress.email}
                      </p>
                    </div>
                  )}

                  {paymentStatus === 'error' && paymentError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Payment Failed</span>
                      </div>
                      <p className="text-gray-400 text-sm">{paymentError}</p>
                    </div>
                  )}

                  {/* Pay Button */}
                  <button
                    onClick={handlePayment}
                    disabled={!selectedVariant || !isShippingComplete() || paymentStatus === 'signing' || paymentStatus === 'confirming' || paymentStatus === 'preparing' || paymentStatus === 'creating_order' || paymentStatus === 'success'}
                    className={`
                      w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                      ${!selectedVariant || !isShippingComplete() || paymentStatus === 'success'
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : paymentStatus === 'signing' || paymentStatus === 'confirming' || paymentStatus === 'preparing' || paymentStatus === 'creating_order'
                        ? 'bg-purple-600 text-white cursor-wait'
                        : 'bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90'
                      }
                    `}
                  >
                    {paymentStatus === 'preparing' && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Preparing Transaction...
                      </>
                    )}
                    {paymentStatus === 'signing' && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Confirm in Wallet...
                      </>
                    )}
                    {paymentStatus === 'confirming' && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Confirming on Solana...
                      </>
                    )}
                    {paymentStatus === 'creating_order' && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Order...
                      </>
                    )}
                    {paymentStatus === 'success' && (
                      <>
                        <Check className="w-5 h-5" />
                        Order Complete
                      </>
                    )}
                    {(paymentStatus === 'idle' || paymentStatus === 'error') && (
                      <>
                        <CreditCard className="w-5 h-5" />
                        {!authenticated
                          ? 'Connect Wallet to Pay'
                          : !selectedVariant
                          ? 'Select Options'
                          : !isShippingComplete()
                          ? 'Enter Shipping Address'
                          : `Pay ${usdToSolString(selectedVariant.priceUSD)} SOL`
                        }
                      </>
                    )}
                  </button>

                  {/* Info Note */}
                  <p className="text-gray-500 text-xs text-center">
                    Your shipping address will be saved with your order.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
