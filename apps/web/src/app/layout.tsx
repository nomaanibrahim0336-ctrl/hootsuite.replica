import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SocialHub — Social Media Management',
  description: 'A Hootsuite-style social media management platform',
};

// Applies the persisted theme before first paint to avoid a light-mode flash.
const themeScript = `
try {
  var s = JSON.parse(localStorage.getItem('socialhub-ui') || '{}');
  if (s.state && s.state.theme === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
