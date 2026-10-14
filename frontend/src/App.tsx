import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import AboutPage from './pages/AboutPage';
import { MailboxProvider } from './contexts/MailboxContext';
import ApiKeyGate from './components/ApiKeyGate';
import { getApiKey, UNAUTHORIZED_EVENT } from './utils/auth';

const App: React.FC = () => {
  // 本地没有有效密钥时先渲染密钥门禁，验证通过后才进入应用
  const [unlocked, setUnlocked] = useState<boolean>(() => !!getApiKey());

  // 运行期任何请求收到 401（密钥失效/被清除）时重新锁定
  useEffect(() => {
    const handleUnauthorized = () => setUnlocked(false);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  if (!unlocked) {
    return <ApiKeyGate onUnlocked={() => setUnlocked(true)} />;
  }

  return (
      <MailboxProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </div>
      </MailboxProvider>
  );
};

export default App;
