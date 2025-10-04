import { ReactNode } from 'react';
import Header from './Header';
import Tabs from './Tabs';

interface LayoutProps {
  activeTab: 'builder' | 'results' | 'library';
  onTabChange: (tab: 'builder' | 'results' | 'library') => void;
  children: ReactNode;
}

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Header />
      <Tabs activeTab={activeTab} onTabChange={onTabChange} />
      <main className="container mx-auto px-8 py-8">
        {children}
      </main>
    </div>
  );
}
