// Custom _app.js for Pages Router (error pages only)
// This is completely isolated from the App Router and doesn't use Privy

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
