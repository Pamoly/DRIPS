import React from 'react';
import ReactDOM from 'react-dom/client';
import './monaco';
import './index.css';
import App from './App';
import { WorkspaceProvider } from './store/WorkspaceContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>,
);
