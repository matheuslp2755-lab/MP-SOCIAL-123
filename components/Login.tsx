import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import TextInput from './common/TextInput';
import Button from './common/Button';

const AppLogo: React.FC = () => {
    return (
        <h1 className="text-4xl font-serif text-center mb-8">
            MP SOCIAL
        </h1>
    )
};

const AppStoreButton: React.FC = () => (
    <a href="#" className="inline-block">
        <img src="https://www.instagram.com/static/images/appstore-install-badges/badge_ios_english-en.png/180ae7a0bcf7.png" alt="Download on the App Store" className="h-10"/>
    </a>
);

const GooglePlayButton: React.FC = () => (
    <a href="#" className="inline-block">
        <img src="https://www.instagram.com/static/images/appstore-install-badges/badge_android_english-en.png/e9cd846dc748.png" alt="Get it on Google Play" className="h-10"/>
    </a>
);

interface LoginProps {
  onSwitchMode: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = email.includes('@') && password.trim().length >= 6;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change will be handled by App.tsx
    } catch (err: any) {
      setError("Failed to log in. Please check your email and password.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8">
      <div className="hidden md:block">
        <img
          src="https://picsum.photos/400/580"
          alt="App preview"
          className="rounded-lg shadow-lg"
        />
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-10 mb-2.5">
          <AppLogo />
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <TextInput
              id="email"
              type="email"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
            <Button type="submit" disabled={!isFormValid || loading} className="mt-4">
              {loading ? "Logging In..." : "Log In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <a href="#" className="block text-center text-xs text-blue-900 dark:text-blue-400">
              Forgot password?
            </a>
          </div>
        </div>
        
        <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-6 text-center text-sm">
          <p>
            Don't have an account?{' '}
            <button
              onClick={onSwitchMode}
              className="font-semibold text-sky-500 hover:text-sky-600 bg-transparent border-none p-0 cursor-pointer"
            >
              Sign up
            </button>
          </p>
        </div>

        <div className="text-center mt-4 text-sm">
            <p className="mb-4">Get the app.</p>
            <div className="flex justify-center gap-4">
                <AppStoreButton />
                <GooglePlayButton />
            </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
