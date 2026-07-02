import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SocialHub — Social Media Management',
  description: 'A Hootsuite-style social media management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
