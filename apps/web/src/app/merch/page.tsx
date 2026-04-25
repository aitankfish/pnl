'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ExternalLink,
  Shirt,
} from 'lucide-react';
import {
  BasketIcon,
  SeedIcon,
  BloomIcon,
  SunIcon,
  LeafIcon,
} from '@/components/PlantIcons';
import { useSolPrice } from '@/hooks/useSolPrice';
import { useWallet } from '@/hooks/useWallet';
import { useAuthModal } from '@/contexts/AuthModalContext';
import {
  useWallets,
  useSignAndSendTransaction,
  useStandardWallets,
} from '@privy-io/react-auth/solana';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { useToast } from '@/lib/hooks/useToast';
import { getSolanaConnection } from '@/lib/solana';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';

// ── Cosmic-plant palette (shared with rest of app) ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.14)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

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

type PaymentStatus =
  | 'idle'
  | 'connecting'
  | 'preparing'
  | 'signing'
  | 'confirming'
  | 'creating_order'
  | 'success'
  | 'error';

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

  // Plant glyph per category — basket for "all", shirt stays for apparel since
  // it reads instantly, leaf for accessories (smaller things, second skin).
  const categories = [
    { id: 'all', label: 'All', Icon: BasketIcon as React.ComponentType<{ className?: string }> },
    { id: 'apparel', label: 'Apparel', Icon: Shirt as React.ComponentType<{ className?: string }> },
    { id: 'accessories', label: 'Accessories', Icon: LeafIcon as React.ComponentType<{ className?: string }> },
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

  const usdToSol = (usd: number): number => {
    if (!solPrice || solPrice === 0) return 0;
    return usd / solPrice;
  };

  const usdToSolString = (usd: number): string => {
    const sol = usdToSol(usd);
    return sol > 0 ? sol.toFixed(4) : '...';
  };

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const parseVariantOptions = (
    variant: ProductVariant,
    product: Product,
  ): Record<string, string> => {
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

  const getVariantImage = useMemo(() => {
    if (!selectedProduct) return null;
    if (selectedVariant) {
      const variantImage = selectedProduct.images.find((img) =>
        img.variantIds.includes(selectedVariant.id),
      );
      if (variantImage) return variantImage.src;
    }
    const defaultImg = selectedProduct.images.find((img) => img.isDefault);
    if (defaultImg) return defaultImg.src;
    return selectedProduct.images[0]?.src || selectedProduct.image;
  }, [selectedProduct, selectedVariant]);

  const getOptionValues = useMemo(() => {
    if (!selectedProduct?.options) return {} as Record<string, string[]>;

    const optionValues: Record<string, Set<string>> = {};
    selectedProduct.options.forEach((opt) => {
      optionValues[opt.name] = new Set();
    });

    selectedProduct.variants.forEach((variant) => {
      if (!variant.available) return;
      const parsed = parseVariantOptions(variant, selectedProduct);
      Object.entries(parsed).forEach(([key, value]) => {
        if (optionValues[key]) optionValues[key].add(value);
      });
    });

    const result: Record<string, string[]> = {};
    Object.entries(optionValues).forEach(([key, values]) => {
      result[key] = Array.from(values);
    });
    return result;
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) return;

    if (!selectedProduct.options || selectedProduct.options.length === 0) {
      const firstAvailable = selectedProduct.variants.find((v) => v.available);
      setSelectedVariant(firstAvailable || null);
      return;
    }

    const allOptionsSelected = selectedProduct.options.every(
      (opt) => selectedOptions[opt.name],
    );
    if (!allOptionsSelected) {
      setSelectedVariant(null);
      return;
    }

    const matchingVariant = selectedProduct.variants.find((variant) => {
      if (!variant.available) return false;
      const variantOpts = parseVariantOptions(variant, selectedProduct);
      return selectedProduct.options!.every(
        (opt) => variantOpts[opt.name] === selectedOptions[opt.name],
      );
    });

    setSelectedVariant(matchingVariant || null);
  }, [selectedOptions, selectedProduct]);

  const isShippingComplete = () =>
    shippingAddress.fullName.trim() !== '' &&
    shippingAddress.email.trim() !== '' &&
    shippingAddress.address.trim() !== '' &&
    shippingAddress.city.trim() !== '' &&
    shippingAddress.country.trim() !== '';

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

    if (product.options) {
      const initialOptions: Record<string, string> = {};
      product.options.forEach((opt) => {
        const firstAvailable = product.variants.find((v) => v.available);
        if (firstAvailable) {
          const parsed = parseVariantOptions(firstAvailable, product);
          if (parsed[opt.name]) initialOptions[opt.name] = parsed[opt.name];
        }
      });
      setSelectedOptions(initialOptions);
    }
  };

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

  const handlePayment = async () => {
    if (!selectedVariant || !selectedProduct) return;

    if (!isShippingComplete()) {
      setPaymentError('Please fill in all required shipping fields.');
      return;
    }

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
      const connection = await getSolanaConnection();
      const fromPubkey = new PublicKey(primaryWallet.address);
      const toPubkey = new PublicKey(MERCH_PAYMENT_ADDRESS);

      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
        }),
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      setPaymentStatus('signing');

      let solanaWallet;
      if (wallets && wallets.length > 0) {
        solanaWallet = wallets[0];
      } else if (standardWallets && standardWallets.length > 0) {
        const privyWallet = standardWallets.find(
          (w: any) => w.isPrivyWallet || w.name === 'Privy',
        );
        if (!privyWallet) throw new Error('No Privy wallet found');
        solanaWallet = privyWallet;
      } else {
        throw new Error('No Solana wallet found');
      }

      const serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const result = await signAndSendTransaction({
        transaction: serializedTx,
        wallet: solanaWallet as any,
        chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });

      const signature = bs58.encode(result.signature);
      setTxSignature(signature);
      setPaymentStatus('confirming');

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

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
          showToast({
            type: 'success',
            title: 'Order Placed!',
            message: `Your order has been placed successfully. Order ID: ${orderResult.data.orderId}`,
            details: [`Shipping to: ${shippingAddress.city}, ${shippingAddress.country}`],
          });
        } else if (orderResult.isTestMode) {
          showToast({
            type: 'success',
            title: 'Test Payment Successful!',
            message: 'Payment confirmed on devnet. No real order created (test mode).',
          });
        } else {
          console.error('Failed to create Printify order:', orderResult.error);
          showToast({
            type: 'success',
            title: 'Payment Successful',
            message: "Payment confirmed! Order creation pending — we'll process it manually.",
          });
        }
      } catch (orderErr) {
        console.error('Error creating Printify order:', orderErr);
        showToast({
          type: 'success',
          title: 'Payment Successful',
          message: "Payment confirmed! Order creation pending — we'll process it manually.",
        });
      }

      setPaymentStatus('success');
    } catch (err: any) {
      console.error('Payment failed:', err);
      const errorMessage = err.message || 'Payment failed. Please try again.';
      setPaymentError(errorMessage);
      setPaymentStatus('error');
      showToast({ type: 'error', title: 'Payment Failed', message: errorMessage });
    }
  };

  const getSolscanUrl = (signature: string) => {
    const cluster = network === 'devnet' ? '?cluster=devnet' : '';
    return `https://solscan.io/tx/${signature}${cluster}`;
  };

  // Reusable text-input class for the shipping form
  const inputCls =
    'w-full bg-transparent text-sm placeholder:text-[rgba(244,238,228,0.35)] focus:outline-none px-3 py-2 transition-colors';

  return (
    <div className="pb-20 px-4 md:px-8" style={{ color: CREAM }}>
      <div className="pt-6 sm:pt-10">
        <div className="max-w-6xl mx-auto">
          {/* ─── Editorial header ─── */}
          <header className="text-center mb-10 sm:mb-12">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              The harvest stand
            </p>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontFeatureSettings: '"ss01"',
              }}
            >
              Wear the grove.
            </h1>
            <p
              className="text-base sm:text-lg max-w-md mx-auto"
              style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
            >
              Goods from the orchard — paid in SOL, shipped from Printify.
            </p>
            {!solPriceLoading && solPrice && (
              <p
                className="mono text-[0.62rem] uppercase tracking-[0.24em] mt-4"
                style={{ color: CREAM_FAINT }}
              >
                1 SOL · ${solPrice.toFixed(2)} USD
              </p>
            )}
          </header>

          {/* ─── Category chips ─── */}
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat.Icon;
              const active = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? products.length
                  : products.filter((p) => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="mono text-[0.6rem] uppercase tracking-[0.22em] px-3 py-2 inline-flex items-center gap-2 transition-colors"
                  style={{
                    background: active ? AMBER : 'transparent',
                    color: active ? BG : CREAM_DIM,
                    border: `1px solid ${active ? AMBER : HAIR_STRONG}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = CREAM;
                      e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  {count > 0 && (
                    <span
                      className="text-[0.55rem] px-1 py-0.5"
                      style={{
                        background: active ? 'rgba(10,8,20,0.18)' : HAIR_STRONG,
                        color: active ? BG : CREAM_DIM,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Refresh */}
            <button
              onClick={fetchProducts}
              disabled={isLoading}
              className="px-3 py-2 inline-flex items-center justify-center transition-colors disabled:opacity-50"
              style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.color = CREAM;
                  e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = CREAM_DIM;
                e.currentTarget.style.borderColor = HAIR_STRONG;
              }}
              title="Refresh products"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* ─── Loading ─── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-24">
              <div
                className="w-7 h-7 mb-4 animate-spin"
                style={{
                  border: `1.5px solid ${HAIR_STRONG}`,
                  borderTopColor: AMBER,
                  borderRadius: '50%',
                }}
              />
              <p
                className="mono text-[0.62rem] uppercase tracking-[0.24em]"
                style={{ color: CREAM_FAINT }}
              >
                Gathering goods…
              </p>
            </div>
          )}

          {/* ─── Error ─── */}
          {error && !isLoading && (
            <div
              className="mb-8 p-5"
              style={{
                background: 'rgba(214,115,71,0.08)',
                border: `1px solid ${EARTH}55`,
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: EARTH }} />
                <div>
                  <h3
                    className="mb-1"
                    style={{ color: EARTH, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1rem' }}
                  >
                    The stand is empty.
                  </h3>
                  <p className="text-sm mb-3" style={{ color: CREAM_DIM }}>
                    {error}
                  </p>
                  <button
                    onClick={fetchProducts}
                    className="mono text-[0.6rem] uppercase tracking-[0.22em] px-3 py-1.5 transition-colors"
                    style={{ color: EARTH, border: `1px solid ${EARTH}55` }}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Product grid ─── */}
          {!isLoading && !error && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => openProductModal(product)}
                  className="group text-left transition-colors"
                  style={{
                    background: 'rgba(244,238,228,0.025)',
                    border: `1px solid ${HAIR_STRONG}`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = 'rgba(232,150,96,0.55)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
                >
                  {/* Image */}
                  <div
                    className="aspect-square flex items-center justify-center overflow-hidden relative"
                    style={{ background: 'rgba(232,150,96,0.06)' }}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <BasketIcon className="w-14 h-14" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-4 py-3">
                    <h3
                      className="line-clamp-1 mb-1"
                      style={{
                        color: CREAM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontWeight: 400,
                        fontSize: '0.95rem',
                      }}
                    >
                      {product.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span
                        className="mono tracking-[0.05em]"
                        style={{ color: AMBER, fontSize: '0.78rem' }}
                      >
                        {usdToSolString(product.priceUSD)} SOL
                      </span>
                      <span
                        className="mono text-[0.6rem] uppercase tracking-[0.18em]"
                        style={{ color: CREAM_FAINT }}
                      >
                        ${product.priceUSD.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ─── Empty: no products at all ─── */}
          {!isLoading && !error && filteredProducts.length === 0 && products.length === 0 && (
            <div
              className="text-center py-16 px-6"
              style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
            >
              <BasketIcon className="w-12 h-12 mx-auto mb-4" />
              <h3
                className="mb-2"
                style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.25rem' }}
              >
                The stand isn't stocked yet.
              </h3>
              <p className="mono text-[0.6rem] uppercase tracking-[0.22em]" style={{ color: CREAM_FAINT }}>
                Goods will appear here once the grove ships.
              </p>
            </div>
          )}

          {/* ─── Empty: filter mismatch ─── */}
          {!isLoading && !error && filteredProducts.length === 0 && products.length > 0 && (
            <div
              className="text-center py-16 px-6"
              style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
            >
              <SeedIcon className="w-12 h-12 mx-auto mb-4" />
              <h3
                className="mb-2"
                style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.25rem' }}
              >
                Nothing in this row.
              </h3>
              <p className="mono text-[0.6rem] uppercase tracking-[0.22em]" style={{ color: CREAM_FAINT }}>
                Try a different category or view all.
              </p>
            </div>
          )}

          {/* ─── Order info & support ─── */}
          <div
            className="mt-12 p-6 sm:p-8"
            style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}
          >
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                  style={{ background: `${AMBER}22`, border: `1px solid ${AMBER}55`, color: AMBER }}
                >
                  <BasketIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className="mb-1"
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '1.1rem',
                      fontWeight: 400,
                    }}
                  >
                    Order &amp; shipping
                  </h3>
                  <p className="text-sm" style={{ color: CREAM_DIM }}>
                    Printify will email you when your order is confirmed, in production, and shipped with tracking.
                  </p>
                </div>
              </div>

              <div className="pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                <h4
                  className="mb-2"
                  style={{
                    color: CREAM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.95rem',
                  }}
                >
                  Need help?
                </h4>
                <p className="text-sm mb-3" style={{ color: CREAM_DIM }}>
                  Reach out on Discord with your wallet address or transaction signature.
                </p>
                <a
                  href="https://discord.gg/38pkg4vm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-[0.62rem] uppercase tracking-[0.22em] inline-flex items-center gap-2 px-3 py-2 transition-colors"
                  style={{ color: '#5865F2', border: '1px solid rgba(88,101,242,0.4)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(88,101,242,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Join the Discord
                </a>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span
                  className="mono text-[0.55rem] uppercase tracking-[0.22em] px-2 py-1"
                  style={{ color: FOREST, border: `1px solid ${FOREST}55` }}
                >
                  Print on demand
                </span>
                <span
                  className="mono text-[0.55rem] uppercase tracking-[0.22em] px-2 py-1"
                  style={{ color: PEACH, border: `1px solid ${PEACH}55` }}
                >
                  US &amp; Canada only
                </span>
                <span
                  className="mono text-[0.55rem] uppercase tracking-[0.22em] px-2 py-1"
                  style={{ color: AMBER, border: `1px solid ${AMBER}55` }}
                >
                  Pay with SOL
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Product modal ─── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden"
          style={{ background: 'rgba(10,8,20,0.92)', backdropFilter: 'blur(14px)' }}
          onClick={closeProductModal}
        >
          {/* Cosmic warm starfield (matches landing palette) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: `
                  radial-gradient(2px 2px at 20% 30%, ${CREAM}, transparent),
                  radial-gradient(2px 2px at 60% 70%, ${CREAM}, transparent),
                  radial-gradient(1px 1px at 50% 50%, ${CREAM}, transparent),
                  radial-gradient(1px 1px at 80% 10%, ${PEACH}, transparent),
                  radial-gradient(2px 2px at 90% 60%, ${CREAM}, transparent),
                  radial-gradient(1px 1px at 33% 80%, ${AMBER}, transparent),
                  radial-gradient(1px 1px at 70% 40%, ${CREAM}, transparent),
                  radial-gradient(2px 2px at 10% 90%, ${EARTH}, transparent),
                  radial-gradient(1px 1px at 45% 15%, ${CREAM}, transparent)
                `,
                backgroundSize: '200% 200%',
                animation: 'float 20s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
              style={{
                background: `radial-gradient(ellipse at center, ${AMBER}33 0%, ${EARTH}11 40%, transparent 70%)`,
                animation: 'rotate 30s linear infinite',
              }}
            />
          </div>

          <div
            className="relative max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto"
            style={{
              background: 'rgba(10,8,20,0.96)',
              border: `1px solid ${HAIR_STRONG}`,
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="sticky top-0 px-4 sm:px-5 py-3 flex items-center justify-between z-10"
              style={{ background: 'rgba(10,8,20,0.94)', borderBottom: `1px solid ${HAIR}` }}
            >
              <h2
                className="truncate pr-2"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '1.1rem',
                  fontWeight: 400,
                }}
              >
                {selectedProduct.title}
              </h2>
              <button
                onClick={closeProductModal}
                className="p-2 transition-colors flex-shrink-0"
                style={{ color: CREAM_DIM }}
                onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Left — image + features */}
                <div className="space-y-3 sm:space-y-4">
                  <div
                    className="aspect-square max-h-[40vh] sm:max-h-none overflow-hidden relative mx-auto w-full max-w-[280px] sm:max-w-none"
                    style={{
                      background: 'rgba(232,150,96,0.08)',
                      border: `1px solid ${HAIR}`,
                    }}
                  >
                    {getVariantImage ? (
                      <img
                        src={getVariantImage}
                        alt={selectedProduct.title}
                        className="w-full h-full object-cover transition-opacity duration-300"
                        key={getVariantImage}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BasketIcon className="w-16 h-16" />
                      </div>
                    )}
                    {selectedVariant && (
                      <div
                        className="absolute bottom-2 right-2 mono text-[0.55rem] uppercase tracking-[0.22em] px-2 py-1"
                        style={{ background: 'rgba(10,8,20,0.7)', color: CREAM_DIM }}
                      >
                        {selectedVariant.title}
                      </div>
                    )}
                  </div>

                  {/* Key features */}
                  <div
                    className="text-xs sm:text-sm p-3 sm:p-4"
                    style={{
                      color: CREAM_DIM,
                      background: 'rgba(244,238,228,0.025)',
                      border: `1px solid ${HAIR}`,
                    }}
                  >
                    {(() => {
                      const desc = selectedProduct.description?.replace(/<[^>]*>/g, '') || '';
                      const features: string[] = [];

                      const materialMatch = desc.match(/made of\s+([^.]+)/i);
                      if (materialMatch) {
                        let material = materialMatch[0].trim();
                        material = material.replace(/\s+in\s+\d+.*$/i, '');
                        material = material.charAt(0).toUpperCase() + material.slice(1);
                        features.push(material);
                      }

                      const sizeMatch = desc.match(/(\d+)[-\s]?(ounce|oz)/gi);
                      if (sizeMatch) {
                        const sizes = [
                          ...new Set(
                            sizeMatch
                              .map((s) => {
                                const num = s.match(/\d+/)?.[0];
                                return num ? `${num}oz` : null;
                              })
                              .filter(Boolean),
                          ),
                        ];
                        if (sizes.length > 1) features.push(`Available in ${sizes.join(' & ')} sizes`);
                        else if (sizes.length === 1) features.push(`${sizes[0]} size`);
                      }

                      const safetyFeatures: string[] = [];
                      if (/BPA[- ]?free/i.test(desc)) safetyFeatures.push('BPA-free');
                      if (/lead[- ]?free/i.test(desc)) safetyFeatures.push('Lead-free');
                      if (safetyFeatures.length > 0) features.push(safetyFeatures.join(' & '));

                      const careFeatures: string[] = [];
                      if (/microwave/i.test(desc)) careFeatures.push('Microwave-safe');
                      if (/dishwasher/i.test(desc)) careFeatures.push('Dishwasher-safe');
                      if (/machine wash/i.test(desc)) careFeatures.push('Machine washable');
                      if (careFeatures.length > 0) features.push(careFeatures.join(' & '));

                      if (/100%\s*cotton/i.test(desc)) features.push('100% Cotton');
                      else if (/cotton/i.test(desc) && /polyester/i.test(desc))
                        features.push('Cotton-Polyester blend');
                      else if (/polyester/i.test(desc)) features.push('Polyester');

                      if (/organic/i.test(desc)) features.push('Organic material');
                      if (/pre-?shrunk/i.test(desc)) features.push('Pre-shrunk');
                      if (/double[- ]?stitched/i.test(desc)) features.push('Double-stitched');
                      if (/unisex/i.test(desc)) features.push('Unisex fit');
                      if (/slim fit/i.test(desc)) features.push('Slim fit');
                      if (/relaxed fit/i.test(desc)) features.push('Relaxed fit');

                      const uniqueFeatures = [...new Set(features)].slice(0, 6);

                      if (uniqueFeatures.length > 0) {
                        return (
                          <ul className="space-y-1.5">
                            {uniqueFeatures.map((feature, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span style={{ color: AMBER }}>·</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      if (selectedProduct.tags && selectedProduct.tags.length > 0) {
                        return (
                          <div className="flex flex-wrap gap-2">
                            {selectedProduct.tags.slice(0, 4).map((tag, i) => (
                              <span
                                key={i}
                                className="mono text-[0.55rem] uppercase tracking-[0.22em] px-2 py-1"
                                style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        );
                      }

                      return <p>Premium goods from the grove.</p>;
                    })()}
                  </div>
                </div>

                {/* Right — options + shipping + pay */}
                <div className="space-y-4">
                  {/* Variant selectors */}
                  {selectedProduct.options && selectedProduct.options.length > 0 && (
                    <div className="space-y-3">
                      {selectedProduct.options.map((option) => (
                        <div key={option.name}>
                          <label
                            className="block mono text-[0.6rem] uppercase tracking-[0.22em] mb-2"
                            style={{ color: CREAM_DIM }}
                          >
                            {option.name}
                          </label>
                          <div className="relative">
                            <select
                              value={selectedOptions[option.name] || ''}
                              onChange={(e) =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: e.target.value,
                                }))
                              }
                              className="w-full appearance-none cursor-pointer text-sm px-3 py-2.5 pr-9 transition-colors focus:outline-none"
                              style={{
                                background: 'rgba(244,238,228,0.025)',
                                border: `1px solid ${HAIR_STRONG}`,
                                color: CREAM,
                              }}
                            >
                              <option value="" disabled>
                                Select {option.name}
                              </option>
                              {getOptionValues[option.name]?.map((value) => (
                                <option
                                  key={value}
                                  value={value}
                                  style={{ background: BG, color: CREAM }}
                                >
                                  {value}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                              style={{ color: CREAM_FAINT }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shipping address */}
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="mono text-[0.6rem] uppercase tracking-[0.22em]" style={{ color: CREAM_DIM }}>
                      Shipping address
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={shippingAddress.fullName}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                        className={`col-span-2 ${inputCls}`}
                        style={{ border: `1px solid ${HAIR_STRONG}`, color: CREAM }}
                      />
                      <input
                        type="email"
                        placeholder="Email *"
                        value={shippingAddress.email}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className={`col-span-2 ${inputCls}`}
                        style={{ border: `1px solid ${HAIR_STRONG}`, color: CREAM }}
                      />
                      <input
                        type="text"
                        placeholder="Street Address *"
                        value={shippingAddress.address}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({ ...prev, address: e.target.value }))
                        }
                        className={`col-span-2 ${inputCls}`}
                        style={{ border: `1px solid ${HAIR_STRONG}`, color: CREAM }}
                      />
                      <input
                        type="text"
                        placeholder="City *"
                        value={shippingAddress.city}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({ ...prev, city: e.target.value }))
                        }
                        className={inputCls}
                        style={{ border: `1px solid ${HAIR_STRONG}`, color: CREAM }}
                      />
                      <input
                        type="text"
                        placeholder="State / Province"
                        value={shippingAddress.state}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({ ...prev, state: e.target.value }))
                        }
                        className={inputCls}
                        style={{ border: `1px solid ${HAIR_STRONG}`, color: CREAM }}
                      />
                      <input
                        type="text"
                        placeholder="ZIP / Postal"
                        value={shippingAddress.zipCode}
                        onChange={(e) =>
                          setShippingAddress((prev) => ({ ...prev, zipCode: e.target.value }))
                        }
                        className={inputCls}
                        style={{ border: `1px solid ${HAIR_STRONG}`, color: CREAM }}
                      />
                      <div className="relative">
                        <select
                          value={shippingAddress.country}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({ ...prev, country: e.target.value }))
                          }
                          className="w-full appearance-none cursor-pointer text-sm px-3 py-2 pr-8 focus:outline-none"
                          style={{
                            background: 'transparent',
                            border: `1px solid ${HAIR_STRONG}`,
                            color: CREAM,
                          }}
                        >
                          <option value="" disabled style={{ background: BG }}>
                            Country *
                          </option>
                          <option value="United States" style={{ background: BG }}>
                            United States
                          </option>
                          <option value="Canada" style={{ background: BG }}>
                            Canada
                          </option>
                        </select>
                        <ChevronDown
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                          style={{ color: CREAM_FAINT }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div
                    className="px-4 py-3"
                    style={{
                      background: 'rgba(232,150,96,0.06)',
                      border: `1px solid rgba(232,150,96,0.2)`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="mono text-[0.6rem] uppercase tracking-[0.24em]"
                        style={{ color: CREAM_DIM }}
                      >
                        Total
                      </span>
                      {selectedVariant ? (
                        <div className="text-right">
                          <div
                            className="mono"
                            style={{ color: AMBER, fontSize: '1.05rem', letterSpacing: '0.04em' }}
                          >
                            {usdToSolString(selectedVariant.priceUSD)} SOL
                          </div>
                          <div
                            className="mono text-[0.6rem] uppercase tracking-[0.18em]"
                            style={{ color: CREAM_FAINT }}
                          >
                            ${selectedVariant.priceUSD.toFixed(2)} USD
                          </div>
                        </div>
                      ) : (
                        <span className="mono text-[0.6rem] uppercase tracking-[0.22em]" style={{ color: CREAM_FAINT }}>
                          Select options
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Success state */}
                  {paymentStatus === 'success' && txSignature && (
                    <div
                      className="p-4"
                      style={{
                        background: 'rgba(63,122,66,0.08)',
                        border: `1px solid ${FOREST}55`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2" style={{ color: FOREST }}>
                        <Check className="w-5 h-5" />
                        <span
                          style={{
                            color: CREAM,
                            fontFamily: 'var(--font-fraunces, serif)',
                            fontSize: '0.95rem',
                          }}
                        >
                          Order placed.
                        </span>
                      </div>
                      {printifyOrderId && (
                        <p className="mono text-[0.62rem] uppercase tracking-[0.18em] mb-2" style={{ color: AMBER }}>
                          Order · {printifyOrderId}
                        </p>
                      )}
                      <p className="text-xs mb-3" style={{ color: CREAM_DIM }}>
                        Shipping to:
                      </p>
                      <div
                        className="p-3 mb-3 text-sm"
                        style={{
                          background: 'rgba(10,8,20,0.4)',
                          border: `1px solid ${HAIR}`,
                          color: CREAM,
                        }}
                      >
                        <p style={{ fontFamily: 'var(--font-fraunces, serif)' }}>{shippingAddress.fullName}</p>
                        <p className="text-xs" style={{ color: CREAM_DIM }}>
                          {shippingAddress.address}
                        </p>
                        <p className="text-xs" style={{ color: CREAM_DIM }}>
                          {shippingAddress.city}
                          {shippingAddress.state ? `, ${shippingAddress.state}` : ''} {shippingAddress.zipCode}
                        </p>
                        <p className="text-xs" style={{ color: CREAM_DIM }}>
                          {shippingAddress.country}
                        </p>
                        <p className="text-xs mt-1" style={{ color: CREAM_FAINT }}>
                          {shippingAddress.email}
                        </p>
                      </div>
                      <a
                        href={getSolscanUrl(txSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[0.62rem] uppercase tracking-[0.22em] inline-flex items-center gap-1.5 transition-colors"
                        style={{ color: AMBER }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = PEACH)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = AMBER)}
                      >
                        View payment <ExternalLink className="w-3 h-3" />
                      </a>
                      <p className="text-xs mt-3" style={{ color: CREAM_FAINT }}>
                        Updates will land at {shippingAddress.email}.
                      </p>
                    </div>
                  )}

                  {/* Error state */}
                  {paymentStatus === 'error' && paymentError && (
                    <div
                      className="p-4"
                      style={{
                        background: 'rgba(214,115,71,0.08)',
                        border: `1px solid ${EARTH}55`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2" style={{ color: EARTH }}>
                        <AlertCircle className="w-5 h-5" />
                        <span
                          style={{
                            color: CREAM,
                            fontFamily: 'var(--font-fraunces, serif)',
                            fontSize: '0.95rem',
                          }}
                        >
                          Payment didn't go through.
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: CREAM_DIM }}>
                        {paymentError}
                      </p>
                    </div>
                  )}

                  {/* Pay button */}
                  {(() => {
                    const inProgress =
                      paymentStatus === 'preparing' ||
                      paymentStatus === 'signing' ||
                      paymentStatus === 'confirming' ||
                      paymentStatus === 'creating_order';
                    const disabled =
                      !selectedVariant || !isShippingComplete() || inProgress || paymentStatus === 'success';

                    let bg = AMBER;
                    let color = BG;
                    let cursor: 'pointer' | 'not-allowed' | 'wait' = 'pointer';
                    if (paymentStatus === 'success') {
                      bg = FOREST;
                      color = CREAM;
                    } else if (inProgress) {
                      bg = PEACH;
                      color = BG;
                      cursor = 'wait';
                    } else if (!selectedVariant || !isShippingComplete()) {
                      bg = HAIR_STRONG as any;
                      color = CREAM_FAINT as any;
                      cursor = 'not-allowed';
                    }

                    return (
                      <button
                        onClick={handlePayment}
                        disabled={disabled}
                        className="w-full py-3 mono text-[0.65rem] uppercase tracking-[0.26em] flex items-center justify-center gap-2 transition-colors"
                        style={{ background: bg, color, cursor }}
                      >
                        {paymentStatus === 'preparing' && (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Preparing transaction
                          </>
                        )}
                        {paymentStatus === 'signing' && (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Confirm in wallet
                          </>
                        )}
                        {paymentStatus === 'confirming' && (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Confirming on Solana
                          </>
                        )}
                        {paymentStatus === 'creating_order' && (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating order
                          </>
                        )}
                        {paymentStatus === 'success' && (
                          <>
                            <Check className="w-4 h-4" />
                            Order complete
                          </>
                        )}
                        {(paymentStatus === 'idle' || paymentStatus === 'error') && (
                          <>
                            <BloomIcon className="w-4 h-4" />
                            {!authenticated
                              ? 'Connect wallet to pay'
                              : !selectedVariant
                              ? 'Select options'
                              : !isShippingComplete()
                              ? 'Enter shipping address'
                              : `Pay ${usdToSolString(selectedVariant.priceUSD)} SOL`}
                          </>
                        )}
                      </button>
                    );
                  })()}

                  <p className="mono text-[0.55rem] uppercase tracking-[0.22em] text-center" style={{ color: CREAM_FAINT }}>
                    Your address is stored only with the order.
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
