import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/platform-foundation.css';
import './styles/dashboard-v11.css';
import './styles/ui2-governance-policy-sop.css';
import { I18nProvider } from './i18n/I18nContext';
import { AuthProvider } from './auth/AuthProvider';
import { initializeTheme, ThemeProvider } from './theme/ThemeContext';

initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
