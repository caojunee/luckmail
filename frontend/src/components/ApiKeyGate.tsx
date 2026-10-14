import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setApiKey, verifyApiKey } from '../utils/auth';

interface ApiKeyGateProps {
  /** 密钥验证通过后的回调 */
  onUnlocked: () => void;
}

/**
 * API 密钥门禁：本地没有有效密钥时渲染，
 * 用户输入密钥后先通过 verifyApiKey 验证，通过才放行。
 */
const ApiKeyGate: React.FC<ApiKeyGateProps> = ({ onUnlocked }) => {
  const { t } = useTranslation();
  const [apiKey, setApiKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError(t('auth.keyRequired'));
      return;
    }

    setIsVerifying(true);
    setError(null);

    // 先验证密钥有效性，通过后保存并放行
    const result = await verifyApiKey(trimmedKey);

    if (result.valid) {
      setApiKey(trimmedKey);
      onUnlocked();
    } else if (result.error === 'invalid') {
      setError(t('auth.invalidKey'));
    } else if (result.error === 'network') {
      setError(t('auth.networkError'));
    } else {
      setError(t('auth.verifyFailed'));
    }

    setIsVerifying(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border rounded-lg shadow-sm p-8">
          {/* 图标 */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <i className="fas fa-lock text-primary text-xl"></i>
            </div>
          </div>

          {/* 标题与说明 */}
          <h1 className="text-xl font-semibold text-center mb-2">
            {t('auth.title')}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t('auth.description')}
          </p>

          {/* 密钥输入表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t('auth.placeholder')}
              disabled={isVerifying}
              autoFocus
              className={`w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary ${
                error ? 'border-red-500' : ''
              }`}
            />

            {error && (
              <p className="text-red-500 text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></span>
                  {t('auth.verifying')}
                </>
              ) : (
                t('auth.submit')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyGate;
