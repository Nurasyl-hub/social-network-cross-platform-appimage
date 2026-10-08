import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import { WSProvider } from '../context/WSContext';
import { ToastProvider } from '../context/ToastContext';
import Layout from '../components/Layout';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <WSProvider>
        <ToastProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ToastProvider>
      </WSProvider>
    </AuthProvider>
  );
}