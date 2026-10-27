// Keeps the one-time link out of search engines.
export const metadata = { title: 'Trip feedback', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function Layout({ children }) { return children }
