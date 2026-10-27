// Keeps the one-time link out of search engines and stops the token leaking through the Referer header.
export const metadata = { title: 'Trip feedback', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function Layout({ children }) { return children }
